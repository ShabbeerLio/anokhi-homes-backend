const PlotHold = require("../models/PlotHold");
const HoldSetting = require("../models/HoldSetting");
const Colony = require("../models/Colony");
const User = require("../models/User");
const generateReceiptNo = require("../utils/generateReceiptNo");
const { notifyAdmins, notifyUser } = require("../utils/notify");

exports.freeHold = async (req, res) => {
  try {
    const { colony, plotId, customer } = req.body;
    const agent = req.user.id;
    const setting = await HoldSetting.findOne();
    // already held?
    const active = await PlotHold.findOne({
      colony,
      plotId,
      status: {
        $in: ["ACTIVE", "APPROVAL"],
      },
    });

    if (active) {
      return res.status(400).json({
        message: "Plot already on hold.",
      });
    }

    // previous free hold

    const previous = await PlotHold.findOne({
      colony,
      plotId,
      agent,
      holdType: "FREE",
      status: "EXPIRED",
    });

    let status = "ACTIVE";
    let expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + setting.freeHoldDays);

    if (previous) {
      status = "APPROVAL";
      expiresAt = null;
    }

    const hold = await PlotHold.create({
      colony,
      plotId,
      customer,
      agent,
      holdType: "FREE",
      amount: 0,
      status,
      expiresAt,
    });

    const agentData = await User.findById(agent);
    const customerData = await User.findById(customer);

    await notifyAdmins({
      sender: agent,
      title: "New Free Plot Hold",
      message: `${agentData.name} has requested a FREE hold for Plot ${plot.plotNumber || plotId} in ${colonyData.name}.`,
      type: "plot_hold",
      referenceId: hold._id,
      referenceModel: "PlotHold",
    });
    const colonyData = await Colony.findById(colony);
    const plot = colonyData.layout.plots.id(plotId);

    if (!plot) {
      return res.status(404).json({
        message: "Plot not found",
      });
    }

    plot.plotType = "HOLD";
    await colonyData.save();

    res.json({
      success: true,
      hold,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.paidHold = async (req, res) => {
  try {
    const { colony, plotId, customer } = req.body;

    const agent = req.user.id;

    const setting = await HoldSetting.findOne();

    const active = await PlotHold.findOne({
      colony,
      plotId,
      status: {
        $in: ["ACTIVE", "APPROVAL"],
      },
    });

    if (active) {
      return res.status(400).json({
        message: "Plot already on hold.",
      });
    }

    const hold = await PlotHold.create({
      colony,
      plotId,
      customer,
      agent,
      holdType: "PAID",
      amount: setting.paidAmount,
      status: "APPROVAL",
    });

    const colonyData = await Colony.findById(colony);
    const plot = colonyData.layout.plots.id(plotId);

    const agentData = await User.findById(agent);

    await notifyAdmins({
      sender: agent,
      title: "New Paid Plot Hold",
      message: `${agentData.name} has requested a PAID hold for Plot ${plot.plotNumber || plotId}. Approval required.`,
      type: "plot_hold",
      referenceId: hold._id,
      referenceModel: "PlotHold",
    });

    if (!plot) {
      return res.status(404).json({
        message: "Plot not found",
      });
    }
    plot.plotType = "HOLD";
    await colonyData.save();
    res.json({
      success: true,
      hold,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.getHolds = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    let query = {};

    if (user.role === "admin" || user.role === "staff") {
      // Admin & Staff -> see all holds
      query = {};
    } else if (user.role === "agent") {
      // Agent -> only holds created by themselves
      query = {
        agent: user._id,
      };
    } else if (user.role === "user") {
      // Customer/User -> only their own holds
      query = {
        customer: user._id,
      };
    }

    const holds = await PlotHold.find(query)
      .populate("colony", "name")
      .populate("customer", "name phone")
      .populate("agent", "name phone")
      .sort({ createdAt: -1 });

    res.json(holds);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.getSettings = async (req, res) => {
  try {
    let settings = await HoldSetting.findOne();

    // Create default if not exists
    if (!settings) {
      settings = await HoldSetting.create({
        freeHoldDays: 3,
        paidHoldDays: 15,
        paidAmount: 1000,
      });
    }

    res.json(settings);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { freeHoldDays, paidHoldDays, paidAmount } = req.body;

    let settings = await HoldSetting.findOne();

    if (!settings) {
      settings = await HoldSetting.create({
        freeHoldDays,
        paidHoldDays,
        paidAmount,
      });
    } else {
      settings.freeHoldDays = freeHoldDays;
      settings.paidHoldDays = paidHoldDays;
      settings.paidAmount = paidAmount;

      await settings.save();
    }

    res.json({
      success: true,
      settings,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

exports.holdAction = async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (admin.role !== "admin" && admin.role !== "staff") {
      return res.status(403).json({
        message: "Only admin can approve/reject holds",
      });
    }

    const { action, remarks } = req.body;
    const hold = await PlotHold.findById(req.params.id);

    if (!hold) {
      return res.status(404).json({
        message: "Hold not found",
      });
    }

    const colony = await Colony.findById(hold.colony);

    if (!colony) {
      return res.status(404).json({
        message: "Colony not found",
      });
    }

    const plot = colony.layout.plots.id(hold.plotId);

    if (!plot) {
      return res.status(404).json({
        message: "Plot not found",
      });
    }

    const setting = await HoldSetting.findOne();
    switch (action) {
      case "approve": {
        hold.status = "ACTIVE";
        if (hold.holdType === "PAID") {
          const Payment = require("../models/Payment");
          await Payment.create({
            booking: null,
            customer: hold.customer,
            agent: hold.agent,
            amount: hold.amount,
            paymentType: "hold",
            paymentMode: "cash", // or whatever mode you store
            status: "approved",
            approvedBy: admin._id,
            createdBy: admin._id,
            hold: hold._id,
            isHoldPayment: true,
            paymentDate: new Date(),
            receiptNo: await generateReceiptNo(),
            mlmProcessed: false,
          });
        }
        hold.approvedBy = admin._id;
        hold.approvedAt = new Date();
        hold.remarks = remarks || "";
        const expires = new Date();
        expires.setDate(
          expires.getDate() +
            (hold.holdType === "FREE"
              ? setting.freeHoldDays
              : setting.paidHoldDays),
        );
        hold.expiresAt = expires;
        plot.plotType = "HOLD";
        await notifyUser({
          user: hold.agent,
          sender: admin._id,
          title: "Plot Hold Approved",
          message: `Your ${hold.holdType} hold request has been approved.`,
          type: "plot_hold",
          referenceId: hold._id,
          referenceModel: "PlotHold",
        });
        break;
      }

      case "reject": {
        hold.status = "REJECTED";
        hold.approvedBy = admin._id;
        hold.approvedAt = new Date();
        hold.remarks = remarks || "";
        plot.plotType = "FOR_SALE";
        await notifyUser({
          user: hold.agent,
          sender: admin._id,
          title: "Plot Hold Rejected",
          message: `Your plot hold request has been rejected.`,
          type: "plot_hold",
          referenceId: hold._id,
          referenceModel: "PlotHold",
        });
        break;
      }

      case "release": {
        hold.status = "RELEASED";
        hold.releasedAt = new Date();
        hold.remarks = remarks || "";
        plot.plotType = "FOR_SALE";
        await notifyUser({
          user: hold.agent,
          sender: admin._id,
          title: "Plot Hold Released",
          message: `Your plot hold has been released.`,
          type: "plot_hold",
          referenceId: hold._id,
          referenceModel: "PlotHold",
        });
        break;
      }

      default:
        return res.status(400).json({
          message: "Invalid action",
        });
    }

    await hold.save();
    await colony.save();

    res.json({
      success: true,
      hold,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
