const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
const summarizeRoutes = require("./routes/summarizeRoutes");
const authRoutes = require("./routes/authRoutes");
const historyRoutes = require("./routes/historyRoutes");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ FIXED CORS
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://smart-summarizer-pearl.vercel.app", // ✅ correct frontend URL
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ Health check
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Smart summarizer API is running" });
});

// Routes
app.use("/api/summarize", summarizeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", historyRoutes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// DB connect
connectDB().catch((error) => {
  console.error(
    "MongoDB is not connected. Auth/history routes will fail until fixed:",
    error.message
  );
});
