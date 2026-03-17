import { initNavbar } from './navbar.js';
import { escHtml } from './render.js';
import { getClassInfo } from './calc.js';

const PROXY_URL = 'https://chunirec-proxy.k-chunithm.workers.dev';
let allData = [];

document.addEventListener('DOMContentLoaded', () => {
  initNavbar(false);
  loadRanking();

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const tab = e.target.getAttribute('data-tab');
      renderRanking(tab);
    });
  });
});

async function loadRanking() {
  const loading = document.getElementById('ranking-loading');
  const errorEl = document.getElementById('ranking-error');
  const container = document.getElementById('ranking-container');

  try {
    const res = await fetch(`${PROXY_URL}/ranking`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const json = await res.json();
    if (!json.success) throw new Error(json.error || '不明なエラー');
    
    allData = json.data || [];
    
    loading.classList.add('hidden');
    container.classList.remove('hidden');
    
    // 表示更新
    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    renderRanking(activeTab);
    
  } catch (e) {
    loading.classList.add('hidden');
    errorEl.classList.remove('hidden');
    errorEl.textContent = 'データの取得に失敗しました: ' + e.message;
  }
}

function renderRanking(category) {
  const tbody = document.getElementById('ranking-tbody');
  const th = document.getElementById('ranking-value-th');
  const updAt = document.getElementById('ranking-updated-at');
  
  const headers = {
    'chuniforce': 'CHUNIFORCE',
    'best_avg': 'ベスト枠平均',
    'ajc_avg': '理論値枠平均',
    'ajc_bonus': '理論値数ボーナス'
  };
  th.textContent = headers[category] || '値';
  
  // スマホなど狭い画面でもクラス画像が入るよう幅を調整
  if (category === 'chuniforce') {
    th.style.width = window.innerWidth > 768 ? '240px' : '160px';
  } else {
    th.style.width = window.innerWidth > 768 ? '150px' : '120px';
  }
  
  const targetData = allData.filter(d => d.category === category).sort((a,b) => a.rank - b.rank);
  
  if (targetData.length > 0) {
    const d = new Date(targetData[0].cached_at);
    updAt.textContent = `最終更新: ${d.toLocaleString('ja-JP')} (毎日午前2時更新)`;
  } else {
    updAt.textContent = `最終更新: --`;
  }
  
  if (targetData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="placeholder-cell">データがありません</td></tr>`;
    return;
  }
  
  tbody.innerHTML = targetData.map((row) => {
    const isTop3 = row.rank <= 3;
    let rankClass = 'rank-num';
    if (row.rank === 1) rankClass += ' top3 rank-1';
    else if (row.rank === 2) rankClass += ' top3 rank-2';
    else if (row.rank === 3) rankClass += ' top3 rank-3';
    
    let valStr = '';
    let extraHtml = '';
    
    if (category === 'ajc_bonus') {
      valStr = '+' + row.value.toFixed(4);
      valStr = `<strong class="force-val">${valStr}</strong>`;
    } else if (category === 'chuniforce') {
      const cls = getClassInfo(row.value);
      const valFmt = row.value.toFixed(3);
      
      const starsHtml = Array.from({ length: 4 }, (_, i) =>
        `<div class="star-icon ${i < cls.stars ? 'active' : ''}"></div>`
      ).join('');

      extraHtml = `
        <div class="ranking-cf-cell">
          <div class="ranking-emblem-wrap">
            <div class="ranking-roman cf-color-${cls.id}">${cls.name}</div>
            <div class="ranking-stars">${starsHtml}</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;">
            <strong class="force-val cf-color-${cls.id}" style="font-size: 1.15em;">${valFmt}</strong>
          </div>
        </div>
      `;
    } else {
      valStr = row.value.toFixed(4);
      valStr = `<strong class="force-val">${valStr}</strong>`;
    }
    
    const displayHtml = category === 'chuniforce' ? extraHtml : valStr;

    // マイページは /user/#username でアクセスできる
    const isPublic = row.is_public !== 0; // undefined or 1 is public
    const linkClass = isPublic ? 'ranking-user-link' : 'ranking-user-link-private';
    const nameHtml = isPublic 
      ? `<a href="user/#${encodeURIComponent(row.username)}" class="${linkClass}">${escHtml(row.display_name || row.username)}</a>`
      : `<span class="${linkClass}" title="このプロフィールは非公開です">🔒 ${escHtml(row.display_name || row.username)}</span>`;

    return `
      <tr class="ranking-row">
        <td style="text-align:center"><span class="${rankClass}">${row.rank}</span></td>
        <td style="text-align:left">${nameHtml}</td>
        <td style="text-align:right">${displayHtml}</td>
      </tr>
    `;
  }).join('');
}
