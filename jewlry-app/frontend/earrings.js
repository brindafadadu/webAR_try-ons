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
const noseImage = new Image();
let earringActive = false;
let nosepinActive = false;
//jewlImage.src = 'backend/public/earrings.png'; 

let inti_noseX = null;

window.selectEarring = function(earring) {
    if(earring == null){
        earringActive = false;
    }
    else{
        jewlImage.src = earring.processedImageUrl; // Update the source of the earring image
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
            // Use ear base landmarks
            const leftEarBase = landmarks[58];
            const rightEarBase = landmarks[288];
            const nose = landmarks[1];
            const leftNostril = landmarks[220];
                        // TEMP DEBUG: shows exactly where the nose pin anchor point is.
            // Remove this once placement is confirmed correct.
            // canvasCtx.fillStyle = 'yellow';
            // canvasCtx.beginPath();
            // canvasCtx.arc(leftNostril.x * canvasElement.width, leftNostril.y * canvasElement.height, 4, 0, 2 * Math.PI);
            // canvasCtx.fill();

            if (inti_noseX == null) {
                inti_noseX = nose.x;
            }

            let noseOffset = nose.x - inti_noseX;
            let headturn = 0.02 // Sensitivity limit


            // Calculate earring size and position
            const earringSize = Math.min(canvasElement.width, canvasElement.height) * 0.13; 

            // Increase horizontal separation between earrings
            const horizontalSeparation = earringSize * 0.4; // Adjust this multiplier to increase/decrease gap

            // Left earring positioned on left ear base with additional horizontal offset
            const leftX = leftEarBase.x * canvasElement.width - (earringSize / 2) - horizontalSeparation;
            const leftY = leftEarBase.y * canvasElement.height - (earringSize / 2);

            // Right earring positioned on right ear base with additional horizontal offset
            const rightX = rightEarBase.x * canvasElement.width - (earringSize / 2) + horizontalSeparation/2;
            const rightY = rightEarBase.y * canvasElement.height - (earringSize / 2);

            // Calculate nose pin size and position
            const nosePinSize = Math.min(canvasElement.width, canvasElement.height) * 0.05;
            const noseX = leftNostril.x * canvasElement.width - (nosePinSize / 2);
            const noseY = leftNostril.y * canvasElement.height - (nosePinSize / 2);

            if(noseOffset < -headturn){
                //Head turned right so hide the left earring
                if (earringActive) {
                    canvasCtx.drawImage(
                        jewlImage,
                        rightX,
                        rightY,
                        earringSize,
                        earringSize
                    );
                }
            }

            else if (noseOffset>headturn){
                // Head turned left so hide the right earring
                if( earringActive) {
                    canvasCtx.drawImage(
                        jewlImage,
                        leftX,
                        leftY,
                        earringSize,
                        earringSize
                    );
                }
            }

            // Head facing forward draw both earrings
            else{ 
            
                if( earringActive) {
                    canvasCtx.drawImage(
                        jewlImage,
                        leftX,
                        leftY,
                        earringSize,
                        earringSize
                    );

                // Draw right earring
                    canvasCtx.drawImage(
                        jewlImage,
                        rightX,
                        rightY,
                        earringSize,
                        earringSize
                    );
                }
            }

            // Draw nose pin (always shown regardless of head turn)
            if (noseImage.src) {
                if (nosepinActive) {
                    canvasCtx.drawImage(
                        noseImage,
                        noseX,
                        noseY,
                        nosePinSize,
                        nosePinSize
                    );
                }
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

//the earrings are appearing s bit lower than the ear lobe need to lessen the sensitivity, increase the size a bit and check exact location