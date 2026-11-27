import '../helpers/env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startDb, clearDb, stopDb } from '../helpers/db.js';
import { createUser, createDonation } from '../helpers/factories.js';
import {
  TRANSITIONS,
  canTransition,
  assertTransition,
  transitionDonation,
  logClaimAction,
} from '../../src/services/donationStatus.service.js';
import { Donation } from '../../src/models/Donation.js';
import { ClaimHistory } from '../../src/models/ClaimHistory.js';
import { ApiError } from '../../src/utils/ApiError.js';
import { DONATION_STATUS as S, CLAIM_ACTIONS, USER_TYPES } from '../../src/constants/index.js';

// Expected legal transitions, written independently from the service (CLAUDE.md section 6).
const LEGAL = new Set([
  'AVAILABLE>CLAIMED',
  'AVAILABLE>EXPIRED',
  'AVAILABLE>CANCELLED',
  'CLAIMED>AVAILABLE',
  'CLAIMED>CANCELLED',
  'CLAIMED>PICKED_UP',
  'PICKED_UP>DISTRIBUTED',
]);
const ALL = Object.values(S);

const isApiError = (status) => (err) => err instanceof ApiError && err.statusCode === status;

describe('status transition table', () => {
  for (const from of ALL) {
    for (const to of ALL) {
      const legal = LEGAL.has(`${from}>${to}`);
      it(`${from} -> ${to} is ${legal ? 'legal' : 'illegal'}`, () => {
        assert.equal(canTransition(from, to), legal);
        if (legal) assert.doesNotThrow(() => assertTransition(from, to));
        else assert.throws(() => assertTransition(from, to), isApiError(409));
      });
    }
  }

  it('final states have no way out', () => {
    for (const s of [S.EXPIRED, S.CANCELLED, S.DISTRIBUTED]) assert.deepEqual(TRANSITIONS[s], []);
  });

  it('unknown statuses are illegal', () => {
    assert.equal(canTransition('NOPE', S.CLAIMED), false);
    assert.equal(canTransition(S.AVAILABLE, 'NOPE'), false);
  });

  it('the table cannot be modified at runtime', () => {
    assert.ok(Object.isFrozen(TRANSITIONS));
    assert.ok(Object.isFrozen(TRANSITIONS[S.AVAILABLE]));
  });
});

describe('transitionDonation', () => {
  let donor, otherDonor, ngo;

  before(startDb);
  after(stopDb);
  beforeEach(async () => {
    await clearDb();
    donor = await createUser(USER_TYPES.DONOR);
    otherDonor = await createUser(USER_TYPES.DONOR);
    ngo = await createUser(USER_TYPES.NGO);
  });

  it('moves the status and applies extra fields', async () => {
    const d = await createDonation(donor);
    const claimedAt = new Date();
    const updated = await transitionDonation({
      donationId: d._id,
      from: [S.AVAILABLE],
      to: S.CLAIMED,
      set: { claimedBy: ngo._id, claimedAt },
    });
    assert.equal(updated.status, S.CLAIMED);
    assert.equal(String(updated.claimedBy), String(ngo._id));
    assert.equal(updated.claimedAt.getTime(), claimedAt.getTime());
  });

  it('accepts several allowed current statuses (donor cancel from CLAIMED)', async () => {
    const d = await createDonation(donor, { status: S.CLAIMED, claimedBy: ngo._id });
    const updated = await transitionDonation({
      donationId: d._id,
      from: [S.AVAILABLE, S.CLAIMED],
      to: S.CANCELLED,
      extraFilter: { donor: donor._id },
      set: { cancelReason: 'Event cancelled', cancelledAt: new Date() },
    });
    assert.equal(updated.status, S.CANCELLED);
    assert.equal(updated.cancelReason, 'Event cancelled');
  });

  it('404 when the donation does not exist', async () => {
    await assert.rejects(
      transitionDonation({
        donationId: new mongoose.Types.ObjectId(),
        from: [S.AVAILABLE],
        to: S.CLAIMED,
      }),
      isApiError(404)
    );
  });

  it('404 for a malformed id', async () => {
    await assert.rejects(
      transitionDonation({ donationId: 'not-an-id', from: [S.AVAILABLE], to: S.CLAIMED }),
      isApiError(404)
    );
  });

  it('404 (not 403) when the donation belongs to someone else', async () => {
    const d = await createDonation(donor);
    await assert.rejects(
      transitionDonation({
        donationId: d._id,
        from: [S.AVAILABLE],
        to: S.CANCELLED,
        extraFilter: { donor: otherDonor._id },
      }),
      isApiError(404)
    );
    assert.equal((await Donation.findById(d._id)).status, S.AVAILABLE);
  });

  it('409 with the current status when the donation is in the wrong state', async () => {
    const d = await createDonation(donor, { status: S.EXPIRED });
    await assert.rejects(
      transitionDonation({ donationId: d._id, from: [S.AVAILABLE], to: S.CLAIMED }),
      (err) => isApiError(409)(err) && err.message.includes(S.EXPIRED)
    );
  });

  it('409 before touching the DB when a from->to pair is illegal', async () => {
    const d = await createDonation(donor);
    await assert.rejects(
      transitionDonation({ donationId: d._id, from: [S.AVAILABLE], to: S.DISTRIBUTED }),
      isApiError(409)
    );
    assert.equal((await Donation.findById(d._id)).status, S.AVAILABLE);
  });

  it('extraFilter and set cannot override _id or status', async () => {
    const mine = await createDonation(donor);
    const other = await createDonation(donor, { status: S.CLAIMED, claimedBy: ngo._id });
    const updated = await transitionDonation({
      donationId: mine._id,
      from: [S.AVAILABLE],
      to: S.CLAIMED,
      extraFilter: { _id: other._id, status: S.CLAIMED },
      set: { status: S.DISTRIBUTED, claimedBy: ngo._id },
    });
    assert.equal(String(updated._id), String(mine._id));
    assert.equal(updated.status, S.CLAIMED);
    assert.equal((await Donation.findById(other._id)).status, S.CLAIMED);
  });

  it('rejects an empty "from" list', async () => {
    const d = await createDonation(donor);
    await assert.rejects(transitionDonation({ donationId: d._id, from: [], to: S.CLAIMED }));
  });

  it('race: two NGOs claim the same donation at once, exactly one wins', async () => {
    const d = await createDonation(donor);
    const ngo2 = await createUser(USER_TYPES.NGO);
    const claim = (n) =>
      transitionDonation({
        donationId: d._id,
        from: [S.AVAILABLE],
        to: S.CLAIMED,
        set: { claimedBy: n._id, claimedAt: new Date() },
      });

    const results = await Promise.allSettled([claim(ngo), claim(ngo2)]);
    const wins = results.filter((r) => r.status === 'fulfilled');
    const losses = results.filter((r) => r.status === 'rejected');
    assert.equal(wins.length, 1);
    assert.equal(losses.length, 1);
    assert.ok(isApiError(409)(losses[0].reason));

    const saved = await Donation.findById(d._id);
    assert.equal(String(saved.claimedBy), String(wins[0].value.claimedBy));
  });

  it('race: 10 parallel claims, exactly one wins', async () => {
    const d = await createDonation(donor);
    const ngos = await Promise.all(Array.from({ length: 10 }, () => createUser(USER_TYPES.NGO)));
    const results = await Promise.allSettled(
      ngos.map((n) =>
        transitionDonation({
          donationId: d._id,
          from: [S.AVAILABLE],
          to: S.CLAIMED,
          set: { claimedBy: n._id },
        })
      )
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  });

  it('race: donor cancel vs NGO claim, exactly one wins', async () => {
    const d = await createDonation(donor);
    const results = await Promise.allSettled([
      transitionDonation({
        donationId: d._id,
        from: [S.AVAILABLE],
        to: S.CLAIMED,
        set: { claimedBy: ngo._id },
      }),
      transitionDonation({
        donationId: d._id,
        from: [S.AVAILABLE],
        to: S.CANCELLED,
        extraFilter: { donor: donor._id },
      }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  });

  it('works inside a transaction and rolls back on abort', async () => {
    const d = await createDonation(donor);
    const session = await mongoose.startSession();
    try {
      await assert.rejects(
        session.withTransaction(async () => {
          await transitionDonation({
            donationId: d._id,
            from: [S.AVAILABLE],
            to: S.CLAIMED,
            set: { claimedBy: ngo._id },
            session,
          });
          await logClaimAction({
            donation: d._id,
            ngo: ngo._id,
            actor: ngo._id,
            action: CLAIM_ACTIONS.CLAIMED,
            session,
          });
          throw new Error('abort');
        }),
        /abort/
      );
    } finally {
      await session.endSession();
    }
    assert.equal((await Donation.findById(d._id)).status, S.AVAILABLE);
    assert.equal(await ClaimHistory.countDocuments(), 0);
  });
});

describe('logClaimAction', () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it('writes a history entry', async () => {
    const donor = await createUser(USER_TYPES.DONOR);
    const ngo = await createUser(USER_TYPES.NGO);
    const d = await createDonation(donor);
    const entry = await logClaimAction({
      donation: d._id,
      ngo: ngo._id,
      actor: ngo._id,
      action: CLAIM_ACTIONS.CLAIMED,
    });
    assert.equal(entry.action, CLAIM_ACTIONS.CLAIMED);
    assert.ok(entry.at instanceof Date);
    assert.equal(await ClaimHistory.countDocuments({ donation: d._id }), 1);
  });

  it('rejects an unknown action', async () => {
    await assert.rejects(
      logClaimAction({ donation: new mongoose.Types.ObjectId(), action: 'STOLEN' }),
      (err) => err.name === 'ValidationError'
    );
  });
});
