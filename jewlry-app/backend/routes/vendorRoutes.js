const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Earring = require('../models/Earrings');
const NosePin = require('../models/nosepin');
const { removeBackground, normalizeEarringImage } = require('../utils/imageProcessor');

const router = express.Router();

// Multer storage for vendor uploads
const vendorStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = (req.body.category || 'earrings').toLowerCase();
    const subfolder = category === 'nosepin' || category === 'nosepins' ? 'nosepins/uploads' : 'uploads';
    const uploadDir = path.join(__dirname, '..', 'public', 'images', subfolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const category = (req.body.category || 'earrings').toLowerCase();
    const prefix = category.startsWith('nose') ? 'vendor-nosepin-' : 'vendor-earring-';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    cb(null, `${prefix}${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const mimetype = allowed.test(file.mimetype);
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  if (mimetype && ext) return cb(null, true);
  cb(new Error('Invalid image format. Supported formats: JPEG, PNG, WEBP, GIF'));
};

const upload = multer({
  storage: vendorStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

/**
 * @api {GET} /api/v1/vendor/catalog Get unified product catalog
 * @apiDescription Vendors call this endpoint to fetch all products ready for virtual try-on.
 * @apiParam {String} [category] Filter by 'earrings' or 'nosepins'
 */
router.get('/api/v1/vendor/catalog', async (req, res) => {
  try {
    const categoryFilter = (req.query.category || '').toLowerCase();
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    let items = [];

    if (!categoryFilter || categoryFilter === 'earrings' || categoryFilter === 'earring') {
      const earrings = await Earring.find().lean();
      items = items.concat(
        earrings.map(e => ({
          id: e._id,
          sku: e._id.toString().slice(-6).toUpperCase(),
          name: e.name,
          category: 'earrings',
          anchorType: 'dual_ear_lobes',
          originalImageUrl: `${baseUrl}${e.originalImageUrl}`,
          tryOnImageUrl: `${baseUrl}${e.processedImageUrl}`,
          embedUrl: `${baseUrl}/embed?id=${e._id}&category=earrings`
        }))
      );
    }

    if (!categoryFilter || categoryFilter === 'nosepins' || categoryFilter === 'nosepin') {
      const nosepins = await NosePin.find().lean();
      items = items.concat(
        nosepins.map(n => ({
          id: n._id,
          sku: n._id.toString().slice(-6).toUpperCase(),
          name: n.name,
          category: 'nosepins',
          anchorType: 'left_nostril',
          originalImageUrl: `${baseUrl}${n.originalImageUrl}`,
          tryOnImageUrl: `${baseUrl}${n.processedImageUrl}`,
          embedUrl: `${baseUrl}/embed?id=${n._id}&category=nosepins`
        }))
      );
    }

    res.status(200).json({
      success: true,
      apiVersion: '1.0',
      totalCount: items.length,
      items
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @api {GET} /api/v1/vendor/catalog/:category/:id Get single product details
 */
router.get('/api/v1/vendor/catalog/:category/:id', async (req, res) => {
  try {
    const { category, id } = req.params;
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    let item = null;
    let anchorType = 'dual_ear_lobes';

    if (category.startsWith('ear')) {
      item = await Earring.findById(id).lean();
    } else if (category.startsWith('nose')) {
      item = await NosePin.findById(id).lean();
      anchorType = 'left_nostril';
    } else {
      return res.status(400).json({ success: false, error: 'Category must be earrings or nosepins' });
    }

    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found in catalog' });
    }

    res.status(200).json({
      success: true,
      item: {
        id: item._id,
        sku: item._id.toString().slice(-6).toUpperCase(),
        name: item.name,
        category: category.startsWith('ear') ? 'earrings' : 'nosepins',
        anchorType,
        originalImageUrl: `${baseUrl}${item.originalImageUrl}`,
        tryOnImageUrl: `${baseUrl}${item.processedImageUrl}`,
        embedUrl: `${baseUrl}/embed?id=${item._id}&category=${category.startsWith('ear') ? 'earrings' : 'nosepins'}`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @api {POST} /api/v1/vendor/catalog/upload Vendor product upload & AI background removal
 * @apiDescription Vendors can programmatically add their jewelry SKUs. The backend automatically
 * runs background removal and returns transparent try-on assets.
 */
router.post('/api/v1/vendor/catalog/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Missing image file in multipart form-data' });
    }

    const category = (req.body.category || 'earrings').toLowerCase();
    const productName = req.body.name || 'Vendor Product';
    const uploadedFile = req.file;
    const filename = uploadedFile.filename;
    const originalPath = uploadedFile.path;
    const baseName = path.parse(filename).name;

    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    if (category.startsWith('nose')) {
      const processedDir = path.join(__dirname, '..', 'public', 'images', 'nosepins', 'processed');
      if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });

      const noBgPath = path.join(processedDir, `nobg_${baseName}.png`);
      const normalizedFilename = `norm_${baseName}.png`;
      const outputPath = path.join(processedDir, normalizedFilename);

      await removeBackground(originalPath, noBgPath);
      await normalizeEarringImage(noBgPath, outputPath);

      const originalRelative = `/images/nosepins/uploads/${filename}`;
      const processedRelative = `/images/nosepins/processed/${normalizedFilename}`;

      const newNosePin = new NosePin({
        name: productName,
        originalImageUrl: originalRelative,
        processedImageUrl: processedRelative
      });
      await newNosePin.save();

      return res.status(201).json({
        success: true,
        message: 'Nose pin successfully ingested and background removed',
        item: {
          id: newNosePin._id,
          sku: newNosePin._id.toString().slice(-6).toUpperCase(),
          name: newNosePin.name,
          category: 'nosepins',
          anchorType: 'left_nostril',
          originalImageUrl: `${baseUrl}${originalRelative}`,
          tryOnImageUrl: `${baseUrl}${processedRelative}`,
          embedUrl: `${baseUrl}/embed?id=${newNosePin._id}&category=nosepins`
        }
      });
    } else {
      // Earrings
      const processedDir = path.join(__dirname, '..', 'public', 'images', 'processed');
      if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });

      const outputFilename = `nobg_${baseName}.png`;
      const outputPath = path.join(processedDir, outputFilename);

      await removeBackground(originalPath, outputPath);

      const originalRelative = `/images/uploads/${filename}`;
      const processedRelative = `/images/processed/${outputFilename}`;

      const newEarring = new Earring({
        name: productName,
        originalImageUrl: originalRelative,
        processedImageUrl: processedRelative
      });
      await newEarring.save();

      return res.status(201).json({
        success: true,
        message: 'Earrings successfully ingested and background removed',
        item: {
          id: newEarring._id,
          sku: newEarring._id.toString().slice(-6).toUpperCase(),
          name: newEarring.name,
          category: 'earrings',
          anchorType: 'dual_ear_lobes',
          originalImageUrl: `${baseUrl}${originalRelative}`,
          tryOnImageUrl: `${baseUrl}${processedRelative}`,
          embedUrl: `${baseUrl}/embed?id=${newEarring._id}&category=earrings`
        }
      });
    }
  } catch (err) {
    console.error('Vendor upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @api {DELETE} /api/v1/vendor/catalog/:category/:id Delete product
 */
router.delete('/api/v1/vendor/catalog/:category/:id', async (req, res) => {
  try {
    const { category, id } = req.params;
    let deleted = null;

    if (category.startsWith('ear')) {
      deleted = await Earring.findByIdAndDelete(id);
    } else if (category.startsWith('nose')) {
      deleted = await NosePin.findByIdAndDelete(id);
    } else {
      return res.status(400).json({ success: false, error: 'Category must be earrings or nosepins' });
    }

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Item not found to delete' });
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleted.name} (ID: ${id})`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @api {GET} /api/v1/vendor/config Get AR Try-On Configuration Constants
 * @apiDescription Useful for vendors building custom frontends or mobile apps (React Native, Flutter).
 */
router.get('/api/v1/vendor/config', (req, res) => {
  res.status(200).json({
    success: true,
    engine: 'MediaPipe FaceMesh 3D',
    trackingVersion: 'v0.4.1633559619',
    totalFacialLandmarks: 468,
    anchors: {
      earrings: {
        leftEarBaseLandmark: 132,
        rightEarBaseLandmark: 361,
        depthScaling: {
          foreheadTopLandmark: 10,
          chinBottomLandmark: 152,
          referenceRatio: 0.55,
          minScale: 0.6,
          maxScale: 1.6
        },
        poseEstimation: {
          noseTipLandmark: 1,
          yawTurnThreshold: 0.02
        }
      },
      nosepins: {
        anchorLandmark: 220, // left nostril
        referenceLandmark: 1 // nose tip
      }
    },
    smoothing: {
      defaultFactor: 0.5,
      dragFactor: 0.75,
      occlusionGraceMs: 400
    }
  });
});

module.exports = router;
