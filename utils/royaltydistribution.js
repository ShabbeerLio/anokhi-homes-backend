const cron =
  require("node-cron");

const Booking =
  require("../models/Booking");

const distributeRoyalty =
  require("../mlmController/distributeRoyaltyIncome");

cron.schedule(
  "0 0 1 * *",
  async () => {
    const start =
      new Date(
        new Date().getFullYear(),
        new Date().getMonth() - 1,
        1
      );

    const end =
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        0,
        23,
        59,
        59
      );

    const bookings =
      await Booking.find({
        createdAt: {
          $gte: start,
          $lte: end,
        },
      });

    const companyBusiness =
      bookings.reduce(
        (sum, item) =>
          sum + item.amount,
        0
      );

    await distributeRoyalty(
      companyBusiness
    );

    console.log(
      "Royalty distributed successfully"
    );
  }
);