// camera.js
// This runs on the makerspace laptop all day. It watches the webcam,
// compares every face it sees to the registered members, and automatically
// logs check-in / check-out through the backend.

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusBox = document.getElementById('status');

let faceMatcher = null;
const COOLDOWN_MS = 20000; // don't re-mark the same person within 20 seconds
const lastMarked = {};     // { buildClubId: timestampOfLastMark }

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
  const MODEL_URL = 'models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
}

// Loads every registered member from the backend and builds a "matcher"
// that can quickly compare a new face to all known faces.
async function loadKnownFaces() {
  showStatus('⏳ Loading registered members...', 'info');
  const res = await fetch('/api/members');
  const members = await res.json();

  if (members.length === 0) {
    showStatus('⚠️ No members registered yet. Go to the Register page first.', 'err');
    return;
  }

  const labeledDescriptors = members.map(m =>
    new faceapi.LabeledFaceDescriptors(
      `${m.name}|${m.buildClubId}`,           // we pack name + id together as the "label"
      [new Float32Array(m.descriptor)]
    )
  );

  // 0.6 is the standard distance threshold recommended by face-api.js
  faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
  showStatus(`✅ Ready! Watching for ${members.length} registered member(s).`, 'ok');
}

async function markAttendance(name, buildClubId) {
  const now = Date.now();
  if (lastMarked[buildClubId] && now - lastMarked[buildClubId] < COOLDOWN_MS) {
    return; // too soon, skip to avoid spamming the same check-in/out
  }
  lastMarked[buildClubId] = now;

  try {
    const res = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buildClubId, name })
    });
    const data = await res.json();
    showStatus(`👋 ${data.message}`, 'ok');
  } catch (err) {
    showStatus('❌ Could not reach the server to mark attendance.', 'err');
  }
}

async function detectLoop() {
  if (faceMatcher) {
    const options = new faceapi.TinyFaceDetectorOptions();
    const results = await faceapi
      .detectAllFaces(video, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const resized = faceapi.resizeResults(results, { width: overlay.width, height: overlay.height });

    resized.forEach((result, i) => {
      const match = faceMatcher.findBestMatch(results[i].descriptor);
      const box = result.detection.box;

      let label = 'Unknown';
      let boxColor = '#e05555';

      if (match.label !== 'unknown') {
        const [name, buildClubId] = match.label.split('|');
        label = name;
        boxColor = '#3FA34D';
        markAttendance(name, buildClubId);
      }

      const drawBox = new faceapi.draw.DrawBox(box, { label, boxColor });
      drawBox.draw(overlay);
    });
  }

  // Run recognition roughly twice a second - fast enough to feel live,
  // gentle enough not to overload the laptop.
  setTimeout(() => requestAnimationFrame(detectLoop), 500);
}

(async function init() {
  await startWebcam();
  await loadModels();
  await loadKnownFaces();
  detectLoop();
})();
