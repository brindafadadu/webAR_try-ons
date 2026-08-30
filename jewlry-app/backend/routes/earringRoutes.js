const express = require("express");
const multer = require("multer");
const Earring = require("../models/Earrings");
const {removeBackground} = require("../utils/imageProcessor");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Proper multer configuration
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    // Create the uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, '..', 'public', 'images', 'uploads');
    
    console.log(`Upload directory: ${uploadDir}`);
    
    if (!fs.existsSync(uploadDir)) {
      console.log(`Creating upload directory: ${uploadDir}`);
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`Created directory: ${uploadDir}`);
      } catch (err) {
        console.error(`Error creating directory ${uploadDir}:`, err);
        return cb(err);
      }
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Generate a unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = 'earring-' + uniqueSuffix + extension;
    
    console.log(`Generated filename: ${filename}`);
    cb(null, filename);
  }
});

const fileFilter = function(req, file, cb) {
  // Accept only image files
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  
  console.log(`File upload attempt: ${file.originalname}`);
  console.log(`Mimetype: ${file.mimetype}, valid: ${mimetype}`);
  console.log(`Extension: ${path.extname(file.originalname).toLowerCase()}, valid: ${extname}`);
  
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed!'));
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  }
});
router.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const uploadedFile = req.file;
    const filename = uploadedFile.filename;
    const originalPath = uploadedFile.path;

    const earringName = req.body.name || 'Uploaded Earring';

    console.log("File uploaded: ", {
      name: earringName,
      filename: filename,
      originalPath: originalPath
    });
    
    const processedDir = path.join(__dirname, "..", "public", "images", "processed");
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }
    
    // Set output path for processed image
    const outputPath = path.join(processedDir, `nobg_${filename}`);
    
    // Process the image
    await removeBackground(originalPath, outputPath);
    
    // Create relative paths for storage in the database
    const originalRelativePath = `/images/uploads/${filename}`;  // Fixed: using filename instead of imagePath
    const processedRelativePath = `/images/processed/nobg_${filename}`;
    
    // Save to database
    const newEarring = new Earring({
      name: earringName,
      originalImageUrl: originalRelativePath,
      processedImageUrl: processedRelativePath
    });
    
    await newEarring.save();
    res.status(201).json(newEarring);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get all earrings
router.get("/api/earrings", async (req, res) => {
  try {
    const earrings = await Earring.find();
    res.status(200).json(earrings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;