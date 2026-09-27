const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/**
 * Remove the background from an image using sharp.
 * Detects the dominant background color from corner pixels and makes
 * all similar-colored pixels transparent. Works well for jewelry photos
 * on solid/white backgrounds.
 *
 * Falls back to rembg (Python) if available, otherwise uses the
 * pure-Node sharp approach so it works on Render/cloud hosts.
 */
async function removeBackground(inputImagePath, outputImagePath) {
  // Try rembg first (works locally if Python env is set up)
  try {
    await tryRembg(inputImagePath, outputImagePath);
    return outputImagePath;
  } catch (_) {
    console.log('rembg not available, using sharp-based background removal');
  }

  // Fallback: sharp-based background removal
  const image = sharp(inputImagePath);
  const { width, height, channels } = await image.metadata();

  // Ensure we work with RGBA
  const rawBuffer = await image
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Sample corner pixels to detect the background color
  const samplePixels = [
    getPixel(rawBuffer, 0, 0, width),               // top-left
    getPixel(rawBuffer, width - 1, 0, width),        // top-right
    getPixel(rawBuffer, 0, height - 1, width),       // bottom-left
    getPixel(rawBuffer, width - 1, height - 1, width) // bottom-right
  ];

  // Average the corner colors as the background reference
  const bgColor = {
    r: Math.round(samplePixels.reduce((s, p) => s + p.r, 0) / samplePixels.length),
    g: Math.round(samplePixels.reduce((s, p) => s + p.g, 0) / samplePixels.length),
    b: Math.round(samplePixels.reduce((s, p) => s + p.b, 0) / samplePixels.length)
  };

  // Color distance threshold — pixels within this distance from the
  // background color are treated as background and made transparent.
  // Higher = more aggressive removal. 60 works well for clean backgrounds.
  const THRESHOLD = 60;

  const outputBuffer = Buffer.from(rawBuffer);

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    const r = outputBuffer[offset];
    const g = outputBuffer[offset + 1];
    const b = outputBuffer[offset + 2];

    const distance = Math.sqrt(
      (r - bgColor.r) ** 2 +
      (g - bgColor.g) ** 2 +
      (b - bgColor.b) ** 2
    );

    if (distance < THRESHOLD) {
      outputBuffer[offset + 3] = 0; // make transparent
    }
  }

  await sharp(outputBuffer, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputImagePath);

  console.log(`Background removed (sharp) for ${path.basename(inputImagePath)}`);
  return outputImagePath;
}

function getPixel(buffer, x, y, width) {
  const offset = (y * width + x) * 4;
  return {
    r: buffer[offset],
    g: buffer[offset + 1],
    b: buffer[offset + 2],
    a: buffer[offset + 3]
  };
}

function tryRembg(inputImagePath, outputImagePath) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    exec(`rembg i -m u2net "${inputImagePath}" "${outputImagePath}"`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        console.log(`Background removed (rembg) for ${path.basename(inputImagePath)}`);
        resolve(outputImagePath);
      }
    });
  });
}

async function normalizeEarringImage(inputImagePath, outputImagePath, size = 800) {
  await sharp(inputImagePath)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(outputImagePath);

  return outputImagePath;
}

module.exports = { removeBackground, normalizeEarringImage };