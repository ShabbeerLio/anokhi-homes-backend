const mongoose = require("mongoose");
const StaffRole = require("../models/StaffRole");

mongoose.connect(process.env.MONGO_URI);

(async () => {
  await StaffRole.deleteMany();
  await StaffRole.insertMany([
    {
      name: "Manager",
      slug: "manager",
      permissions: [
        "lead.view",
        "lead.add",
        "lead.edit",
        "lead.assign",
        "plot.view",
        "plot.add",
        "plot.edit",
        "plot.delete",
        "plot.change_status",
        "booking.view",
        "booking.add",
        "booking.approve",
        "payment.view",
        "payment.add",
        "payment.approve",
        "sitevisit.view",
        "sitevisit.add",
        "sitevisit.complete",
        "report.view",
        "report.export",
      ],
    },
    {
      name: "Plot Manager",
      slug: "plot_manager",
      permissions: [
        "plot.view",
        "plot.add",
        "plot.edit",
        "plot.delete",
        "plot.change_status",
      ],
    },
    {
      name: "Accounts Manager",
      slug: "accounts_manager",
      permissions: [
        "payment.view",
        "payment.add",
        "payment.approve",
        "report.view",
      ],
    },
    {
      name: "Operations Manager",
      slug: "operations_manager",
      permissions: [
        "lead.view",
        "lead.add",
        "lead.assign",
        "sitevisit.view",
        "sitevisit.add",
        "sitevisit.complete",
      ],
    },
  ]);

  console.log("Done");

  process.exit();
})();
