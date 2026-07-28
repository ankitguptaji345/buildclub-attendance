// dashboard.js - COMPLETE FIX FOR EMPTY DASHBOARD
// This fixes: "dashboard not showing anything" by adding health ping + error handling

// ===== IMMEDIATE: Wake up Render backend =====
fetch('/api/health').catch(() => {});

// ===== STATE =====
let state = {
  members: [],
  inside: [],
  logs: [],
  summary: [],
  heatmap: [],
  loading: false,
  error: null
};

// ===== HELPERS =====
function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

// ===== RENDER FUNCTIONS =====
function renderAll() {
  // Stats
  document.getElementById('statInside').textContent = state.inside.length;
  document.getElementById('statMembers').textContent = state.members.length;
  document.getElementById('statVisits').textContent = state.logs.length;
  const totalHours = state.logs.reduce((sum, r) => sum + (r.hours || 0), 0);
  document.getElementById('statTotalHours').textContent = totalHours.toFixed(1);

  // Leaderboard
  const lb = document.getElementById('leaderboard');
  if (state.summary.length === 0) {
    lb.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">No activity yet. Register members and start checking in!</p>';
  } else {
    lb.innerHTML = state.summary.map((s, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const medal = i < 3 ? medals[i] : i + 1;
      const badgesHtml = (s.badges || []).map(b => `<span class="badge">${b.icon} ${b.label}</span>`).join('');
      return `
        <div class="leaderboard-row">
          <div class="rank">${medal}</div>
          <div class="lb-name">
            ${s.name} <span style="color:#999;">#${s.buildClubId}</span>
            <div class="badge-row">${badgesHtml}</div>
          </div>
          <div style="text-align:right;">
            <div class="lb-hours">${s.totalHours} hrs</div>
            <div class="lb-visits">${s.visits} visit${s.visits !== 1 ? 's' : ''} · ${s.streak}-day streak</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Heatmap
  const hm = document.getElementById('heatmap');
  if (hm) {
    const byDate = {};
    state.heatmap.forEach(d => { byDate[d.date] = d.totalHours; });
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
    hm.innerHTML = days.map(date => {
      const hours = byDate[date] || 0;
      const level = levelFor(hours);
      return `<div class="cell ${level}" title="${date}: ${hours} hrs"></div>`;
    }).join('');
  }

  // Charts
  const hoursCtx = document.getElementById('hoursChart');
  if (hoursCtx) {
    if (window.hoursChartInstance) window.hoursChartInstance.destroy();
    window.hoursChartInstance = new Chart(hoursCtx, {
      type: 'bar',
      data: {
        labels: state.summary.map(s => s.name),
        datasets: [{
          label: 'Total Hours',
          data: state.summary.map(s => s.totalHours),
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
  }

  const peakCtx = document.getElementById('peakHoursChart');
  if (peakCtx) {
    if (window.peakHoursChartInstance) window.peakHoursChartInstance.destroy();
    const inCounts = new Array(24).fill(0);
    const outCounts = new Array(24).fill(0);
    state.logs.forEach(r => {
      if (r.checkIn) inCounts[new Date(r.checkIn).getHours()] += 1;
      if (r.checkOut) outCounts[new Date(r.checkOut).getHours()] += 1;
    });
    const hourLabels = Array.from({ length: 24 }, (_, h) => {
      const period = h < 12 ? 'AM' : 'PM';
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      return `${displayHour}${period}`;
    });
    window.peakHoursChartInstance = new Chart(peakCtx, {
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
        scales: { y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'People' } } }
      }
    });
  }

  const trendCtx = document.getElementById('trendChart');
  if (trendCtx) {
    if (window.trendChartInstance) window.trendChartInstance.destroy();
    const byDate = {};
    state.heatmap.forEach(d => { byDate[d.date] = d.visits || 0; });
    const days = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    window.trendChartInstance = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: days.map(d => d.slice(5)),
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

  // Currently Inside table
  const insideTbody = document.querySelector('#insideTable tbody');
  if (insideTbody) {
    insideTbody.innerHTML = state.inside.map(r => `
      <tr>
        <td>${r.name}</td>
        <td>${r.buildClubId}</td>
        <td>${fmtTime(r.checkIn)}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" style="text-align:center; color:#999;">Nobody inside right now</td></tr>';
  }

  // Log table
  const logTbody = document.querySelector('#logTable tbody');
  if (logTbody) {
    const searchQ = document.getElementById('logSearch')?.value.trim().toLowerCase() || '';
    const filteredLogs = searchQ 
      ? state.logs.filter(r => r.name.toLowerCase().includes(searchQ) || String(r.buildClubId).includes(searchQ))
      : state.logs;
    logTbody.innerHTML = filteredLogs.map(r => `
      <tr>
        <td>${r.name}</td>
        <td>${r.buildClubId}</td>
        <td>${r.date}</td>
        <td>${fmtTime(r.checkIn)}</td>
        <td>${r.checkOut ? fmtTime(r.checkOut) : '<span class="pill in">Still inside</span>'}</td>
        <td>${r.hours ?? '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; color:#999;">No attendance records</td></tr>';
  }
}

// ===== LOAD DATA WITH ERROR HANDLING =====
async function loadData() {
  if (state.loading) return;
  state.loading = true;

  // Show loading state
  const statBoxes = document.querySelectorAll('.stat-box .num');
  statBoxes.forEach(el => el.textContent = '...');

  try {
    const [membersRes, insideRes, logsRes, summaryRes, heatmapRes] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/attendance/inside'),
      fetch('/api/attendance'),
      fetch('/api/attendance/summary'),
      fetch('/api/attendance/heatmap')
    ]);

    // Check if responses are OK
    if (!membersRes.ok || !insideRes.ok || !logsRes.ok || !summaryRes.ok || !heatmapRes.ok) {
      throw new Error('Server is waking up...');
    }

    state.members = await membersRes.json();
    state.inside = await insideRes.json();
    state.logs = await logsRes.json();
    state.summary = await summaryRes.json();
    state.heatmap = await heatmapRes.json();

    renderAll();
    state.error = null;

  } catch (err) {
    state.error = err.message;
    console.warn('Dashboard error:', err);
    // Retry after 3 seconds
    setTimeout(loadData, 3000);
  } finally {
    state.loading = false;
  }
}

// ===== SEARCH =====
document.getElementById('logSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = q
    ? state.logs.filter(r => r.name.toLowerCase().includes(q) || String(r.buildClubId).includes(q))
    : state.logs;
  const tbody = document.querySelector('#logTable tbody');
  if (tbody) {
    tbody.innerHTML = filtered.map(r => `
      <tr>
        <td>${r.name}</td>
        <td>${r.buildClubId}</td>
        <td>${r.date}</td>
        <td>${fmtTime(r.checkIn)}</td>
        <td>${r.checkOut ? fmtTime(r.checkOut) : '<span class="pill in">Still inside</span>'}</td>
        <td>${r.hours ?? '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align:center; color:#999;">No matching records</td></tr>';
  }
});

// ===== AUTO REFRESH =====
function startAutoRefresh() {
  loadData(); // Initial load
  setInterval(loadData, 10000); // Refresh every 10 seconds
}

// ===== INITIALIZE =====
startAutoRefresh();
