// routes/policyRoutes.js

const express = require("express");
const router = express.Router();

const Policy = require("../models/Policy");
const fetchuser = require("../middleware/fetchuser");

/* =========================
   GET ALL POLICIES
========================= */
router.get("/", async (req, res) => {
  try {
    const data = await Policy.find();
    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   GET BY TYPE (privacy, terms, refund)
========================= */
router.get("/:type", async (req, res) => {
  try {
    const data = await Policy.findOne({ type: req.params.type });
    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   ADD POLICY
========================= */
router.post("/add", fetchuser, async (req, res) => {
  try {
    const existing = await Policy.findOne({ type: req.body.type });

    if (existing) {
      return res.status(400).json({
        message: "Policy already exists",
      });
    }

    const data = await Policy.create(req.body);

    res.json(data);
  } catch (error) {
    res.status(500).send("Server Error");
  }
});

router.post("/add-section/:policyId", fetchuser, async (req, res) => {
  try {
    const { heading, content } = req.body;

    const policy = await Policy.findById(req.params.policyId);

    if (!policy) {
      return res.status(404).json({ message: "Policy not found" });
    }

    policy.sections.push({
      heading,
      content,
    });

    await policy.save();

    res.json({
      message: "Section added",
      sections: policy.sections,
    });

  } catch (error) {
    res.status(500).send("Server Error");
  }
});

/* =========================
   EDIT POLICY
========================= */
router.put(
  "/edit-section/:policyId/:sectionId",
  fetchuser,
  async (req, res) => {
    try {
      const { policyId, sectionId } = req.params;

      const policy = await Policy.findById(policyId);

      if (!policy) {
        return res.status(404).json({ message: "Policy not found" });
      }

      const section = policy.sections.id(sectionId);

      if (!section) {
        return res.status(404).json({ message: "Section not found" });
      }

      // 🔥 Update fields
      if (req.body.heading) section.heading = req.body.heading;
      if (req.body.content) section.content = req.body.content;

      await policy.save();

      res.json({
        message: "Section updated",
        section,
      });
    } catch (error) {
      res.status(500).send("Server Error");
    }
  },
);

/* =========================
   DELETE POLICY
========================= */
router.delete(
  "/delete-section/:policyId/:sectionId",
  fetchuser,
  async (req, res) => {
    try {
      const { policyId, sectionId } = req.params;

      const policy = await Policy.findById(policyId);

      if (!policy) {
        return res.status(404).json({ message: "Policy not found" });
      }

      const section = policy.sections.id(sectionId);

      if (!section) {
        return res.status(404).json({ message: "Section not found" });
      }

      // 🔥 Remove section
      section.deleteOne();

      await policy.save();

      res.json({
        message: "Section deleted successfully",
        sections: policy.sections,
      });
    } catch (error) {
      res.status(500).send("Server Error");
    }
  },
);

module.exports = router;
