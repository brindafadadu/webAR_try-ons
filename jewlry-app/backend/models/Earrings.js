const mongoose = require("mongoose");

const EarringSchema = new mongoose.Schema({
  name: String,
  originalImageUrl: String,
  processedImageUrl: String, 
});

module.exports = mongoose.model("Earring", EarringSchema);