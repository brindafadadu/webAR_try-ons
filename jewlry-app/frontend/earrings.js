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

// --- DEPTH / DISTANCE SCALING CONSTANTS ---
const REFERENCE_FACE_HEIGHT_RATIO = 0.55; // tune by calibrating at your ideal distance
const MIN_SCALE_FACTOR = 0.6;
const MAX_SCALE_FACTOR = 1.6;

// Guide box dimensions (as a fraction of canvas size)
const GUIDE_BOX_WIDTH_RATIO = 0.35;
const GUIDE_BOX_HEIGHT_RATIO = 0.55;

// --- SMOOTHING / OCCLUSION CONSTANTS ---
// SMOOTHING_FACTOR: 0-1. Lower = smoother but more lag between real motion and
// rendered position. Higher = snappier but more visible jitter. 0.4 is a
// reasonable starting point; tune per feel.
const SMOOTHING_FACTOR = 0.4;
// How long (ms) to keep drawing jewelry at the last known position after
// FaceMesh briefly loses the face (hand pass, fast turn, bad frame) before
// treating tracking as actually lost.
const OCCLUSION_GRACE_MS = 400;

// --- DRAG-TO-REPOSITION STATE ---
let earringOffsets = {
    left: { dx: 0, dy: 0 },
    right: { dx: 0, dy: 0 }
};
// NEW: nose pin offset (single item, not left/right)
let nosepinOffset = { dx: 0, dy: 0 };

let lastEarringRects = { left: null, right: null }; // updated every frame for hit-testing
let lastNosepinRect = null; // NEW: updated every frame for nose pin hit-testing
let dragState = null; // { item: 'left' | 'right' | 'nosepin', startX, startY, startOffsetX, startOffsetY }

// --- SMOOTHING / OCCLUSION STATE ---
// Holds the exponentially-smoothed versions of the landmarks we actually use,
// so jitter in the raw FaceMesh output doesn't translate directly into
// wobbling jewelry. Also doubles as the "last known good" position we hold
// onto during brief tracking loss (see OCCLUSION_GRACE_MS).
let smoothedLandmarks = null; // { leftEarBase, rightEarBase, nose, foreheadTop, chinBottom, leftNostril }
let lastSeenTimestamp = 0;

// --- ANALYZE IMAGE PADDING ON LOAD ---
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

// --- DRAW THE FACE POSITIONING GUIDE BOX ---
function drawGuideBox() {
    const boxWidth = canvasElement.width * GUIDE_BOX_WIDTH_RATIO;
    const boxHeight = canvasElement.height * GUIDE_BOX_HEIGHT_RATIO;
    const boxX = (canvasElement.width - boxWidth) / 2;
    const boxY = (canvasElement.height - boxHeight) / 2;

    canvasCtx.save();
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    canvasCtx.lineWidth = 3;
    canvasCtx.setLineDash([10, 6]);
    canvasCtx.strokeRect(boxX, boxY, boxWidth, boxHeight);
    canvasCtx.restore();
}

// --- LANDMARK SMOOTHING HELPERS ---
// Exponential moving average per point: nudges the previous smoothed value
// toward the new raw value by SMOOTHING_FACTOR each frame, instead of
// snapping straight to it. Cuts high-frequency jitter without adding much
// perceptible lag at a 0.4 factor.
function smoothPoint(prev, next, factor) {
    if (!prev) return { x: next.x, y: next.y, z: next.z };
    return {
        x: prev.x + (next.x - prev.x) * factor,
        y: prev.y + (next.y - prev.y) * factor,
        z: prev.z + (next.z - prev.z) * factor
    };
}

// Pulls out just the landmarks we actually use and smooths each one against
// the previous frame's smoothed set.
function smoothLandmarkSet(prevSet, rawLandmarks) {
    const raw = {
        leftEarBase: rawLandmarks[132],
        rightEarBase: rawLandmarks[361],
        nose: rawLandmarks[1],
        foreheadTop: rawLandmarks[10],
        chinBottom: rawLandmarks[152],
        leftNostril: rawLandmarks[220]
    };
    if (!prevSet) return raw;
    const next = {};
    for (const key in raw) {
        next[key] = smoothPoint(prevSet[key], raw[key], SMOOTHING_FACTOR);
    }
    return next;
}

// --- DRAG HELPERS ---
// Converts a mouse/touch client coordinate into the canvas's internal pixel
// coordinate space, accounting for the CSS scaleX(-1) mirror on #canvas.
function getCanvasInternalCoords(clientX, clientY) {
    const rect = canvasElement.getBoundingClientRect();
    const displayX = (clientX - rect.left) * (canvasElement.width / rect.width);
    const displayY = (clientY - rect.top) * (canvasElement.height / rect.height);
    const internalX = canvasElement.width - displayX; // flip for mirror
    const internalY = displayY;
    return { x: internalX, y: internalY };
}

function hitTestItems(x, y) {
    // Check nose pin first since it's smaller and easy to miss if checked last
    if (lastNosepinRect) {
        const r = lastNosepinRect;
        if (x >= r.x && x <= r.x + r.size && y >= r.y && y <= r.y + r.size) {
            return 'nosepin';
        }
    }
    for (const ear of ['left', 'right']) {
        const rect = lastEarringRects[ear];
        if (!rect) continue;
        if (x >= rect.x && x <= rect.x + rect.size && y >= rect.y && y <= rect.y + rect.size) {
            return ear;
        }
    }
    return null;
}

function getOffsetFor(item) {
    if (item === 'nosepin') return nosepinOffset;
    return earringOffsets[item];
}

function handleDragStart(clientX, clientY) {
    if (!earringActive && !nosepinActive) return;
    const { x, y } = getCanvasInternalCoords(clientX, clientY);
    const hitItem = hitTestItems(x, y);
    if (hitItem) {
        const currentOffset = getOffsetFor(hitItem);
        dragState = {
            item: hitItem,
            startX: x,
            startY: y,
            startOffsetX: currentOffset.dx,
            startOffsetY: currentOffset.dy
        };
    }
}

function handleDragMove(clientX, clientY) {
    if (!dragState) return;
    const { x, y } = getCanvasInternalCoords(clientX, clientY);
    const deltaX = x - dragState.startX;
    const deltaY = y - dragState.startY;
    const offset = getOffsetFor(dragState.item);
    offset.dx = dragState.startOffsetX + deltaX;
    offset.dy = dragState.startOffsetY + deltaY;
}

function handleDragEnd() {
    dragState = null;
}

function onResults(results) {
    if (canvasElement.width === 0 || canvasElement.height === 0) {
        syncCanvasToVideo();
        if (canvasElement.width === 0 || canvasElement.height === 0) return;
    }
    
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    drawGuideBox();

    // --- UPDATE SMOOTHED LANDMARKS + OCCLUSION TRACKING ---
    // (maxNumFaces is 1, so there's at most one entry here — no need for the
    // old per-face loop; we just take face 0 when present.)
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        smoothedLandmarks = smoothLandmarkSet(smoothedLandmarks, results.multiFaceLandmarks[0]);
        lastSeenTimestamp = performance.now();
    }

    // Keep drawing at the last known position for a short grace window even
    // if this frame had no detection at all, so a hand passing over the face
    // or a fast head turn doesn't make jewelry flicker in and out.
    const trackingIsFresh = smoothedLandmarks && (performance.now() - lastSeenTimestamp) < OCCLUSION_GRACE_MS;

    if (trackingIsFresh) {
        const leftEarBase = smoothedLandmarks.leftEarBase;
        const rightEarBase = smoothedLandmarks.rightEarBase;
        const nose = smoothedLandmarks.nose;
        const leftNostril = smoothedLandmarks.leftNostril;

        // --- DEPTH ESTIMATION VIA FACE HEIGHT (yaw-stable) ---
        const foreheadTop = smoothedLandmarks.foreheadTop;
        const chinBottom = smoothedLandmarks.chinBottom;
        const faceHeightPx = Math.abs(chinBottom.y - foreheadTop.y) * canvasElement.height;
        const referenceFaceHeightPx = canvasElement.height * REFERENCE_FACE_HEIGHT_RATIO;

        let depthScaleFactor = faceHeightPx / referenceFaceHeightPx;
        depthScaleFactor = Math.min(Math.max(depthScaleFactor, MIN_SCALE_FACTOR), MAX_SCALE_FACTOR);
        
        if (inti_noseX == null) {
            inti_noseX = nose.x;
        }

        let noseOffset = nose.x - inti_noseX;
        let headturn = 0.02; 

        const earringSize = Math.min(canvasElement.width, canvasElement.height) * 0.13 * depthScaleFactor;
        const horizontalSeparation = earringSize * 0.3; 

        const paddingAdjustmentPixels = earringSize * jewlTopPaddingFactor;

        // Apply padding offset, then the user's manual drag offset, on top of the tracked position
        const leftX = leftEarBase.x * canvasElement.width - (earringSize / 2) - horizontalSeparation + earringOffsets.left.dx;
        const leftY = leftEarBase.y * canvasElement.height - paddingAdjustmentPixels + earringOffsets.left.dy;

        const rightX = rightEarBase.x * canvasElement.width - (earringSize / 2) + horizontalSeparation/2 + earringOffsets.right.dx;
        const rightY = rightEarBase.y * canvasElement.height - paddingAdjustmentPixels + earringOffsets.right.dy;

        // Remember where each earring was drawn this frame, for drag hit-testing
        lastEarringRects.left = { x: leftX, y: leftY, size: earringSize };
        lastEarringRects.right = { x: rightX, y: rightY, size: earringSize };

        const nosePinSize = Math.min(canvasElement.width, canvasElement.height) * 0.05;
        // NEW: nose pin drag offset applied on top of tracked position
        const noseX = leftNostril.x * canvasElement.width - (nosePinSize / 2) + nosepinOffset.dx;
        const noseY = leftNostril.y * canvasElement.height - (nosePinSize / 2) + nosepinOffset.dy;

        // NEW: remember where the nose pin was drawn this frame, for drag hit-testing
        lastNosepinRect = { x: noseX, y: noseY, size: nosePinSize };

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

// --- DRAG EVENT LISTENERS (mouse + touch) ---
canvasElement.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY));
canvasElement.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY));
window.addEventListener('mouseup', handleDragEnd);

canvasElement.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
        if (dragState) e.preventDefault();
    }
}, { passive: false });

canvasElement.addEventListener('touchmove', (e) => {
    if (dragState && e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
        e.preventDefault();
    }
}, { passive: false });

canvasElement.addEventListener('touchend', handleDragEnd);
canvasElement.addEventListener('touchcancel', handleDragEnd);