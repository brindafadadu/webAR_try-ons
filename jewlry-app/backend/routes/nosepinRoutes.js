const express = require("express");
const multer = require("multer");
const NosePin = require("../models/nosepin");
const { removeBackground, normalizeEarringImage } = require("../utils/imageProcessor");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'public', 'images', 'nosepins', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = 'nosepin-' + uniqueSuffix + extension;
    cb(null, filename);
  }
});

const fileFilter = function (req, file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed!'));
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/api/upload-nosepin', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFile = req.file;
    const filename = uploadedFile.filename;
    const originalPath = uploadedFile.path;
    const nosePinName = req.body.name || 'Uploaded Nose Pin';

    const processedDir = path.join(__dirname, "..", "public", "images", "nosepins", "processed");
    if (!fs.existsSync(processedDir)) {
      fs.mkdirSync(processedDir, { recursive: true });
    }

    const noBgPath = path.join(processedDir, `nobg_${filename}`);
    const normalizedFilename = `norm_${path.parse(filename).name}.png`;
    const outputPath = path.join(processedDir, normalizedFilename);

    await removeBackground(originalPath, noBgPath);
    await normalizeEarringImage(noBgPath, outputPath);

    const originalRelativePath = `/images/nosepins/uploads/${filename}`;
    const processedRelativePath = `/images/nosepins/processed/${normalizedFilename}`;

    const newNosePin = new NosePin({
      name: nosePinName,
      originalImageUrl: originalRelativePath,
      processedImageUrl: processedRelativePath
    });

    await newNosePin.save();
    res.status(201).json(newNosePin);
  } catch (err) {
    console.error("Nose pin upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/nosepins", async (req, res) => {
  try {
    const nosepins = await NosePin.find();
    res.status(200).json(nosepins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;