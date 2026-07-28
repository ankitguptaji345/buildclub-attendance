// camera.js
// This runs on the makerspace laptop all day. It watches the webcam,
// compares every face it sees to the registered members, and automatically
// logs check-in / check-out through the backend - with a live pop-up + sound.
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusBox = document.getElementById('status');
const videoWrap = document.querySelector('.video-wrap');
let faceMatcher = null;
const COOLDOWN_MS = 20000; // don't re-mark the same person within 20 seconds
const lastMarked = {};     // { buildClubId: timestampOfLastMark }
let soundOn = true;
// ---------------- Detection tuning ---------------
// FIX for "camera misses people who are far away or side-on":
// face-api.js's TinyFaceDetector defaults to inputSize 416 / scoreThreshold
// 0.5, which is tuned for a face that fills most of a webcam-close frame.
// A makerspace camera is usually mounted further back and catches people
// walking in at an angle, so faces show up smaller and less front-on.
// Bumping inputSize up (must be a multiple of 32 - common values are 320,
// 416, 512, 608) lets the detector "see" smaller/farther faces, and
// lowering scoreThreshold stops it from throwing away detections just
// because the face isn't perfectly square-on to the lens. This costs a
// little extra CPU per frame, which is why we still only run twice a
// second (see detectLoop below) instead of every frame.
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({
9 Build Club Attendance - Upgrade Report
  inputSize: 608,
  scoreThreshold: 0.4
});
// 0.6 is face-api.js's own recommended cutoff for "same person" - below
// this Euclidean distance counts as a match, above it counts as unknown.
// We keep it as a named constant here so it's easy to nudge later:
// raising it (e.g. 0.65) makes matching MORE forgiving of angle/lighting
// at the cost of being slightly more likely to confuse two similar-looking
// people; lowering it does the opposite. The real fix for angle tolerance
// is registering multiple face angles per person (see register.js) 
// this threshold is just a fine-tuning knob on top of that.
const MATCH_DISTANCE_THRESHOLD = 0.6;
// ---------------- Live clock ---------------
function updateClock() {
  const el = document.getElementById('liveClock');
  if (el) el.textContent = new Date().toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();
// ---------------- Sound mute toggle ---------------
const muteBtn = document.getElementById('muteBtn');
muteBtn?.addEventListener('click', () => {
  soundOn = !soundOn;
  muteBtn.textContent = soundOn ? ' Sound On' : ' Sound Off';
});
// ---------------- Kiosk / fullscreen mode ---------------
const kioskBtn = document.getElementById('kioskBtn');
kioskBtn?.addEventListener('click', () => {
  document.body.classList.toggle('kiosk-mode');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
});
function showStatus(message, type = 'info') {
  statusBox.innerHTML = message;
  statusBox.className = `status show ${type}`;
}
async function startWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
  } catch (err) {
    showStatus(' Could not access webcam. Please allow camera permission.', 'err');
  }
}
async function loadModels() {
  showStatus('<span class="spinner"></span>Loading face recognition models...', 'info');
  const MODEL_URL = 'models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
}
// Loads every registered member from the backend and builds a "matcher"
// that can quickly compare a new face to all known faces.
async function loadKnownFaces() {
  showStatus('<span class="spinner"></span>Loading registered members...', 'info');
  const res = await fetch('/api/members');
  const members = await res.json();
 if (members.length === 0) {
    showStatus(' No members registered yet. Go to the Register page first.', 'err');
    return;
  }
  // m.descriptors is an ARRAY of face fingerprints (one per angle captured
  // at registration - front, left, right, up, down). Passing all of them
  // in here is exactly what face-api.js's LabeledFaceDescriptors is
  // designed for: it compares an incoming face to every reference angle
  // and averages the distance, so someone caught side-on by the camera
  // still matches closely against the "left"/"right" reference shots
  // instead of only ever being compared to one frontal photo.
  const labeledDescriptors = members.map(m =>
    new faceapi.LabeledFaceDescriptors(
      `${m.name}|${m.buildClubId}`,           // we pack name + id together as the "label"
      m.descriptors.map(d => new Float32Array(d))
    )
  );
  faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, MATCH_DISTANCE_THRESHOLD);
  showStatus(` Ready! Watching for ${members.length} registered member(s).`, 'ok');
  videoWrap.classList.add('scanning');
}
async function markAttendance(name, buildClubId, confidencePct) {
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
    if (data.status === 'checked-in') {
      showToast(` Welcome, ${name}!`, `Match confidence: ${confidencePct}% · Checked in just
        now`, 'in');
      if (soundOn) playBeep('in');
    } else if (data.status === 'checked-out') {
      showToast(` Bye, ${name}!`, data.message.replace(`Bye ${name}! `, ''), 'out');
      if (soundOn) playBeep('out');
    }
    // 'already-checked-in' -> stay quiet, no need to spam a toast
  } catch (err) {
    showToast(' Connection issue', 'Could not reach the server to mark attendance.', 'warn');
  }
}
async function detectLoop() {
  if (faceMatcher) {
    const results = await faceapi
      .detectAllFaces(video, DETECTOR_OPTIONS)
      .withFaceLandmarks()
      .withFaceDescriptors();
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const resized = faceapi.resizeResults(results, { width: overlay.width, height:
      overlay.height });
    resized.forEach((result, i) => {
      const match = faceMatcher.findBestMatch(results[i].descriptor);
      const box = result.detection.box;
 let label = 'Unknown';
      let boxColor = '#e05555';
      if (match.label !== 'unknown') {
        const [name, buildClubId] = match.label.split('|');
        // Turn the "distance" (lower = better match) into a friendly confidence %
        const confidencePct = Math.max(0, Math.round((1 - match.distance) * 100));
        label = `${name} (${confidencePct}%)`;
        boxColor = '#3FA34D';
        markAttendance(name, buildClubId, confidencePct);
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
