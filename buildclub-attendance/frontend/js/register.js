// register.js
// This runs the webcam, finds your face, draws a box around it,
// and when you click "Capture My Face" it sends your face fingerprint to the backend.

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusBox = document.getElementById('status');
const captureBtn = document.getElementById('captureBtn');

let latestDetection = null; // keeps the most recent face detection result

function showStatus(message, type = 'info') {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`;
}

async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    showStatus('❌ Could not access webcam. Please allow camera permission.', 'err');
  }
}

async function loadModels() {
  showStatus('⏳ Loading face recognition models... (only takes a few seconds)', 'info');
  const MODEL_URL = 'models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  showStatus('✅ Models loaded! Position your face in the camera.', 'ok');
}

async function detectLoop() {
  const options = new faceapi.TinyFaceDetectorOptions();
  const result = await faceapi
    .detectSingleFace(video, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (result) {
    latestDetection = result;
    const resized = faceapi.resizeResults(result, { width: overlay.width, height: overlay.height });
    faceapi.draw.drawDetections(overlay, resized);
  } else {
    latestDetection = null;
  }

  requestAnimationFrame(detectLoop);
}

captureBtn.addEventListener('click', async () => {
  const buildClubId = document.getElementById('buildClubId').value.trim();
  const name = document.getElementById('name').value.trim();

  if (!buildClubId || !name) {
    showStatus('⚠️ Please fill in both Build Club ID and Name first.', 'err');
    return;
  }
  if (!latestDetection) {
    showStatus('⚠️ No face detected yet. Look straight at the camera and try again.', 'err');
    return;
  }

  // The face "fingerprint" - a list of 128 numbers describing this face
  const descriptor = Array.from(latestDetection.descriptor);

  showStatus('⏳ Saving your face...', 'info');

  try {
    const res = await fetch('/api/members/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildClubId, name, descriptor })
    });
    const data = await res.json();

    if (res.ok) {
      showStatus(`✅ ${data.message} You can now go to the Live Camera page.`, 'ok');
    } else {
      showStatus(`❌ ${data.error}`, 'err');
    }
  } catch (err) {
    showStatus('❌ Could not reach the server. Is the backend running?', 'err');
  }
});

(async function init() {
  await startWebcam();
  await loadModels();
  detectLoop();
})();
