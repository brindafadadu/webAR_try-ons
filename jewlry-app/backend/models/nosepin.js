const mongoose = require("mongoose");

const NosePinSchema = new mongoose.Schema({
  name: String,
  originalImageUrl: String,
  processedImageUrl: String,
});

module.exports = mongoose.model("NosePin", NosePinSchema);