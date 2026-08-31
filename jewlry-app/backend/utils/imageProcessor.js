const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

function removeBackground(inputImagePath, outputImagePath) {
  return new Promise((resolve, reject) => {
    exec(`rembg i -m u2net "${inputImagePath}" "${outputImagePath}"`, (error, stdout, stderr) => {
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