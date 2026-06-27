const cron = require("node-cron");
const HelpTicket = require("../models/HelpTicket");

cron.schedule("0 0 * * *", async () => {
  try {
    const sevenDaysAgo = new Date();

    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const tickets = await HelpTicket.find({
      status: "Replied",
    });

    for (const ticket of tickets) {
      let lastReplyDate = ticket.updatedAt;

      if (ticket.replies.length > 0) {
        lastReplyDate = ticket.replies[0].createdAt;
      }

      const lastReply = ticket.replies[0];

      if (
        lastReply &&
        (lastReply.role === "admin" || lastReply.role === "staff") &&
        lastReplyDate <= sevenDaysAgo
      ) {
        ticket.status = "Closed";
        await ticket.save();
      }
    }

    console.log("Help Ticket Auto Close Executed");
  } catch (err) {
    console.log(err);
  }
});
