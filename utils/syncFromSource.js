const mongoose = require("mongoose");
const RankSlab = require("../models/RankSlab"); // adjust path if needed

const DEFAULT_COLLECTIONS = ["locations", "colonies", "users"]; // order matters

const PENDING = "PENDING";
const SOLD = "SOLD";
const FOR_SALE = "FOR_SALE";
const LOCKED = new Set([PENDING, SOLD]);

// colonyId -> Map(plotNumber -> plotType) from THIS database, read before overwriting
async function loadLocalPlotTypes(dstCol) {
  const map = new Map();
  const docs = await dstCol
    .find(
      {},
      {
        projection: {
          "layout.plots.plotNumber": 1,
          "layout.plots.plotType": 1,
        },
      },
    )
    .toArray();
  for (const d of docs) {
    const plots = (d.layout && d.layout.plots) || [];
    map.set(
      String(d._id),
      new Map(plots.map((p) => [p.plotNumber, p.plotType])),
    );
  }
  return map;
}

function resolvePlotTypes(doc, localPlots, stats) {
  const plots = doc.layout && doc.layout.plots;
  if (!Array.isArray(plots)) return;
  const local = localPlots.get(String(doc._id));

  for (const plot of plots) {
    const localType = local && local.get(plot.plotNumber);

    if (LOCKED.has(localType)) {
      // already pending/sold here -> keep it
      if (plot.plotType !== localType) stats.keptLocal++;
      plot.plotType = localType;
    } else if (LOCKED.has(plot.plotType)) {
      // pending/sold in source, but not here -> for sale
      plot.plotType = FOR_SALE;
      stats.resetToForSale++;
    }
  }
}

async function syncFromSource({
  collections = DEFAULT_COLLECTIONS,
  mirrorDeletes = false,
  dryRun = false,
} = {}) {
  if (!process.env.SOURCE_MONGO_URI) {
    throw new Error("SOURCE_MONGO_URI is not set");
  }

  const src = await mongoose
    .createConnection(process.env.SOURCE_MONGO_URI)
    .asPromise();
  const dst = mongoose.connection;

  // designation -> directIncome, from THIS database's RankSlab
  const slabs = await RankSlab.find().lean();
  const percentByDesignation = new Map(
    slabs.map((s) => [s.designation.trim(), s.directIncome]),
  );

  const report = {};

  try {
    for (const name of collections) {
      const stats = {
        source: 0,
        upserted: 0,
        updated: 0,
        deleted: 0,
        errors: [],
      };
      const isUsers = name === "users";
      if (isUsers) {
        stats.percentSynced = 0;
        stats.unmatchedDesignations = [];
      }
      const isColonies = name === "colonies";
      if (isColonies) {
        stats.keptLocal = 0;
        stats.resetToForSale = 0;
      }

      const srcCol = src.collection(name);
      const dstCol = dst.collection(name);

      stats.source = await srcCol.countDocuments();

      if (!dryRun) {
        const localPlots = isColonies ? await loadLocalPlotTypes(dstCol) : null;

        const cursor = srcCol.find({});
        let batch = [];
        const unmatched = new Set();

        const flush = async () => {
          if (!batch.length) return;
          try {
            const r = await dstCol.bulkWrite(batch, { ordered: false });
            stats.upserted += r.upsertedCount;
            stats.updated += r.modifiedCount;
          } catch (err) {
            (err.writeErrors || []).forEach((e) =>
              stats.errors.push(e.err?.errmsg || e.errmsg),
            );
            if (!err.writeErrors) stats.errors.push(err.message);
          }
          batch = [];
        };

        for await (const doc of cursor) {
          if (isColonies) resolvePlotTypes(doc, localPlots, stats);
          if (isUsers && percentByDesignation.size) {
            const percent = percentByDesignation.get(
              (doc.designation || "").trim(),
            );
            if (percent !== undefined) {
              doc.directIncomePercent = percent;
              stats.percentSynced++;
            } else {
              unmatched.add(doc.designation);
            }
          }

          batch.push({
            replaceOne: {
              filter: { _id: doc._id },
              replacement: doc,
              upsert: true,
            },
          });
          if (batch.length >= 500) await flush();
        }
        await flush();

        if (isUsers) stats.unmatchedDesignations = [...unmatched];

        if (mirrorDeletes) {
          const ids = await srcCol
            .find({}, { projection: { _id: 1 } })
            .toArray();
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
