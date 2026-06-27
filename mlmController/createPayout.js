const WalletTransaction = require("../models/WalletTransaction");
const Payout = require("../models/Payout");
const PayoutSetting = require("../models/PayoutSetting");
const { notifyUser, notifyAdmins } = require("../utils/notify");

exports.createPayout = async (cycleStart, cycleEnd, releaseDate) => {
  try {
    const setting = await PayoutSetting.findOne();
    const tdsPercent = setting?.tdsPercent || 2;
    const adminChargePercent = setting?.adminChargePercent || 5;
    const minimumPayout = setting?.minimumPayout || 500;
    const transactions = await WalletTransaction.find({
      isSettled: false,
      cycleStart: {
        $gte: cycleStart,
      },
      cycleEnd: {
        $lte: cycleEnd,
      },
    });
    if (!transactions.length) {
      console.log("No payout found.");
      return;
    }
    const grouped = {};
    transactions.forEach((trx) => {
      const id = trx.user.toString();
      if (!grouped[id]) {
        grouped[id] = {
          grossAmount: 0,
          transactions: [],
        };
      }
      grouped[id].grossAmount += trx.amount;
      grouped[id].transactions.push(trx);
    });

    for (const userId in grouped) {
      const userData = grouped[userId];

      if (userData.grossAmount < minimumPayout) {
        continue;
      }

      const grossAmount = userData.grossAmount;
      const tdsAmount = (grossAmount * tdsPercent) / 100;
      const adminChargeAmount = (grossAmount * adminChargePercent) / 100;
      const netAmount = grossAmount - tdsAmount - adminChargeAmount;

      const payout = await Payout.create({
        user: userId,
        cycleStart,
        cycleEnd,
        releaseDate,
        grossAmount,
        tdsPercent,
        tdsAmount,
        adminChargePercent,
        adminChargeAmount,
        netAmount,
        status: "hold",
        transactions: userData.transactions.map((t) => t._id),
      });
      await notifyAdmins({
        sender: null,
        title: "6-Month Payout Generated",
        message: `A payout of ₹${netAmount.toLocaleString()} has been generated for the next release cycle.`,
        type: "payout",
        referenceId: payout._id,
        referenceModel: "Payout",
      });

      await notifyUser({
        user: userId,
        sender: null,
        title: "Payout Generated",
        message: `A payout of ₹${netAmount.toLocaleString()} has been generated and is currently on hold.`,
        type: "payout",
        referenceId: payout._id,
        referenceModel: "Payout",
      });
      await WalletTransaction.updateMany(
        {
          _id: {
            $in: userData.transactions.map((t) => t._id),
          },
        },
        {
          payout: payout._id,

          isSettled: true,
        },
      );

      console.log(`Payout Created for ${userId} ₹${netAmount}`);
    }
  } catch (err) {
    console.log(err);
  }
};
