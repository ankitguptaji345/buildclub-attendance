// dashboard.js
// Pulls data from the backend and turns it into stat boxes, a leaderboard,
// a bar chart, an activity heatmap, and tables.
// Enhanced with error handling, loading states, and real-time updates.

// ========== SETUP ==========
const state = {
  members: [],
  inside: [],
  logs: [],
  summary: [],
  heatmap: [],
  loading: false,
  error: null
};

// Ping server to wake from sleep + set up theme
fetch('/api/health').catch(() => {});

// Theme toggle
function initTheme() {
  const saved = localStorage.getItem('bc-theme') || 'light';
  document.body.classList.toggle('dark', saved === 'dark');
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.textContent = saved === 'dark' ? '☀️ Light' : '🌙 Dark';
}
initTheme();

// ========== HELPERS ==========
function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString();
}

function fmtHours(h) {
  if (h === null || h === undefined) return '-';
  return h.toFixed(2);
}

function animateValue(el, start, end, duration = 600) {
  const range = end - start;
  const increment = end > start ? 1 : -1;
  const stepTime = Math.abs(Math.floor(duration / range));
  let current = start;
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }
    el.textContent = current;
  }, stepTime);
}

// ========== RENDERERS ==========
function renderStats() {
  animateValue(document.getElementById('statInside'), 0, state.inside.length);
  animateValue(document.getElementById('statMembers'), 0, state.members.length);
  animateValue(document.getElementById('statVisits'), 0, state.logs.length);
  animateValue(document.getElementById('statTotalHours'), 0, 
    Math.round(state.logs.reduce((sum, r) => sum + (r.hours || 0), 0)));
}

function renderLeaderboard() {
  const box = document.getElementById('leaderboard');
  if (state.summary.length === 0) {
    box.innerHTML = '<div class="empty-state">📊 No activity yet. Register members and start checking in!</div>';
    return;
  }
  
  box.innerHTML = state.summary.map((s, i) => {
    const badgesHtml = (s.badges || []).map(b =>
      `<span class="badge" title="${b.label}">${b.icon} ${b.label}</span>`
    ).join('');
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
    return `
      <div class="leaderboard-row ${i < 3 ? 'top3' : ''}">
        <div class="rank">${medal}</div>
        <div class="member-info">
          <div class="member-name">${s.name} <span class="id-badge">#${s.buildClubId}</span></div>
          <div class="member-badges">${badgesHtml}</div>
          <div class="member-stats">
            <span>🕒 ${s.totalHours} hrs</span>
            <span>📅 ${s.visits} visit${s.visits !== 1 ? 's' : ''}</span>
            <span>🔥 ${s.streak}-day streak</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHeatmap() {
  const box = document.getElementById('heatmap');
  if (!box) return;
  
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
  
  box.innerHTML = days.map(date => {
    const hours = byDate[date] || 0;
    const level = levelFor(hours);
    return `<div class="heatmap-cell ${level}" title="${date}: ${hours} hrs"></div>`;
  }).join('');
}

function renderCharts() {
  // Hours per member chart
  const hoursCtx = document.getElementById('hoursChart');
  if (hoursCtx && window.hoursChartInstance) {
    window.hoursChartInstance.destroy();
  }
  if (hoursCtx) {
    window.hoursChartInstance = new Chart(hoursCtx, {
      type: 'bar',
      data: {
        labels: state.summary.map(s => s.name),
        datasets: [{
          label: 'Total Hours',
          data: state.summary.map(s => s.totalHours),
          backgroundColor: 'rgba(46, 134, 171, 0.8)',
          borderColor: '#2E86AB',
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y} hours`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Hours' },
            grid: { color: 'rgba(255,255,255,0.1)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }
  
  // Peak hours chart
  const peakCtx = document.getElementById('peakHoursChart');
  if (peakCtx && window.peakHoursChartInstance) {
    window.peakHoursChartInstance.destroy();
  }
  if (peakCtx) {
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
          { label: 'Check-ins', data: inCounts, backgroundColor: 'rgba(63, 163, 77, 0.8)', borderRadius: 6 },
          { label: 'Check-outs', data: outCounts, backgroundColor: 'rgba(242, 165, 65, 0.8)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'People' } },
          x: { stacked: false }
        }
      }
    });
  }
  
  // Trend chart (last 14 days)
  const trendCtx = document.getElementById('trendChart');
  if (trendCtx && window.trendChartInstance) {
    window.trendChartInstance.destroy();
  }
  if (trendCtx) {
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
          label: 'Daily Visits',
          data: days.map(d => byDate[d] || 0),
          borderColor: '#2E86AB',
          backgroundColor: 'rgba(46, 134, 171, 0.2)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#2E86AB'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { grid: { display: false } }
        }
      }
    });
  }
}

function renderInsideTable() {
  const tbody = document.querySelector('#insideTable tbody');
  if (tbody) {
    tbody.innerHTML = state.inside.map(r => `
      <tr>
        <td><strong>${r.name}</strong><br><small>#${r.buildClubId}</small></td>
        <td>${fmtTime(r.checkIn)}</td>
        <td>${fmtHours(r.hours)}</td>
      </tr>
    `).join('') || '<tr><td colspan="3" class="empty-state">🏠 Nobody inside right now</td></tr>';
  }
}

function renderLogTable(logs = state.logs) {
  const tbody = document.querySelector('#logTable tbody');
  if (tbody) {
    tbody.innerHTML = logs.map(r => `
      <tr>
        <td><strong>${r.name}</strong><br><small>#${r.buildClubId}</small></td>
        <td>${r.date}</td>
        <td>${fmtTime(r.checkIn)}</td>
        <td>${r.checkOut ? fmtTime(r.checkOut) : '<span class="pill in">Inside</span>'}</td>
        <td>${fmtHours(r.hours)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" class="empty-state">No attendance records yet</td></tr>';
  }
}

// ========== DATA LOADING ==========
async function loadData() {
  if (state.loading) return;
  
  state.loading = true;
  state.error = null;
  
  // Show loading state
  document.getElementById('loadingOverlay')?.classList.add('active');
  
  try {
    const [membersRes, insideRes, logsRes, summaryRes, heatmapRes] = await Promise.all([
      fetch('/api/members'),
      fetch('/api/attendance/inside'),
      fetch('/api/attendance'),
      fetch('/api/attendance/summary'),
      fetch('/api/attendance/heatmap')
    ]);
    
    if (!membersRes.ok) throw new Error('Server waking up...');
    
    state.members = await membersRes.json();
    state.inside = await insideRes.json();
    state.logs = await logsRes.json();
    state.summary = await summaryRes.json();
    state.heatmap = await heatmapRes.json();
    
    // Render everything
    renderStats();
    renderLeaderboard();
    renderHeatmap();
    renderCharts();
    renderInsideTable();
    renderLogTable();
    
  } catch (err) {
    state.error = err.message;
    console.warn('Dashboard load error:', err);
    // Retry after delay
    setTimeout(loadData, 3000);
  } finally {
    state.loading = false;
    document.getElementById('loadingOverlay')?.classList.remove('active');
  }
}

// Search functionality
document.getElementById('logSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = q
    ? state.logs.filter(r => 
        r.name.toLowerCase().includes(q) || 
        String(r.buildClubId).includes(q)
      )
    : state.logs;
  renderLogTable(filtered);
});

// Theme toggle
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('bc-theme', isDark ? 'dark' : 'light');
  document.getElementById('themeToggle').textContent = isDark ? '☀️ Light' : '🌙 Dark';
  // Re-render charts with dark theme colors
  renderCharts();
});

// CSV Export with current filters
document.getElementById('exportBtn')?.addEventListener('click', () => {
  const q = document.getElementById('logSearch')?.value.trim().toLowerCase() || '';
  const logs = q
    ? state.logs.filter(r => r.name.toLowerCase().includes(q) || String(r.buildClubId).includes(q))
    : state.logs;
  
  const csv = [
    ['Name', 'ID', 'Date', 'Check-In', 'Check-Out', 'Hours'],
    ...logs.map(r => [
      r.name,
      r.buildClubId,
      r.date,
      r.checkIn || '',
      r.checkOut || '',
      r.hours || ''
    ])
  ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `buildclub_attendance_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Auto-refresh every 10 seconds
function startAutoRefresh() {
  loadData();
  setInterval(loadData, 10000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Add loading overlay if not exists
  if (!document.getElementById('loadingOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  
  startAutoRefresh();
});
