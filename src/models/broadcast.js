
const mongoose = require("mongoose");

const BroadcastSchema = new mongoose.Schema({
  title: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }], // Selected users
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("broadcast", BroadcastSchema);
