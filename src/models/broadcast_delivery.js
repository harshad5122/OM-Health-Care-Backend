const mongoose = require("mongoose");

const BroadcastDeliverySchema = new mongoose.Schema({
  message_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "message", 
    required: true 
  },
  receiver_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "users", 
    required: true 
  },
  status: { 
    type: String, 
    enum: ["sent", "delivered", "read"], 
    default: "sent" 
  },
  created_at: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model("broadcastdeliveries", BroadcastDeliverySchema);
