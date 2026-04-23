const express = require("express");

const Summary = require("../models/Summary");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/save-summary", authMiddleware, async (req, res, next) => {
  try {
    const { type, input, summary, metadata } = req.body;

    if (!type || !input || !summary) {
      return res.status(400).json({
        success: false,
        error: "type, input, and summary are required.",
      });
    }

    const created = await Summary.create({
      userId: req.user.id,
      type,
      input,
      summary,
      metadata: metadata || {},
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

router.get("/history", authMiddleware, async (req, res, next) => {
  try {
    const history = await Summary.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
