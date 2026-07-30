let currentStream = null;
let isRecognizing = false;
let modelsLoaded = false;
let lastMatchTime = 0;
const MATCH_COOLDOWN_MS = 2000; // don't hammer the backend every single frame

// Initialize camera + models as soon as this page loads - no button needed.
document.addEventListener('DOMContentLoaded', async function() {
    await loadModels();
    await initCamera();
    startFaceRecognition();
});

// Stop camera when leaving the page
window.addEventListener('beforeunload', stopCamera);
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        stopCamera();
    }
});

// Navigation - stop camera when switching pages
document.querySelectorAll('a[href], button[onclick*="location"]').forEach(el => {
    el.addEventListener('click', stopCamera);
});

// The face-api models must be loaded before ANY detection call, or every
// detectAllFaces() call throws immediately.
async function loadModels() {
    try {
        const MODEL_URL = 'models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        console.log('✅ Face-api models loaded');
    } catch (err) {
        console.error('❌ Failed to load face-api models:', err);
        alert('Failed to load face recognition models. Check your connection and reload.');
    }
}

async function initCamera() {
    try {
        currentStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        
        const video = document.getElementById('video');
        if (video) {
            video.srcObject = currentStream;
            console.log('✅ Camera initialized');
        }
    } catch (err) {
        console.error('❌ Camera access denied:', err);
        alert('Camera access required. Please allow camera permissions.');
    }
}

function stopCamera() {
    isRecognizing = false;

    if (currentStream) {
        currentStream.getTracks().forEach(track => {
            track.stop();
            console.log('🛑 Stopped:', track.kind);
        });
        currentStream = null;
        
        const video = document.getElementById('video');
        if (video) {
            video.srcObject = null;
        }
    }
}

async function startFaceRecognition() {
    if (!currentStream || !modelsLoaded) return;
    
    isRecognizing = true;
    const video = document.getElementById('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const detectorOptions = new faceapi.TinyFaceDetectorOptions();
    
    const detectAndMatch = async () => {
        if (!isRecognizing || !currentStream) return;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            try {
                const detections = await faceapi.detectAllFaces(canvas, detectorOptions)
                    .withFaceLandmarks()
                    .withFaceDescriptors();
                
                if (detections.length > 0 && Date.now() - lastMatchTime > MATCH_COOLDOWN_MS) {
                    lastMatchTime = Date.now();
                    detections.forEach((detection, idx) => {
                        const confidence = (detection.detection.score * 100).toFixed(1);
                        console.log(`Face ${idx + 1} detected: ${confidence}% confidence`);
                        
                        // Send to backend for matching
                        matchFace(detection.descriptor);
                    });
                }
            } catch (err) {
                console.error('Recognition error:', err);
            }
        }
        
        requestAnimationFrame(detectAndMatch);
    };
    
    detectAndMatch();
}

async function matchFace(descriptor) {
    try {
        const response = await fetch('/api/attendance/checkin-by-face', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descriptor })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Recognized:', data.name);
            showNotification(`✅ ${data.name} checked in!`);
        }
    } catch (err) {
        console.error('Match error:', err);
    }
}

function showNotification(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #27ae60;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
