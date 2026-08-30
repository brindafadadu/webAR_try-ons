
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { removeBackground } = require('./utils/imageProcessor');

// MongoDB connection string
const mongoUri = 'mongodb+srv://brinda1104:hi731yx@jewlry-try-on.6ofclhq.mongodb.net/';

// MongoDB schema
const EarringSchema = new mongoose.Schema({
  name: String,
  originalImageUrl: String,
  processedImageUrl: String
});

const Earring = mongoose.model('Earring', EarringSchema);

// Array of sample earrings
const earrings = [
  {
    name: 'Gold Hoops',
    filename: 'earrings2.png'
  },
  {
    name: 'Green Studs',
    filename: 'green_earrings.jpg'
  }
];

// Connect to MongoDB
console.log('Connecting to MongoDB...');
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
  processAndAddEarrings();
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Function to process images and add to database
async function processAndAddEarrings() {
  try {
    const processedDir = path.join(__dirname, 'public', 'images', 'processed');
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }
    
    for (const earring of earrings) {
      console.log(`Processing ${earring.name}...`);
      
      // Set paths
      const originalPath = path.join(__dirname, 'public', 'images', earring.filename);
      const outputPath = path.join(processedDir, `nobg_${earring.filename}`);
      
      // Check if original image exists
      if (!fs.existsSync(originalPath)) {
        console.error(`Warning: File does not exist: ${originalPath}`);
        continue;
      }
      
      // Process the image
      await removeBackground(originalPath, outputPath);
      
      // Create relative paths for storage in the database
      const originalRelativePath = `/images/${earring.filename}`;
      const processedRelativePath = `/images/processed/nobg_${earring.filename}`;
      
      // Save to MongoDB
      const newEarring = new Earring({
        name: earring.name,
        originalImageUrl: originalRelativePath,
        processedImageUrl: processedRelativePath
      });
      
      await newEarring.save();
      console.log(`Added ${earring.name} to database`);
    }
    
    console.log('All earrings processed and added to database');
    mongoose.disconnect();
  } catch (error) {
    console.error('Error processing earrings:', error);
    mongoose.disconnect();
  }
}