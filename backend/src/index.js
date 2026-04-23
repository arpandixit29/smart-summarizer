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

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      const allowedOrigins = new Set([
        process.env.CLIENT_ORIGIN || "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
      ]);

      if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${requestOrigin}`));
    },
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Smart summarizer API is running" });
});

app.use("/api/summarize", summarizeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", historyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

connectDB().catch((error) => {
  console.error("MongoDB is not connected. Auth/history routes will fail until fixed:", error.message);
});
