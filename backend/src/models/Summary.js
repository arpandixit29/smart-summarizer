const mongoose = require("mongoose");

const summarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
      index: true,
    },
    type: {
      type: String,
      enum: ["video", "document"],
      required: true,
    },
    input: {
      type: String,
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Summary", summarySchema);
