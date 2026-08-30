const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function removeBackground(inputImagePath, outputImagePath) {
  return new Promise((resolve, reject) => {
    exec(`rembg i -m u2netp "${inputImagePath}" "${outputImagePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing rembg: ${error.message}`);
        reject(error);
      } else {
        console.log(`Background removed successfully for ${path.basename(inputImagePath)}`);
        resolve(outputImagePath);
      }
    });
  });
}

module.exports = { removeBackground };
