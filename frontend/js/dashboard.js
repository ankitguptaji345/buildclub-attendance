// dashboard.js
// Pulls data from the backend and turns it into stat boxes, a leaderboard,
// a bar chart, an activity heatmap, and tables.
function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}
function renderLeaderboard(summary) {
  const box = document.getElementById('leaderboard');
  if (summary.length === 0) {
    box.innerHTML = '<p>No hours logged yet - once members start checking in, the
      leaderboard fills up here.</p>';
    return;
  }
  const medals = ['', '', ''];
  box.innerHTML = summary.map((s, i) => {
    const badgesHtml = (s.badges || []).map(b =>
      `<span class="badge" title="${b.label}">${b.icon} ${b.label}</span>`
    ).join('');
    return `
      <div class="leaderboard-row ${i < 3 ? 'rank' + (i + 1) : ''}">
        <div class="medal">${medals[i] || (i + 1)}</div>
        <div class="lb-name">
          ${s.name} <span style="color:#999;font-weight:400;">#${s.buildClubId}</span>
          <div class="badge-row">${badgesHtml}</div>
        </div>
        <div style="text-align:right;">
          <div class="lb-hours">${s.totalHours} hrs</div>
          <div class="lb-visits">${s.visits} visit${s.visits === 1 ? '' : 's'} ·
            ${s.streak}-day streak</div>
        </div>
      </div>
    `;
  }).join('');
}
// Draws a GitHub-style activity calendar: one little square per day,
// darker green = more hours logged that day.
function renderHeatmap(heatmapData) {
  const box = document.getElementById('heatmap');
  const byDate = {};
  heatmapData.forEach(d => { byDate[d.date] = d.totalHours; });
  const days = [];
  const today = new Date();
  for (let i = 26 * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  function levelFor(hours) {
    if (!hours) return '';
    if (hours < 1) return 'l1';
    if (hours < 3) return 'l2';
    if (hours < 6) return 'l3';
    return 'l4';
  }
  box.innerHTML = days.map(date => {
    const hours = byDate[date] || 0;
 const level = levelFor(hours);
    return `<div class="cell ${level}" title="${date} - ${hours} hrs"></div>`;
  }).join('');
}
// Draws a grouped bar chart of what hour of the day people usually arrive
// vs. leave - answers "when is the makerspace actually busy?" which is
// exactly what you'd want to know for staffing the front desk or picking
// a time for an event.
function renderPeakHoursChart(logs) {
  const inCounts = new Array(24).fill(0);
  const outCounts = new Array(24).fill(0);
  logs.forEach(r => {
    if (r.checkIn) inCounts[new Date(r.checkIn).getHours()] += 1;
    if (r.checkOut) outCounts[new Date(r.checkOut).getHours()] += 1;
  });
  const hourLabels = Array.from({ length: 24 }, (_, h) => {
    const period = h < 12 ? 'AM' : 'PM';
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}${period}`;
  });
  const canvas = document.getElementById('peakHoursChart');
  if (!canvas) return;
  if (window.peakHoursChartInstance) window.peakHoursChartInstance.destroy();
  window.peakHoursChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: hourLabels,
      datasets: [
        { label: 'Check-ins', data: inCounts, backgroundColor: '#3FA34D', borderRadius: 4 },
        { label: 'Check-outs', data: outCounts, backgroundColor: '#F2A541', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true, position: 'top' } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text:
          'People' } }
      }
    }
  });
}
// Draws a simple line chart of visits per day over the last 14 days 
// a quick "is this thing actually getting used?" growth trend for judges.
function renderTrendChart(heatmapData) {
  const byDate = {};
  heatmapData.forEach(d => { byDate[d.date] = d.visits || 0; });
  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  if (window.trendChartInstance) window.trendChartInstance.destroy();
  window.trendChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: days.map(d => d.slice(5)), // "MM-DD"
      datasets: [{
 label: 'Visits',
        data: days.map(d => byDate[d] || 0),
        borderColor: '#2E86AB',
        backgroundColor: 'rgba(46,134,171,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}
let allLogs = []; // kept so the search box can filter without re-fetching
function renderLogTable(logs) {
  const logBody = document.querySelector('#logTable tbody');
  logBody.innerHTML = logs.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.buildClubId}</td>
      <td>${r.date}</td>
      <td>${fmtTime(r.checkIn)}</td>
      <td>${r.checkOut ? fmtTime(r.checkOut) : '<span class="pill in">Still
        inside</span>'}</td>
      <td>${r.hours ?? '-'}</td>
    </tr>
  `).join('') || `<tr><td colspan="6">No matching attendance records.</td></tr>`;
}
document.getElementById('logSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = q
    ? allLogs.filter(r => r.name.toLowerCase().includes(q) ||
      String(r.buildClubId).includes(q))
    : allLogs;
  renderLogTable(filtered);
});
async function loadDashboard() {
  const [membersRes, insideRes, logsRes, summaryRes, heatmapRes] = await Promise.all([
    fetch('/api/members'),
    fetch('/api/attendance/inside'),
    fetch('/api/attendance'),
    fetch('/api/attendance/summary'),
    fetch('/api/attendance/heatmap')
  ]);
  const members = await membersRes.json();
  const inside = await insideRes.json();
  const logs = await logsRes.json();
  const summary = await summaryRes.json();
  const heatmapData = await heatmapRes.json();
  // ---- Stat boxes ---
  document.getElementById('statInside').textContent = inside.length;
  document.getElementById('statMembers').textContent = members.length;
  document.getElementById('statVisits').textContent = logs.length;
  // ---- Leaderboard ---
  renderLeaderboard(summary);
  // ---- Bar chart: total hours per member ---
  const ctx = document.getElementById('hoursChart');
  if (window.hoursChartInstance) window.hoursChartInstance.destroy();
 window.hoursChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: summary.map(s => s.name),
      datasets: [{
        label: 'Total Hours',
        data: summary.map(s => s.totalHours),
        backgroundColor: '#2E86AB',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } }
    }
  });
  // ---- Arrival vs departure times ---
  renderPeakHoursChart(logs);
  // ---- Activity heatmap ---
  renderHeatmap(heatmapData);
  // ---- 14-day visit trend ---
  renderTrendChart(heatmapData);
  // ---- Who's currently inside ---
  const insideBody = document.querySelector('#insideTable tbody');
  insideBody.innerHTML = inside.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.buildClubId}</td>
      <td>${fmtTime(r.checkIn)}</td>
    </tr>
  `).join('') || `<tr><td colspan="3">Nobody is inside right now.</td></tr>`;
  // ---- Full attendance log ---
  allLogs = logs;
  const searchBox = document.getElementById('logSearch');
  const q = searchBox ? searchBox.value.trim().toLowerCase() : '';
  const filtered = q
    ? allLogs.filter(r => r.name.toLowerCase().includes(q) ||
      String(r.buildClubId).includes(q))
    : allLogs;
  renderLogTable(filtered);
}
loadDashboard();
// Refresh every 10 seconds so the dashboard stays live during the demo
setInterval(loadDashboard, 10000);
