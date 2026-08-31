const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');

function syncCanvasToVideo() {
    if (videoElement.videoWidth && videoElement.videoHeight) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }
}
videoElement.addEventListener('loadedmetadata', syncCanvasToVideo);

const jewlImage = new Image();
// Required to prevent cross-origin errors when analyzing pixels
jewlImage.crossOrigin = "Anonymous"; 
const noseImage = new Image();

let earringActive = false;
let nosepinActive = false;
let inti_noseX = null;

// Stores the ratio of empty transparent space at the top of the earring image
let jewlTopPaddingFactor = 0;

// --- NEW: ANALYZE IMAGE PADDING ON LOAD ---
jewlImage.onload = function() {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    
    const width = jewlImage.naturalWidth;
    const height = jewlImage.naturalHeight;
    if (width === 0 || height === 0) return;

    tempCanvas.width = width;
    tempCanvas.height = height;
    tempCtx.drawImage(jewlImage, 0, 0);
    
    try {
        const imageData = tempCtx.getImageData(0, 0, width, height).data;
        let firstVisiblePixelY = height; 

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const alphaIndex = (y * width + x) * 4 + 3;
                if (imageData[alphaIndex] > 20) { // If pixel is not fully transparent
                    firstVisiblePixelY = y;
                    break;
                }
            }
            if (firstVisiblePixelY < height) break;
        }
        
        jewlTopPaddingFactor = firstVisiblePixelY / height;
        console.log(`Earring padding calculated: ${(jewlTopPaddingFactor * 100).toFixed(1)}%`);
    } catch (e) {
        console.warn("Could not analyze earring pixels (CORS issue), defaulting to 0 offset.", e);
        jewlTopPaddingFactor = 0;
    }
};

window.selectEarring = function(earring) {
    if(earring == null){
        earringActive = false;
    } else {
        jewlImage.src = earring.processedImageUrl; 
        earringActive = true;
    }
}

window.selectNosepin = function(nosepin) {
    if (nosepin === null) {
        nosepinActive = false;
    } else {
        noseImage.src = nosepin.processedImageUrl;
        nosepinActive = true;
    }
}

function onResults(results) {
    if (canvasElement.width === 0 || canvasElement.height === 0) {
        syncCanvasToVideo();
        if (canvasElement.width === 0 || canvasElement.height === 0) return;
    }
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks) {
        for (const landmarks of results.multiFaceLandmarks) {
            const leftEarBase = landmarks[132]; 
            const rightEarBase = landmarks[361]; 
            const nose = landmarks[1];
            const leftNostril = landmarks[220];
            
            if (inti_noseX == null) {
                inti_noseX = nose.x;
            }

            let noseOffset = nose.x - inti_noseX;
            let headturn = 0.02; 

            const earringSize = Math.min(canvasElement.width, canvasElement.height) * 0.13; 
            const horizontalSeparation = earringSize * 0.3; 

            const paddingAdjustmentPixels = earringSize * jewlTopPaddingFactor;

            // Apply the padding offset so the physical jewelry aligns exactly with the ear base
            const leftX = leftEarBase.x * canvasElement.width - (earringSize / 2) - horizontalSeparation;
            const leftY = leftEarBase.y * canvasElement.height - paddingAdjustmentPixels;

            const rightX = rightEarBase.x * canvasElement.width - (earringSize / 2) + horizontalSeparation/2;
            const rightY = rightEarBase.y * canvasElement.height - paddingAdjustmentPixels;

            const nosePinSize = Math.min(canvasElement.width, canvasElement.height) * 0.05;
            const noseX = leftNostril.x * canvasElement.width - (nosePinSize / 2);
            const noseY = leftNostril.y * canvasElement.height - (nosePinSize / 2);

            // 4. SAFETY CHECKS: Ensure images are fully loaded before drawing to prevent crashes
            const canDrawEarring = earringActive && jewlImage.complete && jewlImage.naturalWidth !== 0;
            const canDrawNosepin = nosepinActive && noseImage.complete && noseImage.naturalWidth !== 0;

            if (noseOffset < -headturn) {
                // Head turned right, hide left earring
                if (canDrawEarring) {
                    canvasCtx.drawImage(jewlImage, rightX, rightY, earringSize, earringSize);
                }
            } else if (noseOffset > headturn) {
                // Head turned left, hide right earring
                if (canDrawEarring) {
                    canvasCtx.drawImage(jewlImage, leftX, leftY, earringSize, earringSize);
                }
            } else { 
                // Head facing forward, draw both
                if (canDrawEarring) {
                    canvasCtx.drawImage(jewlImage, leftX, leftY, earringSize, earringSize);
                    canvasCtx.drawImage(jewlImage, rightX, rightY, earringSize, earringSize);
                }
            }

            if (canDrawNosepin) {
                canvasCtx.drawImage(noseImage, noseX, noseY, nosePinSize, nosePinSize);
            }
        }
    }
    canvasCtx.restore();
}

const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
});

faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await faceMesh.send({image: videoElement});
    },
    width: 640,
    height: 480
});

camera.start();