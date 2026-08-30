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

// Function to list all earrings
async function listAllEarrings() {
  try {
    const earrings = await Earring.find();
    console.log('\n=== All Earrings ===');
    earrings.forEach((earring, index) => {
      console.log(`${index + 1}. ID: ${earring._id}, Name: ${earring.name}`);
    });
    console.log(`Total: ${earrings.length} earrings found\n`);
  } catch (error) {
    console.error('Error listing earrings:', error);
  }
}

// Function to delete an earring by ID
async function deleteEarringById(id) {
  try {
    const result = await Earring.findByIdAndDelete(id);
    if (result) {
      console.log(`Successfully deleted earring: ${result.name} (ID: ${result._id})`);
    } else {
      console.log(`No earring found with ID: ${id}`);
    }
  } catch (error) {
    console.error(`Error deleting earring with ID ${id}:`, error);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];
const id = args[1];

async function run() {
  if (command === 'list') {
    await listAllEarrings();
    mongoose.disconnect();
  } else if (command === 'delete' && id) {
    await deleteEarringById(id);
    mongoose.disconnect();
  } else {
    console.log('Usage:');
    console.log('  node delete-earring.js list        - List all earrings');
    console.log('  node delete-earring.js delete [id] - Delete earring by ID');
    mongoose.disconnect();
  }
}

run();