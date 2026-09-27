const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

async function removeBackground(inputImagePath, outputImagePath) {
  // Resize image first to speed up rembg processing
  const resizedPath = inputImagePath.replace(/(\.\w+)$/, '_resized$1');
  await sharp(inputImagePath)
    .resize(512, 512, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .toFile(resizedPath);

  return new Promise((resolve, reject) => {
    // Use u2netp (fast lightweight model)
    exec(`rembg i -m u2netp "${resizedPath}" "${outputImagePath}"`, { maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      // Clean up resized temp file
      if (fs.existsSync(resizedPath)) {
        try { fs.unlinkSync(resizedPath); } catch (_) {}
      }

      if (error) {
        console.error(`Error executing rembg: ${error.message}`);
        if (stderr) console.error(`rembg stderr: ${stderr}`);
        reject(new Error(stderr || error.message));
      } else {
        console.log(`Background removed successfully for ${path.basename(inputImagePath)}`);
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