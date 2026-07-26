// register.js
// STEP 1: check the admin password before showing the camera/form at all.
// STEP 2: once unlocked, run the webcam, find the face, and save it on capture.

const lockCard = document.getElementById('lockCard');
const formCard = document.getElementById('formCard');
const lockStatus = document.getElementById('lockStatus');
const unlockBtn = document.getElementById('unlockBtn');
const adminPasswordInput = document.getElementById('adminPassword');

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusBox = document.getElementById('status');
const captureBtn = document.getElementById('captureBtn');

let latestDetection = null;   // keeps the most recent face detection result
let adminPassword = '';       // kept in memory only after a successful unlock

function showLockStatus(message, type = 'info') {
  lockStatus.textContent = message;
  lockStatus.className = `status show ${type}`;
}

function showStatus(message, type = 'info') {
  statusBox.innerHTML = message;
  statusBox.className = `status show ${type}`;
}

async function tryUnlock() {
  const password = adminPasswordInput.value;
  if (!password) {
    showLockStatus('⚠️ Please enter the admin password.', 'err');
    return;
  }
  showLockStatus('⏳ Checking...', 'info');

  try {
    const res = await fetch('/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.ok) {
      adminPassword = password;
      sessionStorage.setItem('bc_admin_ok', '1'); // remembered only for this browser tab
      lockCard.style.display = 'none';
      formCard.style.display = 'block';
      startRegistrationFlow();
    } else {
      showLockStatus('❌ Incorrect password. Ask a teammate for the correct one.', 'err');
    }
  } catch (err) {
    showLockStatus('❌ Could not reach the server. Is the backend running?', 'err');
  }
}

unlockBtn.addEventListener('click', tryUnlock);
adminPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryUnlock();
});

// ---------------- Webcam + face capture (only runs after unlock) ----------------

async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    showStatus('❌ Could not access webcam. Please allow camera permission.', 'err');
  }
}

async function loadModels() {
  showStatus('<span class="spinner"></span>Loading face recognition models... (only takes a few seconds)', 'info');
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
      body: JSON.stringify({ buildClubId, name, descriptor, adminPassword })
    });
    const data = await res.json();

    if (res.ok) {
      showStatus(`✅ ${data.message} You can now go to the Live Camera page.`, 'ok');
      if (typeof showToast === 'function') {
        showToast('✅ Face registered!', `${name} (ID ${buildClubId}) is ready for the Live Camera.`, 'in');
        playBeep('in');
      }
    } else {
      showStatus(`❌ ${data.error}`, 'err');
    }
  } catch (err) {
    showStatus('❌ Could not reach the server. Is the backend running?', 'err');
  }
});

async function startRegistrationFlow() {
  await startWebcam();
  await loadModels();
  detectLoop();
}

// If this tab already unlocked once, skip straight past the lock screen.
// (Password itself is never stored - just a flag - so you'll re-enter it in a new tab.)
if (sessionStorage.getItem('bc_admin_ok') === '1') {
  showLockStatus('🔓 Already unlocked in this tab - but please re-enter the password once more for safety.', 'info');
}
