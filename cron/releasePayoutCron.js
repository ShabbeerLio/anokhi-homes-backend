const cron = require("node-cron");

const Payout = require("../models/Payout");
const User = require("../models/User");
const WalletTransaction = require("../models/WalletTransaction");
const { notifyUser, notifyAdmins } = require("../utils/notify");

cron.schedule("0 1 * * *", async () => {
  try {
    const today = new Date();

    //----------------------------------------
    // Find all payouts ready to release
    //----------------------------------------

    const payouts = await Payout.find({
      status: "hold",
      releaseDate: {
        $lte: today,
      },
    });

    if (!payouts.length) {
      console.log("No payout to release");
      return;
    }

    //----------------------------------------

    for (const payout of payouts) {
      const user = await User.findById(payout.user);

      if (!user) continue;

      //----------------------------------------
      // Move Hold Wallet -> Main Wallet
      //----------------------------------------

      user.walletHold -= payout.grossAmount;

      user.wallet += payout.netAmount;

      //----------------------------------------
      // Save payout status
      //----------------------------------------

      payout.status = "released";
      payout.releasedAt = new Date();

      //----------------------------------------
      // Wallet History
      //----------------------------------------

      await WalletTransaction.create({
        user: user._id,
        amount: payout.netAmount,
        type: "credit",
        source: "payout",
        remark: `Payout Released (${payout.cycleStart.toLocaleDateString()} - ${payout.cycleEnd.toLocaleDateString()})`,
      });

      //----------------------------------------
      await user.save();
      await payout.save();
      await notifyUser({
        user: user._id,
        sender: null,
        title: "Payout Released",
        message: `₹${payout.netAmount.toLocaleString()} has been credited to your wallet.`,
        type: "payout",
        referenceId: payout._id,
        referenceModel: "Payout",
      });

      await notifyAdmins({
        sender: null,
        title: "Payout Released",
        message: `Payout of ₹${payout.netAmount.toLocaleString()} has been released to ${user.name}.`,
        type: "payout",
        referenceId: payout._id,
        referenceModel: "Payout",
      });
      console.log(`Released payout for ${user.name} ₹${payout.netAmount}`);
    }
    console.log("Payout Release Completed");
  } catch (err) {
    console.log(err);
  }
});
