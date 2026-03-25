import { initNavbar } from './navbar.js';
import { getClassInfo } from './calc.js';

const PROXY_URL = 'https://chunirec-proxy.k-chunithm.workers.dev';

// Definitions
const CLASS_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CLASS_NAMES = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'];
const STAR_LEVELS = [1, 2, 3, 4];

let starChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavbar(true); // true means it's in a subdirectory
  loadStatistics();
});

async function loadStatistics() {
  const loading = document.getElementById('loading-area');
  const errorArea = document.getElementById('error-area');
  const errorMsg = document.getElementById('error-msg');
  const resultArea = document.getElementById('result-area');

  try {
    const res = await fetch(`${PROXY_URL}/users`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!json.success) throw new Error(json.error || '不明なエラー');

    const users = json.data || [];
    
    // Process Data
    const classCounts = {};
    const classStarCounts = {}; // Track star distribution per class
    const class10Data = { 1: [], 2: [], 3: [], 4: [] };
    
    CLASS_ORDER.forEach(id => {
      classCounts[id] = 0;
      classStarCounts[id] = {};
      STAR_LEVELS.forEach(s => classStarCounts[id][s] = 0);
    });

    users.forEach(u => {
      // API returns 'value' for chuniforce
      const forceObj = getClassInfo(u.value);
      if (classCounts[forceObj.id] !== undefined) {
        classCounts[forceObj.id]++;
      }
      if (classStarCounts[forceObj.id] && classStarCounts[forceObj.id][forceObj.stars] !== undefined) {
        classStarCounts[forceObj.id][forceObj.stars]++;
      }
      if (forceObj.id === 10) {
        class10Data[forceObj.stars].push(u.value);
      }
    });
    
    window.classStarCounts = classStarCounts;
    window.class10Data = class10Data;

    const totalUsers = users.length;
    document.getElementById('total-users-count').textContent = totalUsers + '人';

    // Render Class Data
    renderClassTable(classCounts, totalUsers);
    renderClassChart(classCounts);

    // Initial Star render (Class 10)
    updateStarView(10);

    // Setup Tab Listeners
    document.querySelectorAll('#star-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#star-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const classId = parseInt(e.target.getAttribute('data-class'), 10);
        updateStarView(classId);
      });
    });

    // Setup Class 10 Tab Listeners
    updateClass10View('all');
    document.querySelectorAll('#class10-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#class10-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const starAttr = e.target.getAttribute('data-star');
        const star = starAttr === 'all' ? 'all' : parseInt(starAttr, 10);
        updateClass10View(star);
      });
    });

    loading.classList.add('hidden');
    errorArea.style.display = 'none';
    resultArea.classList.remove('hidden');

  } catch (e) {
    loading.classList.add('hidden');
    errorArea.style.display = 'block';
    errorArea.classList.remove('hidden');
    errorMsg.textContent = 'データの取得に失敗しました: ' + e.message;
  }
}

function updateStarView(classId) {
  const starCounts = window.classStarCounts[classId];
  const className = CLASS_NAMES[classId - 1];
  
  // Total users in this class for percentage calculation
  const totalInClass = STAR_LEVELS.reduce((sum, s) => sum + starCounts[s], 0);

  renderStarTable(starCounts, totalInClass);
  renderStarChart(starCounts, className);
}

function renderClassTable(classCounts, total) {
  const tbody = document.getElementById('class-tbody');
  tbody.innerHTML = CLASS_ORDER.map((id, index) => {
    const count = classCounts[id];
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    return `
      <tr>
        <td style="text-align: left;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="ranking-roman cf-color-${id}" style="font-size: 1.1em; transform: none; text-shadow: none; display: inline-block;">
              ${CLASS_NAMES[index]}
            </div>
            <span style="font-size: 0.8em; color: var(--text-muted);">(Class ${id})</span>
          </div>
        </td>
        <td style="text-align: right;">${count}人</td>
        <td style="text-align: right; color: var(--text);">${percentage}%</td>
      </tr>
    `;
  }).join('');
}

function renderStarTable(starCounts, total) {
  const tbody = document.getElementById('star-tbody');
  
  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="placeholder-cell" style="text-align: center;">該当するユーザーがいません</td></tr>`;
    return;
  }
  
  tbody.innerHTML = STAR_LEVELS.map(stars => {
    const count = starCounts[stars];
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    const starsHtml = Array.from({ length: 4 }, (_, i) =>
        `<div class="star-icon ${i < stars ? 'active' : ''}" style="width: 14px; height: 14px; display: inline-block;"></div>`
    ).join('');

    return `
      <tr>
        <td style="text-align: left;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="display: flex; gap: 2px;">${starsHtml}</div>
            <span style="font-size: 0.85em; color: var(--text); font-weight: bold;">★${stars}</span>
          </div>
        </td>
        <td style="text-align: right;">${count}人</td>
        <td style="text-align: right; color: var(--text);">${percentage}%</td>
      </tr>
    `;
  }).join('');
}

function renderClassChart(classCounts) {
  const ctx = document.getElementById('classChart').getContext('2d');
  
  // Custom colors derived from class CSS colors
  const bgColors = [
    '#B0BEC5', // 1
    '#81C784', // 2
    '#64B5F6', // 3
    '#4DD0E1', // 4
    '#F06292', // 5
    '#BA68C8', // 6
    '#E57373', // 7
    '#FF8A65', // 8
    '#FFB74D', // 9
    '#FFF176'  // 10
  ];

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: CLASS_NAMES,
      datasets: [{
        label: '人数',
        data: CLASS_ORDER.map(id => classCounts[id]),
        backgroundColor: bgColors.map(c => c + '80'),
        borderColor: bgColors,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 46, 0.9)',
          titleFont: { family: "'Outfit', 'Noto Sans JP', sans-serif" },
          bodyFont: { family: "'Outfit', 'Noto Sans JP', sans-serif" },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            title: (items) => `Class ${CLASS_ORDER[items[0].dataIndex]}`,
            label: (ctx) => `${ctx.raw}人`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '人数 (人)',
            color: '#a0a0b0',
            font: { family: "'Outfit', 'Noto Sans JP', sans-serif" }
          },
          ticks: {
            stepSize: 1,
            color: '#a0a0b0',
            font: { family: "'Outfit', sans-serif" }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            color: '#e0e0e0',
            font: { family: "'Outfit', 'Noto Sans JP', sans-serif", weight: 'bold' }
          },
          grid: { display: false }
        }
      }
    }
  });
}

function renderStarChart(starCounts, className) {
  if (starChartInstance) {
    starChartInstance.destroy();
  }
  
  const ctx = document.getElementById('starChart').getContext('2d');
  
  const bgColors = ['#90a4ae', '#ffb74d', '#ff8a65', '#e57373'];

  starChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: STAR_LEVELS.map(s => `★${s}`),
      datasets: [{
        label: `Class ${className} 人数`,
        data: STAR_LEVELS.map(s => starCounts[s]),
        backgroundColor: bgColors.map(c => c + '80'),
        borderColor: bgColors,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 46, 0.9)',
          titleFont: { family: "'Outfit', 'Noto Sans JP', sans-serif" },
          bodyFont: { family: "'Outfit', 'Noto Sans JP', sans-serif" },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            label: (ctx) => `${ctx.raw}人`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '人数 (人)',
            color: '#a0a0b0',
            font: { family: "'Outfit', 'Noto Sans JP', sans-serif" }
          },
          ticks: {
            stepSize: 1,
            color: '#a0a0b0',
            font: { family: "'Outfit', sans-serif" }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            color: '#e0e0e0',
            font: { family: "'Outfit', 'Noto Sans JP', sans-serif", weight: 'bold' }
          },
          grid: { display: false }
        }
      }
    }
  });
}

// ──────────────────────────────────────────────────────────
// クラス10（X）用の分布描画処理
// ──────────────────────────────────────────────────────────
let class10ChartInstance = null;

function updateClass10View(star) {
  let data = [];
  if (star === 'all') {
    for (let i = 1; i <= 4; i++) {
        if (window.class10Data[i]) data.push(...window.class10Data[i]);
    }
  } else {
    data = window.class10Data[star] || [];
  }
  const total = data.length;

  const bins = {};
  let minBase = 20.0;
  if (star !== 'all') {
    minBase = 20.0 + (star - 1);
    if (star === 4) minBase = 23.0; // ★4 is 23.0 and above
  }
  
  let maxVal = minBase;
  data.forEach(v => {
    if (v > maxVal) maxVal = v;
  });
  
  let maxBase = Math.floor(maxVal * 10) / 10;
  
  // 0.1 increments initialization
  for (let b = minBase; b <= maxBase; b = Math.round((b + 0.1) * 10) / 10) {
    bins[b.toFixed(1)] = 0;
  }
  
  // Bucket assignment
  data.forEach(v => {
    let binBase = Math.floor(v * 10) / 10;
    if (binBase < minBase) binBase = minBase;
    const key = binBase.toFixed(1);
    if (bins[key] !== undefined) {
      bins[key]++;
    } else {
      bins[key] = 1;
    }
  });

  const sortedKeys = Object.keys(bins).sort((a, b) => parseFloat(a) - parseFloat(b));
  
  renderClass10Table(bins, sortedKeys, total, star);
  renderClass10Chart(bins, sortedKeys, star);
}

function renderClass10Table(bins, sortedKeys, total, star) {
  const tbody = document.getElementById('class10-tbody');
  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="placeholder-cell" style="text-align: center;">該当するユーザーがいません</td></tr>`;
    return;
  }
  
  // Tables typically show largest values at the top
  const tableKeys = [...sortedKeys].reverse();

  tbody.innerHTML = tableKeys.map((key, i) => {
    const count = bins[key];
    // Hide empty bins in the middle to save space
    if (count === 0 && i !== 0 && i !== tableKeys.length - 1) return '';
    
    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    let label = `${key}00 〜 ${(parseFloat(key) + 0.099).toFixed(3)}`;
    
    return `
      <tr>
        <td style="text-align: left; font-family: var(--font-en); font-weight: bold; color: var(--accent);">
          ${label}
        </td>
        <td style="text-align: right;">${count}人</td>
        <td style="text-align: right; color: var(--text);">${percentage}%</td>
      </tr>
    `;
  }).filter(html => html !== '').join('');
}

function renderClass10Chart(bins, sortedKeys, star) {
  if (class10ChartInstance) {
    class10ChartInstance.destroy();
  }
  
  const ctx = document.getElementById('class10Chart').getContext('2d');
  const labels = sortedKeys.map(k => k);
  const data = sortedKeys.map(k => bins[k]);

  class10ChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: star === 'all' ? `Class X 全体 人数` : `Class X ★${star} 人数`,
        data: data,
        backgroundColor: 'rgba(255, 241, 118, 0.65)',
        borderColor: '#FFF176',
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(26, 26, 46, 0.9)',
          titleFont: { family: "'Outfit', 'Noto Sans JP', sans-serif" },
          bodyFont: { family: "'Outfit', 'Noto Sans JP', sans-serif" },
          padding: 10,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            title: (items) => `${items[0].label} 台`,
            label: (ctx) => `${ctx.raw}人`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: '人数 (人)',
            color: '#a0a0b0',
            font: { family: "'Outfit', 'Noto Sans JP', sans-serif" }
          },
          ticks: {
            stepSize: 1,
            color: '#a0a0b0',
            font: { family: "'Outfit', sans-serif" }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            color: '#e0e0e0',
            font: { family: "'Outfit', 'Noto Sans JP', sans-serif", weight: 'bold' }
          },
          grid: { display: false }
        }
      }
    }
  });
}
