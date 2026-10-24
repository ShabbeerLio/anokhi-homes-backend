
// const User = require("../models/User");
// const IncomeHistory = require("../models/IncomeHistory");
// const getCurrentCycle = require("../utils/getCurrentCycle");
// const WalletTransaction = require("../models/WalletTransaction");

// const distributeDifferenceIncome = async (
//   agentId,
//   businessAmount,
//   paymentId,
// ) => {
//   try {
//     let child = await User.findById(agentId);
//     if (!child) return;
//     let parentId = child.parent;
//     while (parentId) {
//       const parent = await User.findById(parentId);
//       if (!parent) break;

//       const childRate = child.directIncomePercent || 0;
//       const parentRate = parent.directIncomePercent || 0;
//       const difference = parentRate - childRate;

//       if (difference > 0 && parent.status === "active") {
//         const income = (businessAmount * difference) / 100;
//         parent.wallet += income;
//         const { cycleStart, cycleEnd } = getCurrentCycle();
//         await WalletTransaction.create({
//           user: parent._id,
//           amount: income,
//           type: "credit",
//           source: "difference_income",
//           remark: "Difference Income",
//           cycleStart,
//           cycleEnd,
//           isSettled: false,
//         });
//         parent.totalIncome += income;
//         await parent.save();
//         await IncomeHistory.create({
//           user: parent._id,
//           fromUser: child._id,
//           payment: paymentId,
//           type: "difference_income",
//           percentage: difference,
//           businessAmount,
//           amount: income,
//           status: "credited",
//           creditedAt: new Date(),
//         });
//         console.log(`${parent.name} Difference Income ₹${income}`);
//       }

//       child = parent;
//       parentId = parent.parent;
//     }
//   } catch (error) {
//     console.log(error);
//   }
// };

// module.exports = distributeDifferenceIncome;

const User = require("../models/User");
const IncomeHistory = require("../models/IncomeHistory");
const getCurrentCycle = require("../utils/getCurrentCycle");
const WalletTransaction = require("../models/WalletTransaction");

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/*
  childSegments = what distributeDirectIncome paid the agent for THIS payment,
  one entry per slab portion, e.g.
    [{ percentage: 5, business: 376020 }, { percentage: 6, business: 223380 }]

  The agent's own rate can change inside one payment, so the parent's
  difference (parentRate - agentRate) has to be worked out per portion.
  Every hop above the agent uses that person's stored directIncomePercent,
  exactly as before.
*/
const distributeDifferenceIncome = async (
  agentId,
  businessAmount,
  paymentId,
  childSegments = [],
) => {
  try {
    let child = await User.findById(agentId);
    if (!child) return;

    // Scale the portions so they always add up to the payment's business
    // (same total the old single-row logic used).
    const segTotal = childSegments.reduce(
      (s, x) => s + (Number(x.business) || 0),
      0,
    );
    const scale = segTotal > 0 ? businessAmount / segTotal : 0;

    // [{ rate, business }] — the child's rate for each portion of the payment
    let childParts =
      scale > 0
        ? childSegments.map((s) => ({
            rate: s.percentage,
            business: s.business * scale,
          }))
        : [{ rate: child.directIncomePercent || 0, business: businessAmount }];

    let parentId = child.parent;
    while (parentId) {
      const parent = await User.findById(parentId);
      if (!parent) break;

      if (parent.status === "active") {
        const parentRate = parent.directIncomePercent || 0;

        // one row per portion where the parent still earns a difference
        const rows = [];
        childParts.forEach((part) => {
          const difference = parentRate - part.rate;
          const income = round2((part.business * difference) / 100);
          if (difference > 0 && income > 0) {
            rows.push({
              difference,
              childRate: part.rate,
              business: round2(part.business),
              income,
            });
          }
        });

        if (rows.length) {
          const totalIncome = round2(rows.reduce((s, r) => s + r.income, 0));
          const { cycleStart, cycleEnd } = getCurrentCycle();

          parent.wallet += totalIncome;
          await WalletTransaction.create({
            user: parent._id,
            amount: totalIncome,
            type: "credit",
            source: "difference_income",
            remark: "Difference Income",
            cycleStart,
            cycleEnd,
            isSettled: false,
          });
          parent.totalIncome += totalIncome;
          await parent.save();

          const creditedAt = new Date();
          await IncomeHistory.insertMany(
            rows.map((r, i) => ({
              user: parent._id,
              fromUser: child._id,
              payment: paymentId,
              type: "difference_income",
              percentage: r.difference,
              businessAmount: r.business,
              amount: r.income,
              status: "credited",
              creditedAt,
              remark:
                i > 0 && rows[i - 1].childRate !== r.childRate
                  ? `Slab changed from ${rows[i - 1].childRate}% to ${r.childRate}% (difference ${rows[i - 1].difference}% → ${r.difference}%)`
                  : "",
            })),
          );

          console.log(
            `${parent.name} Difference Income ₹${totalIncome} (` +
              rows
                .map((r) => `₹${r.business} @ ${r.difference}% = ₹${r.income}`)
                .join(", ") +
              ")",
          );
        }
      }

      // above the agent, each hop uses the stored rate of the person below
      child = parent;
      childParts = [
        { rate: parent.directIncomePercent || 0, business: businessAmount },
      ];
      parentId = parent.parent;
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = distributeDifferenceIncome;