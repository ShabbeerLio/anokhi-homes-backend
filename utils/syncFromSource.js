const mongoose = require("mongoose");

const DEFAULT_COLLECTIONS = ["locations", "colonies", "users"]; // order matters

async function syncFromSource({
  collections = DEFAULT_COLLECTIONS,
  mirrorDeletes = false, // also remove docs from target that no longer exist in source
  dryRun = false,
} = {}) {
  if (!process.env.SOURCE_MONGO_URI) {
    throw new Error("SOURCE_MONGO_URI is not set");
  }

  const src = await mongoose
    .createConnection(process.env.SOURCE_MONGO_URI)
    .asPromise();
  const dst = mongoose.connection; // your app's existing (target) connection

  const report = {};

  try {
    for (const name of collections) {
      const stats = { source: 0, upserted: 0, updated: 0, deleted: 0, errors: [] };
      const srcCol = src.collection(name);
      const dstCol = dst.collection(name);

      stats.source = await srcCol.countDocuments();

      if (!dryRun) {
        const cursor = srcCol.find({});
        let batch = [];

        const flush = async () => {
          if (!batch.length) return;
          try {
            const r = await dstCol.bulkWrite(batch, { ordered: false });
            stats.upserted += r.upsertedCount;
            stats.updated += r.modifiedCount;
          } catch (err) {
            (err.writeErrors || []).forEach((e) =>
              stats.errors.push(e.err?.errmsg || e.errmsg)
            );
            if (!err.writeErrors) stats.errors.push(err.message);
          }
          batch = [];
        };

        for await (const doc of cursor) {
          batch.push({
            replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
          });
          if (batch.length >= 500) await flush();
        }
        await flush();

        if (mirrorDeletes) {
          const ids = await srcCol.find({}, { projection: { _id: 1 } }).toArray();
          const r = await dstCol.deleteMany({
            _id: { $nin: ids.map((d) => d._id) },
          });
          stats.deleted = r.deletedCount;
        }
      }

      report[name] = stats;
    }
  } finally {
    await src.close();
  }

  return report;
}

module.exports = syncFromSource;