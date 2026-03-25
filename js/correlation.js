import { initNavbar } from './navbar.js';
import { getClassInfo } from './calc.js';

const PROXY_URL = 'https://chunirec-proxy.k-chunithm.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
  initNavbar(true);
  renderStaticTable();
  loadData();
});

function renderStaticTable() {
  const tbody = document.getElementById('static-target-tbody');
  const targets = [
    { class: 10, name: 'Ⅹ', star: 4, color: 'zeternal', bound: 23.00, req: '全白レベル、定数15後半のAJ多数', est: '17.65〜' },
    { class: 10, name: 'Ⅹ', star: 3, color: 'zeternal', bound: 22.00, req: '全国トップランカーレベルの到達点', est: '17.50〜17.65' },
    { class: 10, name: 'Ⅹ', star: 2, color: 'zeternal', bound: 21.00, req: '定数15.0+の全AJなど、極めて高いスコア力', est: '17.40〜17.50' },
    { class: 10, name: 'Ⅹ', star: 1, color: 'zeternal', bound: 20.00, req: '定数14.9近辺の虹レ相当、15.0+のAJ多数', est: '17.30〜17.40' },
    { class: 9, name: 'Ⅸ', color: 'neunstral', bound: 19.00, req: '定数14.8のAJ, 15.0のSSS+程度', est: '17.15〜17.30' },
    { class: 8, name: 'Ⅷ', color: 'achtrum', bound: 18.00, req: '定数14.6のAJ, 14.8のSSS+程度', est: '17.00〜17.15' },
    { class: 7, name: 'Ⅶ', color: 'siebergent', bound: 17.00, req: '定数14.4のAJ, 14.6のSSS+程度', est: '16.85〜17.00' },
    { class: 6, name: 'Ⅵ', color: 'sechside', bound: 16.00, req: '定数14.2のAJ, 14.4のSSS+程度', est: '16.70〜16.85' },
    { class: 5, name: 'Ⅴ', color: 'funfmeil', bound: 15.00, req: '定数14.0のAJ, 14.2のSSS+程度', est: '16.50〜16.70' },
    { class: 4, name: 'Ⅳ', color: 'fierambre', bound: 14.00, req: '定数13.8のAJ, 14.0のSSS+程度', est: '16.30〜16.50' },
    { class: 3, name: 'Ⅲ', color: 'dreidian', bound: 12.00, req: '定数13.5以上の鳥プラがメイン', est: '16.00〜16.20' },
    { class: 2, name: 'Ⅱ', color: 'zweilean', bound: 10.00, req: '定数13.0以上の鳥プラがメイン', est: '〜16.00' },
    { class: 1, name: 'Ⅰ', color: 'ainshen', bound: 0.00, req: 'ゲームを始めたばかり', est: '〜15.00' },
  ];

  tbody.innerHTML = targets.map(t => {
    let starHtml = '';
    if (t.star) {
      starHtml = `<div style="display: flex; gap: 2px; margin-left: 8px;">` + 
                 Array.from({ length: 4 }, (_, i) => `<div class="star-icon ${i < t.star ? 'active' : ''}" style="width: 12px; height: 12px; display: inline-block;"></div>`).join('') +
                 `</div>`;
    }

    return `
      <tr>
        <td style="text-align: left;">
          <div style="display: flex; align-items: center;">
            <div class="ranking-roman cf-color-${t.class}" style="font-size: 1.1em; transform: none; text-shadow: none;">
              ${t.name}
            </div>
            ${starHtml}
          </div>
        </td>
        <td style="text-align: right; color: var(--accent); font-family: var(--font-en); font-weight: bold;">${t.bound.toFixed(2)}</td>
        <td style="text-align: left; color: var(--text);">${t.req}</td>
        <td style="text-align: right; color: var(--text);">${t.est}</td>
      </tr>
    `;
  }).join('');
}

async function loadData() {
  const loading = document.getElementById('loading-area');
  const errorArea = document.getElementById('error-area');
  const resultArea = document.getElementById('result-area');

  try {
    const res = await fetch(`${PROXY_URL}/users`);
    if(!res.ok) throw new Error('API Error');
    const json = await res.json();
    const users = json.data || [];

    // ratingが保存されているユーザーのみ散布図・バケット表に使用
    // （rating機能実装前に登録したユーザーは rating=0 のまま）
    const ratingUsers = users.filter(u => u.rating && parseFloat(u.rating) > 0);

    // ユーザー数の内訳をページに表示
    renderUserCount(users.length, ratingUsers.length);
    renderScatterPlot(ratingUsers);
    renderBucketTable(ratingUsers);

    loading.classList.add('hidden');
    resultArea.classList.remove('hidden');
  } catch (e) {
    loading.classList.add('hidden');
    errorArea.style.display = 'block';
    errorArea.classList.remove('hidden');
    errorArea.querySelector('#error-msg').textContent = 'データの取得に失敗しました: ' + e.message;
  }
}

function renderUserCount(total, withRating) {
  const el = document.getElementById('user-count-info');
  if (!el) return;
  const noRating = total - withRating;
  el.innerHTML = `
    <span style="font-weight: bold; color: var(--text);">登録ユーザー数: <span style="color: var(--accent); font-family: var(--font-en);">${total}</span> 人</span>
    <span style="color: var(--text-muted); font-size: 0.85em;">
      （うち散布図反映済み: ${withRating} 人 ／ 未反映: ${noRating} 人）
    </span>
    ${noRating > 0 ? `<br><span style="font-size: 0.8em; color: var(--text-muted);">※未反映の方はログイン後にスコアを再計算すると追加されます。</span>` : ''}
  `;
}

function renderScatterPlot(validUsers) {
  const ctx = document.getElementById('scatterChart').getContext('2d');

  if (validUsers.length === 0) {
    // Show empty state inside canvas somehow or let Chart.js drop
  }

  const dataPoints = validUsers.map(u => {
    const cls = getClassInfo(u.value);
    return {
      x: parseFloat(u.rating),
      y: u.value,
      name: u.display_name,
      classId: cls.id
    };
  });

  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'ユーザー',
        data: dataPoints,
        backgroundColor: 'rgba(0, 229, 255, 0.7)',
        borderColor: 'rgba(0, 229, 255, 1)',
        pointRadius: 5,
        pointHoverRadius: 8
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
          callbacks: {
            label: (ctx) => {
              const pt = ctx.raw;
              return `${pt.name}: CF ${pt.y.toFixed(3)} (Rate ${pt.x.toFixed(2)})`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          title: { display: true, text: '公式Rating', color: '#a0a0b0',
                   font: { family: "'Outfit', 'Noto Sans JP', sans-serif" } },
          grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
          ticks: { color: '#e0e0e0', font: { family: "'Outfit', sans-serif" } }
        },
        y: {
          title: { display: true, text: 'CHUNIFORCE', color: '#a0a0b0',
                   font: { family: "'Outfit', 'Noto Sans JP', sans-serif" } },
          grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
          ticks: { color: '#e0e0e0', font: { family: "'Outfit', sans-serif" } }
        }
      }
    }
  });
}

function renderBucketTable(validUsers) {
  // Buckets（min/maxはレーティング帯、maxForceは最大CF値の記録用）
  const buckets = [
    { min: 17.50, maxRate: 99.99, label: '17.50 〜' },
    { min: 17.25, maxRate: 17.49, label: '17.25 〜 17.49' },
    { min: 17.00, maxRate: 17.24, label: '17.00 〜 17.24' },
    { min: 16.75, maxRate: 16.99, label: '16.75 〜 16.99' },
    { min: 16.50, maxRate: 16.74, label: '16.50 〜 16.74' },
    { min: 16.25, maxRate: 16.49, label: '16.25 〜 16.49' },
    { min: 16.00, maxRate: 16.24, label: '16.00 〜 16.24' },
    { min: 15.50, maxRate: 15.99, label: '15.50 〜 15.99' },
    { min: 0.00,  maxRate: 15.49, label: '〜 15.49' },
  ];

  const bucketStats = buckets.map(b => ({ ...b, count: 0, sum: 0, maxForce: 0 }));

  validUsers.forEach(u => {
    const rate = parseFloat(u.rating);
    const force = u.value;
    for (const b of bucketStats) {
      if (rate >= b.min && rate <= b.maxRate) {
        b.count++;
        b.sum += force;
        if (force > b.maxForce) b.maxForce = force;
        break;
      }
    }
  });

  const tbody = document.getElementById('bucket-tbody');

  if (validUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;" class="placeholder-cell">公式レーティングデータがありません。ログイン後にスコアを再計算すると集計されます。</td></tr>';
    return;
  }

  const rows = bucketStats.filter(b => b.count > 0).map(b => {
    const avg = b.sum / b.count;
    return `
      <tr>
        <td style="text-align: left; font-weight: bold; color: var(--text);">${b.label}</td>
        <td style="text-align: right;">${b.count}件</td>
        <td style="text-align: right; color: var(--accent); font-family: var(--font-en); font-weight: bold;">${avg.toFixed(3)}</td>
        <td style="text-align: right; color: var(--text-muted); font-family: var(--font-en);">${b.maxForce.toFixed(3)}</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}
