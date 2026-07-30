let currentStream = null;
let isRecognizing = false;
let modelsLoaded = false;
let faceMatcher = null;
let memberLookup = {}; // buildClubId -> name
let lastMatchTime = 0;
const MATCH_COOLDOWN_MS = 3000;  // don't hammer the backend every single frame
const MATCH_THRESHOLD = 0.6;     // lower = stricter match (face-api default)
const REFRESH_FACES_MS = 60000;  // pick up newly-registered members without a reload

// Initialize camera + models as soon as this page loads - no button needed.
document.addEventListener('DOMContentLoaded', async function() {
    await loadModels();
    await loadKnownFaces();
    await initCamera();
    startFaceRecognition();
    setInterval(loadKnownFaces, REFRESH_FACES_MS);
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

// Fetches every registered member's stored face descriptors and builds a
// matcher so we can figure out WHOSE face the camera is looking at.
async function loadKnownFaces() {
    try {
        const res = await fetch('/api/members');
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const members = await res.json();

        const labeledDescriptors = members
            .filter(m => Array.isArray(m.descriptors) && m.descriptors.length > 0)
            .map(m => new faceapi.LabeledFaceDescriptors(
                m.buildClubId,
                m.descriptors.map(d => new Float32Array(d))
            ));

        memberLookup = {};
        members.forEach(m => { memberLookup[m.buildClubId] = m.name; });

        if (labeledDescriptors.length > 0) {
            faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
            console.log(`✅ Loaded ${labeledDescriptors.length} registered face${labeledDescriptors.length === 1 ? '' : 's'}`);
        } else {
            faceMatcher = null;
            console.warn('⚠️ No registered members with face data yet - register someone first.');
        }
    } catch (err) {
        console.error('❌ Failed to load known faces:', err);
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
                
                if (detections.length > 0 && faceMatcher && Date.now() - lastMatchTime > MATCH_COOLDOWN_MS) {
                    detections.forEach((detection) => {
                        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                        const confidence = (detection.detection.score * 100).toFixed(1);

                        if (bestMatch.label !== 'unknown') {
                            console.log(`Recognized ${bestMatch.label} (${confidence}% face confidence, distance ${bestMatch.distance.toFixed(2)})`);
                            lastMatchTime = Date.now();
                            markAttendance(bestMatch.label);
                        } else {
                            console.log(`Face detected (${confidence}% confidence) but not recognized - not registered yet?`);
                        }
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

async function markAttendance(buildClubId) {
    const name = memberLookup[buildClubId] || buildClubId;
    try {
        const response = await fetch('/api/attendance/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buildClubId, name })
        });
        
        const data = await response.json();

        if (response.ok) {
            console.log(`✅ ${data.status}:`, data.message);
            showNotification(data.message);
        } else {
            console.error('Attendance mark error:', data.error);
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
