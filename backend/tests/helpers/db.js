import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// In-memory MongoDB started as a 1-node replica set, so transactions work.
let replSet;

/** Start the database, connect Mongoose and build the indexes of every loaded model. */
export const startDb = async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replSet.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.createIndexes()));
};

/** Remove all documents (indexes are kept). */
export const clearDb = async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
};

/** Disconnect and stop the database. */
export const stopDb = async () => {
  await mongoose.disconnect();
  await replSet?.stop();
};
