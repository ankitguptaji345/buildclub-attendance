// home.js
// Pulls a few live numbers from the backend so the home page feels like a
// real, running product instead of a static marketing page - genuinely
// useful during a demo since judges see live proof it isn't just mockups.
async function loadHeroStats() {
  try {
    const [insideRes, membersRes, logsRes] = await Promise.all([
      fetch('/api/attendance/inside'),
      fetch('/api/members'),
      fetch('/api/attendance')
    ]);
    const inside = await insideRes.json();
    const members = await membersRes.json();
 const logs = await logsRes.json();
    const totalHours = logs.reduce((sum, r) => sum + (r.hours || 0), 0);
    animateNumber('heroInside', inside.length);
    animateNumber('heroMembers', members.length);
    animateNumber('heroHours', Math.round(totalHours));
  } catch (err) {
    // Free hosting (Render/Neon free tiers) can take ~30s to wake up from
    // sleep. If the fetches fail, just leave the dashes showing instead of
    // an error - the home page should never look broken.
    console.warn('Could not load live stats yet:', err);
  }
}
// Small count-up animation so the numbers feel alive instead of just
// popping into place - a cheap but effective "polish" touch.
function animateNumber(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  const duration = 600;
  const start = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - start) / duration);
    el.textContent = Math.round(target * progress);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
loadHeroStats();
