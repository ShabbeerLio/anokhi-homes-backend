const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Festival = require("../models/Festival");
const Event = require("../models/Event");
const fetchuser = require("../middleware/fetchUser");
const festivalTemplate = require("../utils/festivalTemplate");
const IncomeHistory = require("../models/IncomeHistory");
const BirthdaySetting = require("../models/BirthdaySetting");

/* ---------------- helpers ---------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, "0");

// "today" as YYYY-MM-DD in Indian time, regardless of server timezone
const todayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// dob is a String in the User schema. Supports "YYYY-MM-DD" (date input)
// and "DD-MM-YYYY" / "DD/MM/YYYY" / "DD.MM.YYYY" (day first).
const parseDob = (dob) => {
  if (!dob) return null;
  const s = String(dob).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { month: +m[2], day: +m[3] };
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return { month: +m[2], day: +m[1] };
  return null;
};

const adminOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("role");
    if (!user || user.role !== "admin")
      return res.status(403).json({ message: "Admin only" });
    req.admin = user;
    next();
  } catch (e) {
    res.status(500).send("Server Error");
  }
};

const inr = (n) =>
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// A batch formed on/after the 15th is shown until the last day of that month.
// A batch formed before the 15th (i.e. the 1st) is shown until the 15th.
const bestPerformerExpiry = (day) => {
  const [y, m, d] = day.split("-").map(Number);
  if (d >= 15) return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
  return `${y}-${pad(m)}-15`;
};

// Create the festival rows for a year if they don't exist yet
const ensureFestivals = async (year) => {
  const existing = await Festival.find({ year }).select("name");
  const have = new Set(existing.map((f) => f.name));
  const missing = festivalTemplate
    .filter((f) => !have.has(f.name))
    .map((f) => ({
      name: f.name,
      emoji: f.emoji,
      year,
      date: `${year}-${pad(f.month)}-${pad(f.day)}`,
      confirmed: f.confirmed,
    }));
  if (missing.length) await Festival.insertMany(missing, { ordered: false });
};

/* =====================================================
   MODAL FEED FOR THE LOGGED-IN USER
   Order: birthday -> festival(s) -> events
===================================================== */
router.get("/today", fetchuser, async (req, res) => {
  try {
    const today = todayIST();
    const year = Number(today.slice(0, 4));
    const user = await User.findById(req.user.id).select("name dob");
    if (!user) return res.status(404).json({ message: "User not found" });

    const items = [];
    // 1) Birthday — only for the person whose birthday it is
    const dob = parseDob(user.dob);
    if (dob && today.slice(5) === `${pad(dob.month)}-${pad(dob.day)}`) {
      const bdaySetting = await BirthdaySetting.findOne({
        key: "default",
      }).select("image");
      items.push({
        type: "birthday",
        label: "Birthday wish",
        emoji: "🎂",
        title: `Happy Birthday, ${user.name}!`,
        message:
          "Wishing you a year full of good health, happiness and great success. Thank you for being part of the team.",
        image: bdaySetting?.image || "",
      });
    }

    // 2) Festivals — visible to everyone
    await ensureFestivals(year);
    const festivals = await Festival.find({ date: today, isActive: true });
    festivals.forEach((f) =>
      items.push({
        type: "festival",
        label: "Festival wish",
        emoji: f.emoji,
        title: `Happy ${f.name}!`,
        message:
          f.message ||
          `Wishing you and your family a joyful ${f.name}. May it bring happiness and prosperity.`,
        image: f.image || "",
      }),
    );
    // 2b) Best performer — visible to everyone until the batch expires
    try {
      const latest = await IncomeHistory.findOne({
        type: "best_performance_income",
      })
        .sort({ createdAt: -1 })
        .select("createdAt");

      if (latest) {
        // the day (IST) the latest best-performer batch was created
        const batchDay = latest.createdAt.toLocaleDateString("en-CA", {
          timeZone: "Asia/Kolkata",
        });

        if (today >= batchDay && today <= bestPerformerExpiry(batchDay)) {
          const rows = await IncomeHistory.find({
            type: "best_performance_income",
            createdAt: {
              $gte: new Date(`${batchDay}T00:00:00+05:30`),
              $lte: new Date(`${batchDay}T23:59:59.999+05:30`),
            },
          }).populate("user", "name referralId");

          // one entry per winner (sum if they have more than one row)
          const winners = {};
          rows.forEach((r) => {
            if (!r.user) return;
            const id = String(r.user._id);
            if (!winners[id]) winners[id] = { user: r.user, amount: 0 };
            winners[id].amount += r.amount || 0;
          });
          const list = Object.values(winners);

          if (list.length) {
            const mine = winners[String(user._id)];
            const names = list
              .map((w) => `${w.user.name} (${w.user.referralId})`)
              .join(", ");

            items.push({
              type: "best_performer",
              label: "Best performer",
              emoji: "🏆",
              title: mine
                ? "Congratulations, you are the Best Performer!"
                : "Best Performer of the Cycle",
              message: mine
                ? `You earned ₹${inr(mine.amount)} as Best Performance Income. Thank you for your outstanding work.`
                : `Congratulations to ${names} for being the Best Performer. Keep going, you could be next!`,
            });
          }
        }
      }
    } catch (e) {
      console.log("best performer feed error", e); // never block birthday/festival/events
    }

    // 3) Admin events — all, or only if this user was selected
    const events = await Event.find({
      isActive: true,
      date: { $lte: today },
      endDate: { $gte: today },
      $or: [{ audience: "all" }, { audience: "selected", viewers: user._id }],
    }).sort({ date: 1 });
    events.forEach((e) =>
      items.push({
        type: "event",
        label: "Event",
        emoji: "📣",
        title: e.title,
        message: e.message,
        image: e.image,
        date: e.date,
        endDate: e.endDate,
      }),
    );

    res.json({ today, items });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =====================================================
   FESTIVALS (admin) — list a year, edit date / message
===================================================== */
router.get("/festivals", fetchuser, adminOnly, async (req, res) => {
  try {
    const year = Number(req.query.year) || Number(todayIST().slice(0, 4));
    await ensureFestivals(year);
    const festivals = await Festival.find({ year }).sort({ date: 1 });
    res.json(festivals);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.post("/festivals", fetchuser, adminOnly, async (req, res) => {
  try {
    const { name, date, emoji, message, image } = req.body;
    if (!name || !DATE_RE.test(date || ""))
      return res.status(400).json({ message: "Name and valid date required" });
    const festival = await Festival.create({
      name,
      date,
      emoji: emoji || "🎉",
      message: message || "",
      image: image || "",
      year: Number(date.slice(0, 4)),
      confirmed: true,
      updatedBy: req.admin._id,
    });
    res.json(festival);
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(400)
        .json({ message: "This festival already exists for that year" });
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/festivals/:id", fetchuser, adminOnly, async (req, res) => {
  try {
    const festival = await Festival.findById(req.params.id);
    if (!festival)
      return res.status(404).json({ message: "Festival not found" });

    const { date, message, isActive, emoji, image } = req.body;

    if (date !== undefined) {
      if (!DATE_RE.test(date))
        return res.status(400).json({ message: "Invalid date" });
      // keep the record inside its own year
      if (Number(date.slice(0, 4)) !== festival.year)
        return res
          .status(400)
          .json({ message: `Date must be in ${festival.year}` });
      festival.date = date;
      festival.confirmed = true; // admin has verified it
    }
    if (message !== undefined) festival.message = message;
    if (emoji !== undefined) festival.emoji = emoji;
    if (image !== undefined) festival.image = image;
    if (isActive !== undefined) festival.isActive = !!isActive;
    festival.updatedBy = req.admin._id;

    await festival.save();
    res.json(festival);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.get("/birthday", fetchuser, adminOnly, async (req, res) => {
  try {
    const s = await BirthdaySetting.findOne({ key: "default" });
    res.json({ image: s?.image || "" });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/birthday", fetchuser, adminOnly, async (req, res) => {
  try {
    const image = typeof req.body.image === "string" ? req.body.image : "";
    const s = await BirthdaySetting.findOneAndUpdate(
      { key: "default" },
      { image, updatedBy: req.admin._id },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.json({ image: s.image });
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

/* =====================================================
   AGENTS LIST (for the "selected agents" picker)
===================================================== */
router.get("/agents", fetchuser, adminOnly, async (req, res) => {
  try {
    const agents = await User.find({ role: "agent", status: "active" })
      .select("name referralId")
      .sort({ name: 1 });
    res.json(agents);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =====================================================
   EVENTS (admin CRUD)
===================================================== */
const cleanEventBody = (body) => {
  const { title, message, image, date, endDate, audience, viewers, isActive } =
    body;
  if (!title || !DATE_RE.test(date || ""))
    return { error: "Title and a valid start date are required" };
  const end = endDate || date;
  if (!DATE_RE.test(end) || end < date)
    return { error: "End date cannot be before start date" };
  const aud = audience === "selected" ? "selected" : "all";
  if (aud === "selected" && (!Array.isArray(viewers) || viewers.length === 0))
    return { error: "Select at least one agent" };
  return {
    data: {
      title,
      message: message || "",
      image: image || "",
      date,
      endDate: end,
      audience: aud,
      viewers: aud === "selected" ? viewers : [],
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
    },
  };
};

router.get("/", fetchuser, adminOnly, async (req, res) => {
  try {
    const events = await Event.find()
      .populate("viewers", "name referralId")
      .sort({ date: -1 });
    res.json(events);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.post("/", fetchuser, adminOnly, async (req, res) => {
  try {
    const { data, error } = cleanEventBody(req.body);
    if (error) return res.status(400).json({ message: error });
    const event = await Event.create({ ...data, createdBy: req.admin._id });
    res.json(event);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.put("/:id", fetchuser, adminOnly, async (req, res) => {
  try {
    const { data, error } = cleanEventBody(req.body);
    if (error) return res.status(400).json({ message: error });
    const event = await Event.findByIdAndUpdate(req.params.id, data, {
      new: true,
    });
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

router.delete("/:id", fetchuser, adminOnly, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted" });
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

module.exports = router;
