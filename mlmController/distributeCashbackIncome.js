const Cashback = require("../models/Cashback");
const IncomeHistory = require("../models/IncomeHistory");
const Booking = require("../models/Booking");
const WalletTransaction = require("../models/WalletTransaction");
const getCurrentCycle = require("../utils/getCurrentCycle");

const distributeCashbackIncome = async (bookingId, agentId) => {
  try {
    // Already paid for this booking? Stop immediately.
    const alreadyPaid = await IncomeHistory.findOne({
      user: agentId,
      from: bookingId,
      type: "cashback_income",
    });
    if (alreadyPaid) return;

    const booking = await Booking.findById(bookingId);
    if (!booking) return;
    const cashback = await Cashback.findOne({
      colonyId: booking.colony,
      active: true,
    });
    if (!cashback) return;
    const bookingDate = new Date(booking.createdAt);
    if (
      bookingDate < new Date(cashback.startDate) ||
      bookingDate > new Date(cashback.endDate)
    ) {
      return;
    }
    const fullPaymentDate = new Date();
    const diffDays = Math.ceil(
      (fullPaymentDate - bookingDate) / (1000 * 60 * 60 * 24),
    );
    if (diffDays > cashback.completeWithinDays) {
      return;
    }
    const cashbackAmount =
      (booking.finalAmount * cashback.cashbackPercent) / 100;
    const { cycleStart, cycleEnd } = getCurrentCycle();

    // IncomeHistory written FIRST — this is what the alreadyPaid check
    // above relies on, so it must exist before the wallet is touched.
    await IncomeHistory.create({
      user: agentId,
      from: bookingId,
      percentage: cashback.cashbackPercent,
      type: "cashback_income",
      businessAmount: booking.finalAmount,
      amount: cashbackAmount,
      status: "credited",
      creditedAt: new Date(),
    });

    await WalletTransaction.create({
      user: agentId,
      from: bookingId,
      amount: cashbackAmount,
      type: "credit",
      source: "cashback_income",
      remark: "Cashback Income",
      cycleStart,
      cycleEnd,
      isSettled: false,
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports = distributeCashbackIncome;