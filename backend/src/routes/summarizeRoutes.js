const express = require("express");
const multer = require("multer");

const {
  summarizeDocument,
  summarizeVideo,
  followUpOnSummary,
} = require("../services/summarizerService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        "Unsupported file type. Please upload PDF, TXT, or MD documents only."
      )
    );
  },
});

router.post("/document", upload.single("file"), async (req, res, next) => {
  try {
    const response = await summarizeDocument({
      file: req.file,
      text: req.body.text,
      length: req.body.length,
      format: req.body.format,
      language: req.body.language,
      preset: req.body.preset,
      tone: req.body.tone,
      depth: req.body.depth,
      audience: req.body.audience,
    });

    res.json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
});

router.post("/video", async (req, res, next) => {
  try {
    const response = await summarizeVideo({
      youtubeUrl: req.body.youtubeUrl,
      length: req.body.length,
      format: req.body.format,
      language: req.body.language,
      preset: req.body.preset,
      tone: req.body.tone,
      depth: req.body.depth,
      audience: req.body.audience,
    });

    res.json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
});

router.post("/followup", async (req, res, next) => {
  try {
    const response = await followUpOnSummary({
      contextText: req.body.contextText,
      question: req.body.question,
      language: req.body.language,
    });

    res.json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
