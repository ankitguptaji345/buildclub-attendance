// toast.js
// Small shared helper: pretty pop-up notifications + a short "beep" sound.
// Used by the Live Camera and Register pages so recognition feels alive and professional.

function ensureToastContainer() {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  return container;
}

// type: 'in' (green), 'out' (blue), 'warn' (red)
function showToast(title, subtitle = '', type = 'in') {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<div>${title}</div>${subtitle ? `<div class="sub">${subtitle}</div>` : ''}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Generates a quick two-tone beep using the Web Audio API - no sound file needed.
function playBeep(kind = 'in') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = kind === 'out' ? 520 : 780;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Some browsers block audio until the user interacts with the page - that's fine, just skip.
  }
}
