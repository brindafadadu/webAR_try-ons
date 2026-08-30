const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// MongoDB connection 
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Import the Earring model
const Earring = require('../models/Earrings');

// Main function to remove duplicates
async function cleanupDuplicates() {
  try {
    console.log('Looking for duplicate earrings...');
    
    // Find all earrings
    const earrings = await Earring.find();
    console.log(`Found ${earrings.length} total earrings in database`);
    
    // Create a map to track unique names
    const uniqueNames = new Map();
    const duplicateIds = [];
    
    // Find duplicates
    earrings.forEach(earring => {
      if (uniqueNames.has(earring.name)) {
        duplicateIds.push(earring._id);
      } else {
        uniqueNames.set(earring.name, earring._id);
      }
    });
    
    console.log(`Found ${duplicateIds.length} duplicate earrings`);
    
    // Delete duplicates
    if (duplicateIds.length > 0) {
      const result = await Earring.deleteMany({ _id: { $in: duplicateIds } });
      console.log(`Deleted ${result.deletedCount} duplicate earrings`);
    } else {
      console.log('No duplicates found');
    }
    
    // Disconnect from MongoDB
    mongoose.disconnect();
    
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    mongoose.disconnect();
  }
}

// Run cleanup
cleanupDuplicates();