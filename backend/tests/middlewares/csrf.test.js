import '../helpers/env.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { makeApp } from '../helpers/app.js';
import { csrfGuard, requireJson } from '../../src/middlewares/csrf.middleware.js';

const XHR = { 'X-Requested-With': 'XMLHttpRequest' };

describe('csrfGuard', () => {
  const app = makeApp(csrfGuard);

  for (const method of ['post', 'put', 'patch', 'delete']) {
    it(`${method.toUpperCase()} without the header -> 403`, async () => {
      const res = await request(app)[method]('/test');
      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
    });

    it(`${method.toUpperCase()} with the header -> 200`, async () => {
      const res = await request(app)[method]('/test').set(XHR);
      assert.equal(res.status, 200);
    });
  }

  it('wrong header value -> 403', async () => {
    const res = await request(app).post('/test').set('X-Requested-With', 'fetch');
    assert.equal(res.status, 403);
  });

  it('GET without the header -> 200', async () => {
    const res = await request(app).get('/test');
    assert.equal(res.status, 200);
  });
});

describe('requireJson', () => {
  const app = makeApp(requireJson);

  it('JSON body -> 200', async () => {
    const res = await request(app).post('/test').send({ a: 1 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.body, { a: 1 });
  });

  it('text/plain body -> 415', async () => {
    const res = await request(app).post('/test').set('Content-Type', 'text/plain').send('a=1');
    assert.equal(res.status, 415);
  });

  it('form-encoded body -> 415', async () => {
    const res = await request(app).post('/test').type('form').send({ a: '1' });
    assert.equal(res.status, 415);
  });

  it('no body -> 200', async () => {
    const res = await request(app).post('/test');
    assert.equal(res.status, 200);
  });
});
