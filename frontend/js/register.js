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
const startOverBtn = document.getElementById('startOverBtn');
const poseInstruction = document.getElementById('poseInstruction');
const poseDots = document.getElementById('poseDots');
let latestDetection = null;   // keeps the most recent face detection result
let adminPassword = '';       // kept in memory only after a successful unlock
// ---------------- Multi-angle capture ---------------
// FIX for "camera doesn't recognize side/far angles": instead of saving
// ONE straight-on photo, we now walk the member through 5 short poses and
// save a descriptor for each. The Live Camera page then compares every
// incoming face against ALL of these, so it still recognizes someone even
// when the live camera catches them from the side or a few steps away.
const POSES = [
  { icon: '', instruction: 'Look straight at the camera' },
  { icon: '', instruction: 'Turn your head slightly to the LEFT' },
  { icon: '', instruction: 'Turn your head slightly to the RIGHT' },
  { icon: '', instruction: 'Tilt your chin up a little' },
  { icon: '', instruction: 'Tilt your chin down a little' }
];
let poseIndex = 0;
let capturedDescriptors = [];
function renderPoseDots() {
  if (!poseDots) return;
  poseDots.innerHTML = POSES.map((p, i) => {
    const state = i < poseIndex ? 'done' : (i === poseIndex ? 'active' : '');
    const content = i < poseIndex ? '' : p.icon;
    return `<div class="pose-dot ${state}" title="${p.instruction}">${content}</div>`;
  }).join('');
}
function updatePoseUI() {
  if (poseIndex >= POSES.length) {
    if (poseInstruction) poseInstruction.textContent = ' All 5 angles captured! Click "Save
      Registration" to finish.';
    if (captureBtn) captureBtn.textContent = ' Save Registration';
  } else {
    const pose = POSES[poseIndex];
    if (poseInstruction) {
      poseInstruction.textContent = `${pose.icon} Step ${poseIndex + 1} of ${POSES.length}:
        ${pose.instruction}`;
    }
    if (captureBtn) captureBtn.textContent = ` Capture This Angle (${poseIndex +
      1}/${POSES.length})`;
  }
  renderPoseDots();
}
function resetCapture() {
  poseIndex = 0;
  capturedDescriptors = [];
  updatePoseUI();
}
startOverBtn?.addEventListener('click', () => {
  resetCapture();
  showStatus(' Starting over - capture all 5 angles again.', 'info');
});
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
    showLockStatus(' Please enter the admin password.', 'err');
    return;
  }
  showLockStatus('n Checking...', 'info');
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
      showLockStatus(' Incorrect password. Ask a teammate for the correct one.', 'err');
    }
  } catch (err) {
    showLockStatus(' Could not reach the server. Is the backend running?', 'err');
  }
}
unlockBtn.addEventListener('click', tryUnlock);
adminPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryUnlock();
});
// ---------------- Webcam + face capture (only runs after unlock) ---------------
async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    showStatus(' Could not access webcam. Please allow camera permission.', 'err');
  }
}
// Same tuned options used on the Live Camera page (see camera.js) so a
// face detected here behaves consistently with how it'll later be found
// by the real attendance camera.
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 608,
  scoreThreshold: 0.4
});
async function loadModels() {
  showStatus('<span class="spinner"></span>Loading face recognition models... (only takes a
    few seconds)', 'info');
  const MODEL_URL = 'models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  showStatus(' Models loaded! Follow the steps below to capture your face.', 'ok');
  updatePoseUI();
}
async function detectLoop() {
  const result = await faceapi
    .detectSingleFace(video, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor();
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  if (result) {
    latestDetection = result;
    const resized = faceapi.resizeResults(result, { width: overlay.width, height:
      overlay.height });
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
    showStatus(' Please fill in both Build Club ID and Name first.', 'err');
    return;
  }
  // Still walking through the 5 poses - this click captures ONE angle.
  if (poseIndex < POSES.length) {
    if (!latestDetection) {
      showStatus(' No face detected yet. Center your face in the frame and try again.',
        'err');
      return;
    }
    // The face "fingerprint" for this angle - 128 numbers describing it
    capturedDescriptors.push(Array.from(latestDetection.descriptor));
    poseIndex++;
    updatePoseUI();
    if (poseIndex < POSES.length) {
      showStatus(` Angle ${poseIndex}/${POSES.length} captured! Now:
        ${POSES[poseIndex].instruction}.`, 'ok');
    } else {
      showStatus(' All 5 angles captured! Click "Save Registration" to finish.', 'ok');
    }
    return;
  }
  // All 5 poses are captured - this click saves everything to the backend.
  showStatus('<span class="spinner"></span>Saving your face...', 'info');
  try {
    const res = await fetch('/api/members/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildClubId, name, descriptors: capturedDescriptors,
        adminPassword })
    });
    const data = await res.json();
    if (res.ok) {
      showStatus(` ${data.message} You can now go to the Live Camera page.`, 'ok');
      if (typeof showToast === 'function') {
        showToast(' Face registered!', `${name} (ID ${buildClubId}) is ready for the Live
          Camera.`, 'in');
        playBeep('in');
      }
      resetCapture();
    } else {
      showStatus(` ${data.error}`, 'err');
    }
  } catch (err) {
    showStatus(' Could not reach the server. Is the backend running?', 'err');
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
  showLockStatus(' Already unlocked in this tab - but please re-enter the password once more
    for safety.', 'info');
}
