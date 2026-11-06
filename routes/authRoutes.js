const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const RankSlab = require("../models/RankSlab");
const { login, register } = require("../controllers/authController");
const fetchuser = require("../middleware/fetchUser");
const User = require("../models/User");
const StaffRole = require("../models/StaffRole");
const distributeLevelIncome = require("../mlmController/distributeLevelIncome");
const IncomeHistory = require("../models/IncomeHistory");
const getTeamTree = require("../utils/getTeamTree");
const { sendOtp } = require("../controllers/sendOtp");
const { verifyOtp } = require("../controllers/verifyOtp");
const Lead = require("../models/Lead");
const SiteVisit = require("../models/SiteVisit");
const Booking = require("../models/Booking");
const Colony = require("../models/Colony");
const Payment = require("../models/Payment");

/* AUTH */
const syncFromSource = require("../utils/syncFromSource");

router.post("/sync-data", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id).select("role");
    if (!loggedUser || loggedUser.role !== "admin") {
      return res.status(403).json({ msg: "Only admin can sync data" });
    }

    const { collections, mirrorDeletes, dryRun } = req.body;
    const report = await syncFromSource({ collections, mirrorDeletes, dryRun });

    res.json({ success: true, report });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Sync failed", error: error.message });
  }
});

router.post("/login", login);
router.post("/register", register);

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/create-user", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (!["admin", "agent"].includes(loggedUser.role)) {
      return res.status(403).json({
        msg: "You are not authorized to create users",
      });
    }

    const {
      name,
      email,
      phone,
      password,
      role,
      staffRole,

      // MLM
      referralId,
      position,

      // EXTRA
      address,
      panNumber,
      panPhoto,
      aadharNumber,
      aadharPhoto,

      bankName,
      accountNumber,
      ifsc,

      nomineeName,
      nomineeRelation,
      nomineeAadharNumber,
      nomineeAadharPhoto,
    } = req.body;

    if (loggedUser.role === "agent" && role !== "user") {
      return res.status(403).json({
        msg: "Agents can only create customers.",
      });
    }

    let existingUser = await User.findOne({
      email,
    });

    if (existingUser) {
      return res.status(400).json({
        msg: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      staffRole,
      status: role === "user" ? "active" : "approval",
      createdBy: loggedUser._id,

      address,

      panNumber,
      panPhoto,

      aadharNumber,
      aadharPhoto,

      bankName,
      accountNumber,
      ifsc,

      nomineeName,
      nomineeRelation,
      nomineeAadharNumber,
      nomineeAadharPhoto,

      designation:
        role === "admin"
          ? "Executive Director"
          : role === "agent"
            ? "Sales Executive"
            : "",
      level: role === "admin" ? 16 : role === "agent" ? 1 : "",
      directIncomePercent: role === "admin" ? 20 : role === "agent" ? 5 : "",

      // designation:
      //   role === "admin"
      //     ? "Executive Director"
      //     : role === "staff"
      //       ? ""
      //       : "Sales Executive",
      // level: role === "admin" ? 16 : role === "staff" ? "" : 1,
      // directIncomePercent: role === "admin" ? 20 : role === "staff" ? "" : 5,
    });

    if (role === "agent") {
      // referralId required for agent
      if (!referralId) {
        return res.status(400).json({
          msg: "Referral ID is required",
        });
      }

      // position required
      if (position !== "left" && position !== "right") {
        return res.status(400).json({
          msg: "Position must be left or right",
        });
      }

      // find parent
      const parentUser = await User.findOne({
        referralId,
      });

      if (!parentUser) {
        return res.status(400).json({
          msg: "Invalid referral ID",
        });
      }

      // assign hierarchy
      user.parent = parentUser._id;
      user.referredBy = parentUser._id;
      user.position = position;
      user.level = 1;

      // max 16 level
      if (user.level > 16) {
        return res.status(400).json({
          msg: "Maximum level reached",
        });
      }
    }

    await user.save();

    if (role === "agent") {
      const parentUser = await User.findById(user.parent);

      if (user.position === "left") {
        parentUser.leftChildren.push(user._id);
      }

      if (user.position === "right") {
        parentUser.rightChildren.push(user._id);
      }
      parentUser.directTeam += 1;
      parentUser.totalTeam += 1;
      await parentUser.save();
    }

    const finalUser = await User.findById(user._id).select("-password");

    res.json({
      msg: "User created successfully",
      user: finalUser,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send("Internal Server Error");
  }
});

router.put("/change-password", fetchuser, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id);

  const matched = await bcrypt.compare(currentPassword, user.password);

  if (!matched) {
    return res.status(400).json({
      message: "Current password is incorrect",
    });
  }

  const salt = await bcrypt.genSalt(10);

  user.password = await bcrypt.hash(newPassword, salt);

  await user.save();

  res.json({
    success: true,
    message: "Password updated",
  });
});

router.get("/referral/:referralId", async (req, res) => {
  try {
    const user = await User.findOne({
      referralId: req.params.referralId,
      role: {
        $in: ["admin", "agent"],
      },
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        msg: "Agent not found",
      });
    }

    res.json(user);
  } catch (error) {
    console.log(error);

    res.status(500).send("Internal Server Error");
  }
});

router.put("/approval/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (loggedUser.role !== "admin") {
      return res.status(403).json({
        msg: "Only admin can approve users",
      });
    }

    const { status } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    // PREVIOUS STATUS
    const oldStatus = user.status;

    // UPDATE STATUS
    user.status = status;

    await user.save();

    // ONLY WHEN AGENT BECOMES ACTIVE
    if (
      oldStatus !== "active" &&
      status === "active" &&
      user.role === "agent"
    ) {
      await distributeLevelIncome(user._id);
    }

    res.json({
      msg: "Status updated successfully",
      user,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send("Internal server error");
  }
});

router.put("/status/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    // ONLY ADMIN OR STAFF
    if (loggedUser.role !== "admin" && loggedUser.role !== "staff") {
      return res.status(403).json({
        msg: "Only admin or staff can change status",
      });
    }

    const { status } = req.body;

    // ALLOW ONLY active / inactive
    if (status !== "active" && status !== "inactive") {
      return res.status(400).json({
        msg: "Status must be active or inactive",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    // DO NOT ALLOW approval HERE
    if (user.status === "approval") {
      return res.status(400).json({
        msg: "User is pending approval. Use approval route first.",
      });
    }

    user.status = status;

    await user.save();

    res.json({
      msg: `User ${status} successfully`,
      user,
    });
  } catch (error) {
    console.log(error);

    res.status(500).send("Internal server error");
  }
});

/* GET LOGGED IN USER */
router.post("/getuser", fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId)
      .select("-password")
      .populate(
        "referredBy",
        "name phone email referralId designation directIncomePercent level wallet totalIncome",
      )
      .populate(
        "parent",
        "name phone email referralId designation directIncomePercent level wallet totalIncome",
      )
      .populate(
        "leftChildren",
        "name phone email referralId designation directIncomePercent level wallet totalIncome",
      )
      .populate(
        "rightChildren",
        "name phone email referralId designation directIncomePercent level wallet totalIncome",
      )
      .populate("staffRole", "name ");

    res.send(user);
  } catch (error) {
    console.error(error.message);

    res.status(500).send("Internal server Error");
  }
});

/* ===========================
   GET ALL USERS
=========================== */

router.get("/all-users", fetchuser, async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("referredBy", "name phone email referralId designation")
      .populate("parent", "name phone email referralId designation")
      .populate("staffRole", "name ");

    res.json(users);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
});

/* =========================================
   GET CONNECTED CUSTOMERS FOR AGENT
========================================= */

router.get("/my-connected-users", fetchuser, async (req, res) => {
  try {
    const agentId = req.user.id;

    // =========================================
    // CHECK LOGGED-IN USER
    // =========================================

    const agent = await User.findById(agentId).select(
      "_id name role referralId",
    );

    if (!agent) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    // Only agent can use this route
    if (agent.role !== "agent") {
      return res.status(403).json({
        msg: "Only agents can access connected customers",
      });
    }

    // =========================================
    // GET CUSTOMERS CREATED BY THIS AGENT
    // =========================================

    const createdUsers = await User.find({
      role: "user",
      createdBy: agentId,
    }).select("_id");

    // =========================================
    // GET LEADS FOR THIS AGENT, NEWEST FIRST
    // =========================================

    const leads = await Lead.find({
      agent: agentId,
      customer: { $ne: null },
    })
      .select("customer status createdAt")
      .sort({ createdAt: -1 });

    // =========================================
    // GET SITE VISITS FOR THIS AGENT, NEWEST FIRST
    // =========================================

    const siteVisits = await SiteVisit.find({
      agent: agentId,
      customer: { $ne: null },
    })
      .select("customer status createdAt")
      .sort({ createdAt: -1 });

    // =========================================
    // GET BOOKINGS FOR THIS AGENT, NEWEST FIRST
    // =========================================

    const bookings = await Booking.find({
      agent: agentId,
      customer: { $ne: null },
    })
      .select("customer status createdAt")
      .sort({ createdAt: -1 });

    // =========================================
    // COMBINE CUSTOMER IDS
    // =========================================

    const customerIds = [
      ...createdUsers.map((user) => user._id),
      ...leads.map((lead) => lead.customer),
      ...siteVisits.map((visit) => visit.customer),
      ...bookings.map((booking) => booking.customer),
    ];

    // =========================================
    // REMOVE DUPLICATES
    // =========================================

    const uniqueCustomerIds = [
      ...new Set(customerIds.map((id) => id.toString())),
    ];

    // =========================================
    // LATEST LEAD / SITE VISIT / BOOKING PER CUSTOMER
    // Each array is already sorted newest-first, so the FIRST
    // match found per customer is the latest.
    // =========================================

    const latestLeadByCustomer = {};
    for (const lead of leads) {
      const key = lead.customer.toString();
      if (!latestLeadByCustomer[key]) {
        latestLeadByCustomer[key] = {
          status: lead.status,
          date: lead.createdAt,
        };
      }
    }

    const latestSiteVisitByCustomer = {};
    for (const visit of siteVisits) {
      const key = visit.customer.toString();
      if (!latestSiteVisitByCustomer[key]) {
        latestSiteVisitByCustomer[key] = {
          status: visit.status,
          date: visit.createdAt,
        };
      }
    }

    const latestBookingByCustomer = {};
    for (const booking of bookings) {
      const key = booking.customer.toString();
      if (!latestBookingByCustomer[key]) {
        latestBookingByCustomer[key] = {
          status: booking.status,
          date: booking.createdAt,
        };
      }
    }

    // =========================================
    // COLLAPSE INTO ONE "STAGE" PER CUSTOMER
    // Funnel chain: lead -> site visit -> booking.
    // A booking implies the earlier stages already
    // happened, so it takes priority; site visit is
    // next; lead is the fallback if neither exists.
    // =========================================

    const stageByCustomer = {};

    for (const key of uniqueCustomerIds) {
      const booking = latestBookingByCustomer[key];
      const siteVisit = latestSiteVisitByCustomer[key];
      const lead = latestLeadByCustomer[key];

      if (booking) {
        stageByCustomer[key] = {
          type: "booking",
          status: booking.status,
          date: booking.date,
        };
      } else if (siteVisit) {
        stageByCustomer[key] = {
          type: "site_visit",
          status: siteVisit.status,
          date: siteVisit.date,
        };
      } else if (lead) {
        stageByCustomer[key] = {
          type: "lead",
          status: lead.status,
          date: lead.date,
        };
      } else {
        stageByCustomer[key] = null; // customer added directly, no funnel activity yet
      }
    }

    // =========================================
    // GET ONLY USERS
    // =========================================

    const users = await User.find({
      _id: {
        $in: uniqueCustomerIds,
      },
      role: "user",
    })
      .select("-password")
      .populate("createdBy", "name referralId designation");

    // =========================================
    // ATTACH STAGE PER CUSTOMER
    // =========================================

    const usersWithStage = users.map((user) => {
      const key = user._id.toString();

      return {
        ...user.toObject(),
        stage: stageByCustomer[key] || null,
      };
    });

    // =========================================
    // RESPONSE
    // =========================================

    return res.json({
      success: true,
      count: usersWithStage.length,
      users: usersWithStage,
    });
  } catch (error) {
    console.error("Get connected customers error:", error);

    return res.status(500).json({
      msg: "Internal Server Error",
      error: error.message,
    });
  }
});

/* ===========================
   GET USER BY ID
=========================== */

router.get("/user/:id", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate(
        "referredBy",
        "name phone email referralId designation directIncomePercent level wallet totalIncome",
      )
      .populate(
        "parent",
        "name phone email referralId designation directIncomePercent level wallet totalIncome",
      )
      .populate(
        "leftChildren",
        "name phone email referralId designation directIncomePercent level wallet totalIncome",
      )
      .populate(
        "rightChildren",
        "name phone email referralId designation directIncomePercent level wallet totalIncome",
      )
      .populate("staffRole");

    if (!user) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    res.json(user);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

/* ===========================
   GET user by role
=========================== */

router.get("/role/:role", fetchuser, async (req, res) => {
  try {
    const users = await User.find({ role: req.params.role }).select(
      "-password",
    );

    res.json(users);
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

router.put("/update/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    const targetUserId = req.params.id;

    // allow if self OR admin/staff
    if (
      loggedUser._id.toString() !== targetUserId &&
      loggedUser.role !== "admin" &&
      loggedUser.role !== "staff"
    ) {
      return res.status(403).json({
        msg: "Not allowed to update other users",
      });
    }

    const updateFields = {};

    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined) {
        updateFields[key] = req.body[key];
      }
    });

    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      updateFields,
      {
        new: true,
        runValidators: true,
      },
    ).select("-password");

    res.json(updatedUser);
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

router.delete("/delete/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (loggedUser.role !== "admin" && loggedUser.role !== "staff") {
      return res.status(403).json({
        msg: "Only admin or staff can delete users",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      msg: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

router.put("/status/:id", fetchuser, async (req, res) => {
  try {
    const { status } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );

    res.json(user);
  } catch (error) {
    res.status(500).send("Internal server error");
  }
});

router.put("/roles/permissions/:roleName", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (admin.role !== "admin") {
      return res.status(403).json({
        msg: "Only admin allowed",
      });
    }

    const { permissions } = req.body;

    const role = await StaffRole.findOneAndUpdate(
      { roleName: req.params.roleName },
      { permissions },
      { new: true, upsert: true },
    );

    res.json({
      msg: "Permissions updated successfully",
      role,
    });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/income-history", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    let query = {};
    if (loggedUser.role !== "admin") {
      query.user = req.user.id;
    }

    const histories = await IncomeHistory.find(query)
      .populate("user", "name email phone referralId designation")
      .populate("fromUser", "name email phone referralId designation")
      .populate({
        path: "from",
        select: "colony plot",
        populate: [{ path: "colony", select: "name" }],
      })
      .populate({
        path: "payment",
        select:
          "customer approvedBy paymentDate amount paymentType paymentMode booking hold",
        populate: [
          { path: "customer", select: "name phone email" },
          { path: "approvedBy", select: "name phone email" },
          {
            path: "booking",
            select: "colony plot plotArea pricePerSqft",
            populate: [{ path: "colony", select: "name category" }],
          },
          {
            path: "hold",
            select: "colony plotId",
            populate: [{ path: "colony", select: "name category" }],
          },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    // 1) collect every plot id referenced by bookings and holds
    const colonyIds = new Set();
    const plotIds = new Set();

    histories.forEach((h) => {
      const b = h.payment?.booking;
      const hd = h.payment?.hold;
      if (b?.colony?._id) colonyIds.add(b.colony._id.toString());
      if (b?.plot) plotIds.add(b.plot.toString());
      if (hd?.colony?._id) colonyIds.add(hd.colony._id.toString());
      if (hd?.plotId) plotIds.add(hd.plotId.toString());
    });

    // 2) one query: only the needed plots, only plotNumber + plotType (no points)
    const toOid = (id) => new mongoose.Types.ObjectId(id);

    const plotRows = plotIds.size
      ? await Colony.aggregate([
          { $match: { _id: { $in: [...colonyIds].map(toOid) } } },
          { $unwind: "$layout.plots" },
          {
            $match: {
              "layout.plots._id": { $in: [...plotIds].map(toOid) },
            },
          },
          {
            $project: {
              _id: 0,
              id: "$layout.plots._id",
              plotNumber: "$layout.plots.plotNumber",
              plotType: "$layout.plots.plotType",
            },
          },
        ])
      : [];

    const plotMap = new Map(
      plotRows.map((p) => [
        p.id.toString(),
        { plotNumber: p.plotNumber, plotType: p.plotType },
      ]),
    );
    // 3) attach the plot to each booking / hold (once per shared object)
    const done = new WeakSet();

    const attachPlot = (obj, idKey, outKey) => {
      if (!obj || done.has(obj)) return; // shared object already handled
      done.add(obj);
      const id = obj[idKey];
      obj[outKey] = id ? plotMap.get(id.toString()) || null : null;
    };

    const result = histories.map((h) => {
      attachPlot(h.payment?.booking, "plot", "plot");
      attachPlot(h.payment?.hold, "plotId", "plot");
      return h;
    });

    res.json(result);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal server error");
  }
});

router.get("/team-tree/:referralId", fetchuser, async (req, res) => {
  try {
    const rootUser = await User.findOne({
      referralId: req.params.referralId,
    });

    if (!rootUser) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    const tree = await getTeamTree(rootUser._id);

    res.json(tree);
  } catch (error) {
    console.log(error);

    res.status(500).send("Internal Server Error");
  }
});

router.get("/my-team-tree", fetchuser, async (req, res) => {
  try {
    const tree = await getTeamTree(req.user.id);

    res.json(tree);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

router.get("/ranks", fetchuser, async (req, res) => {
  try {
    const ranks = await RankSlab.find().sort({ level: 1 });

    res.json(ranks);
  } catch (err) {
    console.log(err);

    res.status(500).json({
      msg: "Internal Server Error",
    });
  }
});

router.put("/update-rank/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);

    if (!loggedUser) {
      return res.status(404).json({
        msg: "Admin not found",
      });
    }

    if (loggedUser.role !== "admin") {
      return res.status(403).json({
        msg: "Only admin can update designation",
      });
    }

    const { level } = req.body;

    // Find rank slab from MongoDB
    const rank = await RankSlab.findOne({
      level: Number(level),
    });

    // console.log("Selected Rank:", rank);

    if (!rank) {
      return res.status(400).json({
        msg: "Invalid level",
      });
    }

    // Find agent
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    if (user.role !== "agent") {
      return res.status(400).json({
        msg: "Only agents have ranks",
      });
    }

    // Update agent according to RankSlab
    user.level = rank.level;
    user.designation = rank.designation;
    user.directIncomePercent = rank.directIncome;

    // Admin manually assigned this rank
    user.rankType = "manual";

    await user.save();

    return res.json({
      success: true,
      msg: "Rank updated successfully",
      user,
    });
  } catch (err) {
    console.error("Update agent rank error:", err);

    return res.status(500).json({
      msg: "Internal Server Error",
      error: err.message,
    });
  }
});

router.put("/update-rank-slab/:level", fetchuser, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({
        msg: "Admin not found",
      });
    }

    if (admin.role !== "admin") {
      return res.status(403).json({
        msg: "Only admin can update rank slabs",
      });
    }

    const level = Number(req.params.level);

    const { min, max, directIncome, designation } = req.body;

    const rank = await RankSlab.findOne({ level });

    if (!rank) {
      return res.status(404).json({
        msg: "Rank slab not found",
      });
    }

    // =========================
    // VALIDATION
    // =========================

    if (min === undefined || min === null || Number(min) < 0) {
      return res.status(400).json({
        msg: "Valid minimum business is required",
      });
    }

    if (!designation || !designation.trim()) {
      return res.status(400).json({
        msg: "Designation is required",
      });
    }

    if (
      directIncome === undefined ||
      directIncome === null ||
      Number(directIncome) < 0 ||
      Number(directIncome) > 100
    ) {
      return res.status(400).json({
        msg: "Direct income must be between 0 and 100",
      });
    }

    // =========================
    // MAXIMUM
    // =========================

    if (
      max !== undefined &&
      max !== null &&
      max !== "" &&
      max !== "Infinity" &&
      Number(max) <= Number(min)
    ) {
      return res.status(400).json({
        msg: "Maximum business must be greater than minimum business",
      });
    }

    // =========================
    // UPDATE
    // =========================

    rank.min = Number(min);

    if (max === undefined || max === null || max === "" || max === "Infinity") {
      rank.max = Infinity;
    } else {
      rank.max = Number(max);
    }

    rank.directIncome = Number(directIncome);
    rank.designation = designation.trim();

    await rank.save();

    res.json({
      success: true,
      msg: "Rank slab updated successfully",
      rank,
    });
  } catch (error) {
    console.log("Update rank slab error:", error);

    res.status(500).json({
      msg: "Internal Server Error",
    });
  }
});

router.get("/user-report/:id", fetchuser, async (req, res) => {
  try {
    const loggedUser = await User.findById(req.user.id);
    const targetId = req.params.id;

    // admin/staff can view anyone; everyone else only themselves
    const allowed =
      ["admin", "staff"].includes(loggedUser.role) ||
      loggedUser._id.toString() === targetId;

    if (!allowed) {
      return res.status(403).json({ msg: "Not allowed" });
    }

    const { type } = req.query;
    let data = [];

    const attachPlots = async (items, getColony, getPlotId, assign) => {
      const plotIds = new Set();
      const colonyIds = new Set();
      items.forEach((it) => {
        const c = getColony(it);
        const p = getPlotId(it);
        if (c?._id) colonyIds.add(c._id.toString());
        if (p) plotIds.add(p.toString());
      });
      if (!plotIds.size) return items;

      const toOid = (id) => new mongoose.Types.ObjectId(id);
      const rows = await Colony.aggregate([
        { $match: { _id: { $in: [...colonyIds].map(toOid) } } },
        { $unwind: "$layout.plots" },
        { $match: { "layout.plots._id": { $in: [...plotIds].map(toOid) } } },
        {
          $project: {
            _id: 0,
            id: "$layout.plots._id",
            plotNumber: "$layout.plots.plotNumber",
            plotType: "$layout.plots.plotType",
            area: "$layout.plots.area",
            price: "$layout.plots.price",
          },
        },
      ]);
      const map = new Map(rows.map((r) => [r.id.toString(), r]));
      items.forEach((it) =>
        assign(it, map.get(getPlotId(it)?.toString()) || null),
      );
      return items;
    };

    // ...inside the route, replacing the type branches:

    if (type === "leads") {
      // same scope as the agent view in the lead route: own leads + ones they rejected
      let leads = await Lead.find({
        $or: [{ agent: targetId }, { rejectedBy: targetId }],
      })
        .populate("agent", "name phone")
        .populate("notes.by", "name role")
        .sort({ createdAt: -1 })
        .lean();

      // same status mapping as GET /api/lead
      leads = leads.map((lead) => {
        let status = lead.status;

        if (lead.status === "lost" || lead.status === "converted") {
          status = lead.status;
        } else if (lead.agent && !lead.isAccepted && lead.assignedBy) {
          status = "new";
        } else if (lead.agent && lead.isAccepted) {
          status = "assigned";
        } else if (lead.rejectedBy?.toString() === targetId) {
          status = "rejected";
        } else if (!lead.agent && lead.status === "unassigned") {
          status = "missed";
        }

        return { ...lead, status };
      });

      // latest site visit per lead, latest booking per site visit
      const leadIds = leads.map((l) => l._id);

      const siteVisits = await SiteVisit.find({ lead: { $in: leadIds } })
        .select("lead status createdAt")
        .sort({ createdAt: -1 })
        .lean();

      const siteVisitByLead = {};
      for (const sv of siteVisits) {
        const key = sv.lead.toString();
        if (!siteVisitByLead[key]) siteVisitByLead[key] = sv;
      }

      const siteVisitIds = Object.values(siteVisitByLead).map((sv) => sv._id);

      const bookings = await Booking.find({
        sitevisitId: { $in: siteVisitIds },
      })
        .select("sitevisitId status createdAt")
        .sort({ createdAt: -1 })
        .lean();

      const bookingBySiteVisit = {};
      for (const b of bookings) {
        const key = b.sitevisitId.toString();
        if (!bookingBySiteVisit[key]) bookingBySiteVisit[key] = b;
      }

      data = leads.map((lead) => {
        const siteVisit = siteVisitByLead[lead._id.toString()] || null;
        const booking = siteVisit
          ? bookingBySiteVisit[siteVisit._id.toString()] || null
          : null;

        let currentStep;
        if (booking) currentStep = { step: "booking", status: booking.status };
        else if (siteVisit)
          currentStep = { step: "siteVisit", status: siteVisit.status };
        else currentStep = { step: "lead", status: lead.status };

        return { ...lead, currentStep };
      });
    } else if (type === "sitevisits") {
      data = await SiteVisit.find({ agent: targetId })
        .populate("customer", "name phone email")
        .populate("agent", "name phone")
        .populate("location", "name")
        .populate("colonies", "name")
        .populate("notes.by", "name role")
        .sort({ createdAt: -1 })
        .lean();
    } else if (type === "bookings") {
      data = await Booking.find({ agent: targetId })
        .populate("customer", "name phone")
        .populate("agent", "name phone")
        .populate("location", "name")
        .populate("colony", "name category layout.plots")
        .populate("notes.by", "name role")
        .sort({ createdAt: -1 })
        .lean();

      data.forEach((b) => {
        const plot = b.colony?.layout?.plots?.find(
          (p) => p._id.toString() === b.plot?.toString(),
        );
        if (plot) b.plot = plot;
      });
    } else if (type === "payments") {
      data = await Payment.find({ agent: targetId })
        .populate("customer", "name phone")
        .populate("agent", "name phone")
        .populate({
          path: "booking",
          populate: [
            { path: "location", select: "name" },
            { path: "colony", select: "name category layout.plots" },
          ],
        })
        .populate({
          path: "hold",
          populate: [{ path: "colony", select: "name layout.plots" }],
        })
        .sort({ createdAt: -1 })
        .lean();

      data.forEach((p) => {
        if (p.booking?.colony) {
          p.booking.plot = p.booking.colony.layout.plots.find(
            (x) => x._id.toString() === p.booking.plot?.toString(),
          );
        }
        if (p.hold?.colony) {
          p.hold.plot = p.hold.colony.layout.plots.find(
            (x) => x._id.toString() === p.hold.plotId?.toString(),
          );
        }
      });
    } else if (type === "income") {
      data = await IncomeHistory.find({ user: targetId })
        .populate("user", "name email phone referralId designation")
        .populate("fromUser", "name email phone referralId designation")
        .populate({
          path: "payment",
          select:
            "customer approvedBy paymentDate amount paymentType paymentMode booking hold",
          populate: [
            { path: "customer", select: "name phone email" },
            { path: "approvedBy", select: "name phone email" },
            {
              path: "booking",
              select: "colony plot plotArea pricePerSqft",
              populate: [{ path: "colony", select: "name category" }],
            },
            {
              path: "hold",
              select: "colony plotId",
              populate: [{ path: "colony", select: "name category" }],
            },
          ],
        })
        .sort({ createdAt: -1 })
        .lean();

      await attachPlots(
        data.map((h) => h.payment?.booking).filter(Boolean),
        (b) => b.colony,
        (b) => b.plot,
        (b, plot) => (b.plot = plot),
      );
      await attachPlots(
        data.map((h) => h.payment?.hold).filter(Boolean),
        (h) => h.colony,
        (h) => h.plotId,
        (h, plot) => (h.plot = plot),
      );
    } else if (type === "summary") {
      const target = await User.findById(targetId).select(
        "selfBusiness leftBusiness rightBusiness totalBusiness",
      );

      if (!target) {
        return res.status(404).json({ msg: "User not found" });
      }

      const rows = await IncomeHistory.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(targetId) } },
        {
          $group: {
            _id: "$type",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);

      let totalIncome = 0;
      let referralIncome = 0;
      let transactions = 0;

      rows.forEach((r) => {
        totalIncome += r.total;
        transactions += r.count;
        if (r._id === "referal_income") referralIncome = r.total;
      });

      // admin/self views share this, so the same user always gets the same numbers
      return res.json({
        totalIncome,
        referralIncome,
        otherIncome: totalIncome - referralIncome,
        transactions,
        selfBusiness: target.selfBusiness || 0,
        leftBusiness: target.leftBusiness || 0,
        rightBusiness: target.rightBusiness || 0,
        totalBusiness: target.totalBusiness || 0,
      });
    } else {
      return res.status(400).json({ msg: "Invalid type" });
    }

    res.json(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
