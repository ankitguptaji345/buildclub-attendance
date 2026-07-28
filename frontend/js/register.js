// register.js
// STEP 1: pick a role. Guests skip straight to the camera. Everyone else
//         must unlock with the admin password first.
// STEP 2: once unlocked, run the webcam, find the face, and auto-capture
//         each of the 5 poses as soon as you turn into it and hold still.

const roleCard = document.getElementById('roleCard');
const lockCard = document.getElementById('lockCard');
const formCard = document.getElementById('formCard');
const lockRoleLabel = document.getElementById('lockRoleLabel');
const formRolePill = document.getElementById('formRolePill');
const lockStatus = document.getElementById('lockStatus');
const unlockBtn = document.getElementById('unlockBtn');
const backFromLockBtn = document.getElementById('backFromLockBtn');
const backFromFormBtn = document.getElementById('backFromFormBtn');
const adminPasswordInput = document.getElementById('adminPassword');
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const captureRing = document.getElementById('captureRing');
const statusBox = document.getElementById('status');
const captureBtn = document.getElementById('captureBtn');
const startOverBtn = document.getElementById('startOverBtn');
const poseInstruction = document.getElementById('poseInstruction');
const poseDots = document.getElementById('poseDots');

let selectedRole = 'member';
let adminPassword = '';       // kept in memory only after a successful unlock
let latestDetection = null;   // keeps the most recent face detection result
let webcamStarted = false;

// ---------------- Role selection ---------------
const ROLE_LABELS = { admin: 'an admin', mentor: 'a mentor', member: 'a member', guest: 'a guest' };

document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedRole = btn.dataset.role;
    formRolePill.textContent = selectedRole;
    formRolePill.className = `role-pill role-${selectedRole}`;
    lockRoleLabel.textContent = ROLE_LABELS[selectedRole] || 'a member';
    roleCard.style.display = 'none';

    if (selectedRole === 'guest') {
      // Guests don't need the admin password - straight to the camera.
      adminPassword = '';
      lockCard.style.display = 'none';
      formCard.style.display = 'block';
      startRegistrationFlow();
    } else {
      lockCard.style.display = 'block';
      adminPasswordInput.value = '';
      lockStatus.className = 'status';
      adminPasswordInput.focus();
    }
  });
});

function backToRoleSelect() {
  lockCard.style.display = 'none';
  formCard.style.display = 'none';
  roleCard.style.display = 'block';
  stopWebcam();
  resetCapture();
}
backFromLockBtn.addEventListener('click', backToRoleSelect);
backFromFormBtn.addEventListener('click', backToRoleSelect);

// ---------------- Admin unlock ---------------
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

// ---------------- Multi-angle capture (auto, on rotation) ---------------
// Each pose has a check() function that reads the live yaw/pitch numbers
// and returns true only while the member is actually holding that pose.
// The moment it's true for CAPTURE_HOLD_MS in a row, we auto-capture -
// no button press needed. The button stays as a manual fallback in case
// lighting or a webcam makes auto-detection unreliable.
let baselineYaw = null;
let baselinePitch = null;
const YAW_TURN_THRESHOLD = 0.16;
const PITCH_TILT_THRESHOLD = 0.10;
const CENTER_TOLERANCE = 0.09;
const CAPTURE_HOLD_MS = 700;

const POSES = [
  {
    icon: '⬆️', instruction: 'Look straight at the camera',
    check: (yaw, pitch) => Math.abs(yaw) < CENTER_TOLERANCE && Math.abs(pitch - (baselinePitch ?? pitch)) < CENTER_TOLERANCE
  },
  {
    icon: '⬅️', instruction: 'Turn your head slightly to one side and hold',
    check: (yaw) => baselineYaw !== null && (yaw - baselineYaw) < -YAW_TURN_THRESHOLD
  },
  {
    icon: '➡️', instruction: 'Turn your head slightly to the other side and hold',
    check: (yaw) => baselineYaw !== null && (yaw - baselineYaw) > YAW_TURN_THRESHOLD
  },
  {
    icon: '🔼', instruction: 'Tilt your chin up a little and hold',
    check: (yaw, pitch) => baselinePitch !== null && (pitch - baselinePitch) < -PITCH_TILT_THRESHOLD
  },
  {
    icon: '🔽', instruction: 'Tilt your chin down a little and hold',
    check: (yaw, pitch) => baselinePitch !== null && (pitch - baselinePitch) > PITCH_TILT_THRESHOLD
  }
];

let poseIndex = 0;
let capturedDescriptors = [];
let poseHoldStart = null;

function renderPoseDots() {
  if (!poseDots) return;
  poseDots.innerHTML = POSES.map((p, i) => {
    const state = i < poseIndex ? 'done' : (i === poseIndex ? 'active' : '');
    const content = i < poseIndex ? '✓' : p.icon;
    return `<div class="pose-dot ${state}" title="${p.instruction}">${content}</div>`;
  }).join('');
}

function updatePoseUI() {
  if (poseIndex >= POSES.length) {
    poseInstruction.textContent = '🎉 All 5 angles captured! Click "Save Registration" to finish.';
    captureBtn.textContent = '💾 Save Registration';
  } else {
    const pose = POSES[poseIndex];
    poseInstruction.textContent = `${pose.icon} Step ${poseIndex + 1} of ${POSES.length}: ${pose.instruction}`;
    captureBtn.textContent = `📸 Capture Now (Manual) - Angle ${poseIndex + 1}/${POSES.length}`;
  }
  renderPoseDots();
}

function resetCapture() {
  poseIndex = 0;
  capturedDescriptors = [];
  baselineYaw = null;
  baselinePitch = null;
  poseHoldStart = null;
  if (captureRing) captureRing.style.setProperty('--fill', '0%');
  updatePoseUI();
}

startOverBtn.addEventListener('click', () => {
  resetCapture();
  showStatus('↺ Starting over - capture all 5 angles again.', 'info');
});

// ---------------- Webcam ---------------
async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
    webcamStarted = true;
  } catch (err) {
    showStatus('❌ Could not access webcam. Please allow camera permission.', 'err');
  }
}
function stopWebcam() {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
  webcamStarted = false;
}

const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 608,
  scoreThreshold: 0.4
});

async function loadModels() {
  showStatus('<span class="spinner"></span>Loading face recognition models... (only takes a few seconds)', 'info');
  const MODEL_URL = 'models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  showStatus('✅ Models loaded! Slowly turn your head through each pose below.', 'ok');
  updatePoseUI();
}

// Turns face landmarks into two simple numbers: how far the head is
// turned sideways (yaw) and up/down (pitch), both normalized so they
// work regardless of how close the face is to the camera.
function estimateHeadPose(landmarks) {
  const avg = pts => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length
  });
  const leftEye = avg(landmarks.getLeftEye());
  const rightEye = avg(landmarks.getRightEye());
  const nose = landmarks.getNose()[6] || landmarks.getNose()[3];
  const jaw = landmarks.getJawOutline();
  const chin = jaw[8];

  const eyeCenterX = (leftEye.x + rightEye.x) / 2;
  const eyeCenterY = (leftEye.y + rightEye.y) / 2;
  const eyeDist = Math.abs(rightEye.x - leftEye.x) || 1;
  const faceHeight = Math.abs(chin.y - eyeCenterY) || 1;

  const yaw = (nose.x - eyeCenterX) / eyeDist;
  const pitch = (nose.y - eyeCenterY) / faceHeight;
  return { yaw, pitch };
}

function captureCurrentPose() {
  const buildClubId = document.getElementById('buildClubId').value.trim();
  const name = document.getElementById('name').value.trim();
  if (!buildClubId || !name) {
    showStatus('⚠️ Please fill in both Build Club ID and Name first.', 'err');
    return;
  }
  if (!latestDetection) {
    showStatus('⚠️ No face detected yet. Center your face in the frame.', 'err');
    return;
  }

  if (poseIndex === 0) {
    const pose = estimateHeadPose(latestDetection.landmarks);
    baselineYaw = pose.yaw;
    baselinePitch = pose.pitch;
  }

  capturedDescriptors.push(Array.from(latestDetection.descriptor));
  poseIndex++;
  poseHoldStart = null;
  if (captureRing) captureRing.style.setProperty('--fill', '0%');
  updatePoseUI();

  if (poseIndex < POSES.length) {
    showStatus(`✅ Angle ${poseIndex}/${POSES.length} captured! Now: ${POSES[poseIndex].instruction}.`, 'ok');
  } else {
    showStatus('🎉 All 5 angles captured! Click "Save Registration" to finish.', 'ok');
  }
}

async function saveRegistration() {
  const buildClubId = document.getElementById('buildClubId').value.trim();
  const name = document.getElementById('name').value.trim();
  showStatus('<span class="spinner"></span>Saving your face...', 'info');
  try {
    const res = await fetch('/api/members/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buildClubId, name, role: selectedRole,
        descriptors: capturedDescriptors, adminPassword
      })
    });
    const data = await res.json();
    if (res.ok) {
      showStatus(`✅ ${data.message} You can now go to the Live Camera page.`, 'ok');
      if (typeof showToast === 'function') {
        showToast('✅ Face registered!', `${name} (ID ${buildClubId}) is ready for the Live Camera.`, 'in');
        playBeep('in');
      }
      resetCapture();
    } else {
      showStatus(`❌ ${data.error}`, 'err');
    }
  } catch (err) {
    showStatus('❌ Could not reach the server. Is the backend running?', 'err');
  }
}

captureBtn.addEventListener('click', () => {
  if (poseIndex < POSES.length) {
    captureCurrentPose();
  } else {
    saveRegistration();
  }
});

// Runs continuously: detects the face, draws the box, and checks whether
// the current pose's condition is being held long enough to auto-capture.
async function detectLoop() {
  if (!webcamStarted) {
    requestAnimationFrame(detectLoop);
    return;
  }
  const result = await faceapi
    .detectSingleFace(video, DETECTOR_OPTIONS)
    .withFaceLandmarks()
    .withFaceDescriptor();

  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (result) {
    latestDetection = result;
    const resized = faceapi.resizeResults(result, { width: overlay.width, height: overlay.height });
    faceapi.draw.drawDetections(overlay, resized);

    if (poseIndex < POSES.length) {
      const { yaw, pitch } = estimateHeadPose(result.landmarks);
      const holding = POSES[poseIndex].check(yaw, pitch);

      if (holding) {
        if (poseHoldStart === null) poseHoldStart = performance.now();
        const elapsed = performance.now() - poseHoldStart;
        const pct = Math.min(100, Math.round((elapsed / CAPTURE_HOLD_MS) * 100));
        if (captureRing) captureRing.style.setProperty('--fill', pct + '%');
        if (elapsed >= CAPTURE_HOLD_MS) {
          captureCurrentPose();
        }
      } else {
        poseHoldStart = null;
        if (captureRing) captureRing.style.setProperty('--fill', '0%');
      }
    }
  } else {
    latestDetection = null;
    poseHoldStart = null;
    if (captureRing) captureRing.style.setProperty('--fill', '0%');
  }
  requestAnimationFrame(detectLoop);
}

async function startRegistrationFlow() {
  resetCapture();
  await startWebcam();
  await loadModels();
  detectLoop();
}
