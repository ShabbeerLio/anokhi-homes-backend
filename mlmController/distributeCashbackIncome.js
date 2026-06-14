const Cashback = require("../models/Cashback");
const IncomeHistory = require("../models/IncomeHistory");
const Booking = require("../models/Booking");
const getCycleDate = require("./getCycleDate");

const distributeCashbackIncome = async (bookingId, agentId) => {
  try {
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
    await IncomeHistory.create({
      user: agentId,
      type: "cashback_income",
      businessAmount: booking.finalAmount,
      percentage: cashback.cashbackPercent,
      amount: cashbackAmount,
      status: "pending",
      cycleDate: getCycleDate(),
    });
  } catch (error) {
    console.log(error);
  }
};

module.exports = distributeCashbackIncome;
