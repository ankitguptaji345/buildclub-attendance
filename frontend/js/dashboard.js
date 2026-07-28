// dashboard.js
// Pulls data from the backend and turns it into stat boxes, a leaderboard,
// role-based sections, a bar chart, an activity heatmap, and tables.

const ROLE_META = {
  admin: { label: 'Admins', icon: '🛡️' },
  mentor: { label: 'Mentors', icon: '🎓' },
  member: { label: 'Members', icon: '🔧' },
  guest: { label: 'Guests', icon: '🙋' }
};

function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

function leaderboardRowHtml(s, i) {
  const medals = ['🥇', '🥈', '🥉'];
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
        <div class="lb-visits">${s.visits} visit${s.visits === 1 ? '' : 's'} · ${s.streak}-day streak</div>
      </div>
    </div>
  `;
}

function renderLeaderboard(summary) {
  const box = document.getElementById('leaderboard');
  if (summary.length === 0) {
    box.innerHTML = '<p>No hours logged yet - once members start checking in, the leaderboard fills up here.</p>';
    return;
  }
  box.innerHTML = summary.map(leaderboardRowHtml).join('');
}

// Splits the combined leaderboard into one mini-leaderboard per role, and
// only renders sections that actually have someone in them - keeps the
// page clean instead of showing four empty "Guests" boxes on day one.
function renderRoleSections(summary, roleByMemberId) {
  const container = document.getElementById('roleSections');
  if (!container) return;

  const byRole = { admin: [], mentor: [], member: [], guest: [] };
  summary.forEach(s => {
    const role = roleByMemberId[s.buildClubId] || 'member';
    (byRole[role] || byRole.member).push(s);
  });

  const sectionsHtml = Object.keys(ROLE_META).map(role => {
    const rows = byRole[role];
    if (!rows || rows.length === 0) return '';
    const meta = ROLE_META[role];
    return `
      <div class="role-section role-${role}">
        <h3>${meta.icon} ${meta.label} <span class="role-count">${rows.length}</span></h3>
        ${rows.map(leaderboardRowHtml).join('')}
      </div>
    `;
  }).join('');

  container.innerHTML = sectionsHtml || '<p>No members registered in any role yet.</p>';
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
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'People' } }
      }
    }
  });
}

// Draws a simple line chart of visits per day over the last 14 days -
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
let roleByMemberIdGlobal = {};

function roleBadgeHtml(buildClubId) {
  const role = roleByMemberIdGlobal[buildClubId] || 'member';
  const meta = ROLE_META[role] || ROLE_META.member;
  return `<span class="table-role-pill role-${role}">${meta.icon} ${role}</span>`;
}

function renderLogTable(logs) {
  const logBody = document.querySelector('#logTable tbody');
  logBody.innerHTML = logs.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.buildClubId}</td>
      <td>${roleBadgeHtml(r.buildClubId)}</td>
      <td>${r.date}</td>
      <td>${fmtTime(r.checkIn)}</td>
      <td>${r.checkOut ? fmtTime(r.checkOut) : '<span class="pill in">Still inside</span>'}</td>
      <td>${r.hours ?? '-'}</td>
    </tr>
  `).join('') || `<tr><td colspan="7">No matching attendance records.</td></tr>`;
}

document.getElementById('logSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = q
    ? allLogs.filter(r => r.name.toLowerCase().includes(q) || String(r.buildClubId).includes(q))
    : allLogs;
  renderLogTable(filtered);
});

// Role filter tabs above the attendance log - "All" plus one per role.
document.querySelectorAll('.role-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const role = tab.dataset.role;
    const filtered = role === 'all'
      ? allLogs
      : allLogs.filter(r => (roleByMemberIdGlobal[r.buildClubId] || 'member') === role);
    renderLogTable(filtered);
  });
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

  // Build a quick lookup of buildClubId -> role so every other section
  // (leaderboard, table, log) can tag people by role without extra fetches.
  const roleByMemberId = {};
  members.forEach(m => { roleByMemberId[m.buildClubId] = m.role || 'member'; });
  roleByMemberIdGlobal = roleByMemberId;

  // ---- Stat boxes ----
  document.getElementById('statInside').textContent = inside.length;
  document.getElementById('statMembers').textContent = members.length;
  document.getElementById('statVisits').textContent = logs.length;

  // ---- Role breakdown chips ----
  const roleCounts = { admin: 0, mentor: 0, member: 0, guest: 0 };
  members.forEach(m => { roleCounts[m.role || 'member'] = (roleCounts[m.role || 'member'] || 0) + 1; });
  const roleChips = document.getElementById('roleChips');
  if (roleChips) {
    roleChips.innerHTML = Object.keys(ROLE_META).map(role =>
      `<span class="role-chip role-${role}">${ROLE_META[role].icon} ${ROLE_META[role].label}: ${roleCounts[role] || 0}</span>`
    ).join('');
  }

  // ---- Leaderboard (combined) ----
  renderLeaderboard(summary);

  // ---- Leaderboard (by role) ----
  renderRoleSections(summary, roleByMemberId);

  // ---- Bar chart: total hours per member ----
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

  // ---- Arrival vs departure times ----
  renderPeakHoursChart(logs);

  // ---- Activity heatmap ----
  renderHeatmap(heatmapData);

  // ---- 14-day visit trend ----
  renderTrendChart(heatmapData);

  // ---- Who's currently inside ----
  const insideBody = document.querySelector('#insideTable tbody');
  insideBody.innerHTML = inside.map(r => `
    <tr>
      <td>${r.name}</td>
      <td>${r.buildClubId}</td>
      <td>${roleBadgeHtml(r.buildClubId)}</td>
      <td>${fmtTime(r.checkIn)}</td>
    </tr>
  `).join('') || `<tr><td colspan="4">Nobody is inside right now.</td></tr>`;

  // ---- Full attendance log ----
  allLogs = logs;
  const activeTab = document.querySelector('.role-tab.active');
  const activeRole = activeTab ? activeTab.dataset.role : 'all';
  const searchBox = document.getElementById('logSearch');
  const q = searchBox ? searchBox.value.trim().toLowerCase() : '';
  let filtered = activeRole === 'all'
    ? allLogs
    : allLogs.filter(r => (roleByMemberId[r.buildClubId] || 'member') === activeRole);
  if (q) {
    filtered = filtered.filter(r => r.name.toLowerCase().includes(q) || String(r.buildClubId).includes(q));
  }
  renderLogTable(filtered);
}

loadDashboard();
// Refresh every 10 seconds so the dashboard stays live during the demo
setInterval(loadDashboard, 10000);
