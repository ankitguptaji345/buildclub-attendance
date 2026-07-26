// dashboard.js
// Pulls data from the backend and turns it into stat boxes, a bar chart, and tables.

function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

async function loadDashboard() {
  const [membersRes, insideRes, logsRes, summaryRes] = await Promise.all([
    fetch('/api/members'),
    fetch('/api/attendance/inside'),
    fetch('/api/attendance'),
    fetch('/api/attendance/summary')
  ]);

  const members = await membersRes.json();
  const inside = await insideRes.json();
  const logs = await logsRes.json();
  const summary = await summaryRes.json();

  // ---- Stat boxes ----
  document.getElementById('statInside').textContent = inside.length;
  document.getElementById('statMembers').textContent = members.length;
  document.getElementById('statVisits').textContent = logs.length;

  // ---- Bar chart: total hours per member ----
  const ctx = document.getElementById('hoursChart');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: summary.map(s => s.name),
      datasets: [{
        label: 'Total Hours',
        data: summary.map(s => s.totalHours),
        backgroundColor: '#2E86AB'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } }
    }
  });

  // ---- Who's currently inside ----
  const insideBody = document.querySelector('#insideTable tbody');
  insideBody.innerHTML = inside.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.buildClubId}</td>
      <td>${fmtTime(r.checkIn)}</td>
    </tr>
  `).join('') || `<tr><td colspan="3">Nobody is inside right now.</td></tr>`;

  // ---- Full attendance log ----
  const logBody = document.querySelector('#logTable tbody');
  logBody.innerHTML = logs.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.buildClubId}</td>
      <td>${r.date}</td>
      <td>${fmtTime(r.checkIn)}</td>
      <td>${r.checkOut ? fmtTime(r.checkOut) : '<span class="pill in">Still inside</span>'}</td>
      <td>${r.hours ?? '-'}</td>
    </tr>
  `).join('') || `<tr><td colspan="6">No attendance logged yet.</td></tr>`;
}

loadDashboard();
// Refresh every 10 seconds so the dashboard stays live during the demo
setInterval(loadDashboard, 10000);
