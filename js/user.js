/**
 * js/user.js
 * ユーザーページ（/user/#username）のロジック（JWT認証付き）
 */

import { getClassInfo, getRankInfo } from './calc.js';
import { escHtml, truncate          } from './render.js';
import { loadToken, clearToken       } from './auth.js';
import { initNavbar } from './navbar.js';

const PROXY_URL = 'https://chunirec-proxy.k-chunithm.workers.dev';

// ──────────────────────────────────────────────────────────
//  エントリーポイント
// ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar(true);

  const handleUrl = () => {
    const username = decodeURIComponent(location.hash.slice(1));

    // エラーエリアを隠す
    const errorArea = document.getElementById('error-area');
    if (errorArea) errorArea.classList.add('hidden');

    if (!username) {
      loadUserList();
      return;
    }

    // ユーザーリストエリアを隠す
    const userListArea = document.getElementById('user-list-area');
    if (userListArea) userListArea.classList.add('hidden');

    document.title = `${username} - CHUNIFORCE`;

    // 認証チェック（任意）
    const token = loadToken(username);
    // トークンがなくても、公開プロフィールなら閲覧可能にする
    loadUser(username, token);

    // URLコピーボタンの設定など
    setupActionButtons(username);
  };

  handleUrl();
  window.addEventListener('hashchange', handleUrl);

  // タブ切り替えの設定
  setupTabs();
});

function setupActionButtons(username) {
  // URLコピーボタン
  const copyBtn = document.getElementById('btn-copy-url');
  if (copyBtn) {
    // 既存のイベントリスナーをクリアするために再生成
    const newBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newBtn, copyBtn);
    newBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(location.href).then(() => {
        const span = newBtn.querySelector('.btn-text');
        span.textContent = '✅ コピーしました';
        setTimeout(() => { span.textContent = '🔗 URLをコピー'; }, 2000);
      });
    });
  }

  // ログアウトボタン
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    const newLogout = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newLogout, logoutBtn);
    newLogout.addEventListener('click', () => {
      if (window.showLogoutModal) {
        window.showLogoutModal('../');
      } else if (confirm('本当にログアウトしますか？')) {
        clearToken(username);
        location.href = `../login.html?next=${encodeURIComponent(username)}`;
      }
    });
  }
}

// ──────────────────────────────────────────────────────────
//  ユーザーデータ取得 & 描画
// ──────────────────────────────────────────────────────────
async function loadUser(username, token) {
  try {
    const res = await fetch(
      `${PROXY_URL}/user?name=${encodeURIComponent(username)}`,
      { headers: { Authorization: 'Bearer ' + token } }
    );

    if (res.status === 401) {
      clearToken(username);
      location.href = `../login.html?next=${encodeURIComponent(username)}`;
      return;
    }
    if (res.status === 404) {
      showError(`ユーザー「${escHtml(username)}」のデータがまだ公開されていません。<br>トップページで計算後に「ページを公開する」を押してください。`);
      hideLoading();
      return;
    }
    if (res.status === 403) {
      showError(`このユーザーのページは非公開に設定されています。<br><span style="font-size:0.85rem; color:var(--text-muted);">設定画面で「マイページの公開設定」をオンにすると、他のユーザーからも閲覧可能になります。</span>`);
      hideLoading();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    renderUser(data);

  } catch (e) {
    console.error(e);
    showError(`データの取得に失敗しました: ${e.message}`);
  } finally {
    hideLoading();
  }
}

// ──────────────────────────────────────────────────────────
//  ユーザー一覧取得 & 描画
// ──────────────────────────────────────────────────────────
async function loadUserList() {
  document.title = 'ユーザー一覧 - CHUNIFORCE';
  const resultArea = document.getElementById('result-area');
  const userListArea = document.getElementById('user-list-area');
  const tbody = document.getElementById('user-list-tbody');
  const countBadge = document.getElementById('user-list-count');

  if (resultArea) resultArea.classList.add('hidden');
  if (userListArea) userListArea.classList.remove('hidden');

  try {
    // ランキングAPIを利用して公開ユーザーを取得 (chuniforceカテゴリ)
    const res = await fetch(`${PROXY_URL}/ranking?category=chuniforce`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!json.success) throw new Error(json.error || '不明なエラー');

    const users = json.data || [];

    // 描画関数
    const renderList = (filterText = '') => {
      const filtered = users.filter(u => {
        const query = filterText.toLowerCase();
        const dName = (u.display_name || '').toLowerCase();
        const uName = (u.username || '').toLowerCase();
        return dName.includes(query) || uName.includes(query);
      });

      if (countBadge) countBadge.textContent = `${filtered.length}人`;

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="placeholder-cell">該当するユーザーはいません</td></tr>';
      } else {
        tbody.innerHTML = filtered.map(u => {
          const cls = getClassInfo(u.value);
          return `
            <tr class="user-list-row ${u.is_public === 0 ? 'is-private' : ''}">
              <td>
                <div style="display:flex; align-items:center; gap:6px;">
                  <a href="#${encodeURIComponent(u.username)}" class="user-name-main ranking-user-link">${escHtml(u.display_name || u.username)}</a>
                  ${u.is_public === 0 ? `
                    <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px; height:14px; opacity:0.6;">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  ` : ''}
                </div>
              </td>
              <td>
                <span class="user-id-sub" style="font-size: 0.9rem;">@${escHtml(u.username)}</span>
              </td>
              <td style="text-align:right">
                <div class="user-force-cell">
                  <span class="cf-color-${cls.id} class-label-mini">${cls.name}</span>
                  <strong class="force-val cf-color-${cls.id}">${u.value.toFixed(3)}</strong>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    };

    // 初回描画
    renderList();

    // 検索入力イベント
    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        renderList(e.target.value);
      });
    }

    // (ハッシュ変更の監視は DOMContentLoaded 内の統合リスナーで行うため削除)

  } catch (e) {
    console.error(e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="placeholder-cell" style="color:var(--error);">読み込み失敗: ${e.message}</td></tr>`;
  } finally {
    hideLoading();
  }
}

function renderUser(data) {
  const {
    username, displayName, chuniforce,
    bestAvg, ajcAvg, ajcBonus,
    ajcMasCount, ajcMasTotal,
    ajcUltCount, ajcUltTotal,
    bestJson, ajcJson, updatedAt,
  } = data;

  const bgMasCount = document.getElementById('ajc-mas-count');
  const bgMasTotal = document.getElementById('ajc-mas-total');
  const bgUltCount = document.getElementById('ajc-ult-count');
  const bgUltTotal = document.getElementById('ajc-ult-total');
  const bgAllCount = document.getElementById('ajc-all-count');
  const bgAllTotal = document.getElementById('ajc-all-total');

  if (bgMasCount) bgMasCount.textContent = ajcMasCount || 0;
  if (bgMasTotal) bgMasTotal.textContent = ajcMasTotal || 0;
  if (bgUltCount) bgUltCount.textContent = ajcUltCount || 0;
  if (bgUltTotal) bgUltTotal.textContent = ajcUltTotal || 0;
  if (bgAllCount) bgAllCount.textContent = (ajcMasCount || 0) + (ajcUltCount || 0);
  if (bgAllTotal) bgAllTotal.textContent = (ajcMasTotal || 0) + (ajcUltTotal || 0);

  // 円グラフ描画
  if (typeof renderBonusChart === 'function') {
    renderBonusChart(ajcMasCount || 0, ajcMasTotal || 0, ajcUltCount || 0, ajcUltTotal || 0);
  }

  const badge = document.getElementById('result-username-badge');
  if (badge) badge.textContent = displayName || username;
  document.title = `${displayName || username} - CHUNIFORCE`;

  const cfValueEl = document.getElementById('cf-value');
  if (cfValueEl) cfValueEl.textContent = chuniforce.toFixed(3);

  const bdBestAvg = document.getElementById('bd-best-avg');
  const bdTheory  = document.getElementById('bd-theory-bonus');
  const bdBonus   = document.getElementById('bd-theory-count-bonus');
  if (bdBestAvg) bdBestAvg.textContent = bestAvg.toFixed(4);
  if (bdTheory)  bdTheory.textContent  = ajcAvg.toFixed(4);
  if (bdBonus)   bdBonus.textContent   = '+' + ajcBonus.toFixed(4);

  // ボーナスタブ内の強調表示
  const bonusLarge = document.getElementById('bonus-value-large');
  if (bonusLarge) bonusLarge.textContent = '+' + ajcBonus.toFixed(4);

  // エンブレム
  const cls     = getClassInfo(chuniforce);
  const romanEl = document.getElementById('cf-roman');
  const starsEl = document.getElementById('cf-stars');
  const labelEl = document.getElementById('cf-value-label');
  if (romanEl) {
    romanEl.textContent = cls.name;
    for (let i = 1; i <= 10; i++) romanEl.classList.remove('cf-color-' + i);
    romanEl.classList.add('cf-color-' + cls.id);
  }
  if (labelEl) {
    for (let i = 1; i <= 10; i++) labelEl.classList.remove('cf-color-' + i);
    labelEl.classList.add('cf-color-' + cls.id);
  }
  if (cfValueEl) {
    for (let i = 1; i <= 10; i++) cfValueEl.classList.remove('cf-color-' + i);
    cfValueEl.classList.add('cf-color-' + cls.id);
  }
  if (starsEl) {
    starsEl.innerHTML = Array.from({ length: 4 }, (_, i) =>
      `<div class="star-icon ${i < cls.stars ? 'active' : ''}"></div>`
    ).join('');
  }

  // 最終更新
  const updEl = document.getElementById('updated-at');
  if (updEl && updatedAt) {
    const d = new Date(updatedAt);
    updEl.textContent = `最終更新: ${d.toLocaleString('ja-JP')}`;
  }

  // ベスト枠テーブル
  const bestTbody = document.getElementById('best-tbody');
  const bestBadge = document.getElementById('best-count-badge');
  if (bestBadge) bestBadge.textContent = `${bestJson.length}曲`;

  // グラフ描画
  renderBestChart(bestJson, bestAvg);

  if (bestTbody) {
    if (bestJson.length === 0) {
      bestTbody.innerHTML = '<tr><td colspan="11" class="placeholder-cell">データなし</td></tr>';
    } else {
      bestTbody.innerHTML = bestJson.map((e, i) => {
        const rank      = i + 1;
        const diffClass = `d-${(e.diff || '').toLowerCase()}`;
        const lampClass = { AJC: 'lamp-ajc', AJ: 'lamp-aj', FC: 'lamp-fc', CLR: 'lamp-none' }[e.lamp] || 'lamp-none';
        const rankInfo  = getRankInfo(e.score || 0);
        const baseBonus = rankInfo.baseBonus;
        const baseForce = baseBonus !== null ? (e.constant + baseBonus).toFixed(2) : '—';
        const scoreDelta = baseBonus !== null ? (e.scoreBonus - baseBonus) : e.scoreBonus;
        const sbSign    = scoreDelta >= 0 ? '+' : '';
        return `<tr>
          <td style="text-align:center"><span class="rank-num${rank <= 3 ? ' top3' : ''}">${rank}</span></td>
          <td title="${escHtml(e.title)}">${escHtml(truncate(e.title || '', 30))}</td>
          <td style="text-align:center"><span class="diff-badge ${diffClass}">${e.diff}</span></td>
          <td style="text-align:right">${(e.constant || 0).toFixed(1)}</td>
          <td style="text-align:right">${(e.score || 0).toLocaleString()}</td>
          <td style="text-align:center"><span class="lamp-badge ${lampClass}">${e.lamp}</span></td>
          <td style="text-align:center">${baseBonus !== null ? `<span class="rank-label ${getRankClass(rankInfo.rank)}">${rankInfo.rank}</span>` : '—'}</td>
          <td style="text-align:right;color:var(--text-muted)">${baseForce}</td>
          <td style="text-align:right;color:${scoreDelta >= 0 ? 'var(--success)' : 'var(--error)'}">${sbSign}${scoreDelta.toFixed(4)}</td>
          <td style="text-align:right;color:var(--warning)">${e.lampBonus > 0 ? '+' : ''}${(e.lampBonus || 0).toFixed(1)}</td>
          <td style="text-align:right"><strong class="force-val">${(e.force || 0).toFixed(4)}</strong></td>
        </tr>`;
      }).join('');
    }
  }

  // 理論値枠テーブル
  const theoryTbody = document.getElementById('theory-tbody');
  const theoryBadge = document.getElementById('theory-count-badge');
  if (theoryBadge) theoryBadge.textContent = `${ajcJson.length}曲`;

  // 理論値グラフ描画
  if (typeof renderTheoryChart === 'function') {
    renderTheoryChart(ajcJson, ajcAvg);
  }

  if (theoryTbody) {
    if (ajcJson.length === 0) {
      theoryTbody.innerHTML = '<tr><td colspan="5" class="placeholder-cell">データなし</td></tr>';
    } else {
      theoryTbody.innerHTML = ajcJson.map((e, i) => {
        const rank      = i + 1;
        const diffClass = `d-${(e.diff || '').toLowerCase()}`;
        return `<tr>
          <td class="col-rank"><span class="rank-num${rank <= 3 ? ' top3' : ''}">#${rank}</span></td>
          <td class="col-title" style="text-align:left">${escHtml(e.title || '')}</td>
          <td class="col-diff"><span class="diff-badge ${diffClass}">${e.diff}</span></td>
          <td class="col-const" style="text-align:center">${(e.constant || 0).toFixed(1)}</td>
          <td class="col-force" style="text-align:center">${(e.singleForce || 0).toFixed(4)}</td>
        </tr>`;
      }).join('');
    }
  }

  // 結果表示
  const resultArea = document.getElementById('result-area');
  if (resultArea) {
    resultArea.classList.remove('hidden');
    resultArea.classList.add('fade-in');
  }
}


// ──────────────────────────────────────────────────────────
//  ユーティリティ
// ──────────────────────────────────────────────────────────
function getRankClass(rankName) {
  if (rankName === 'SSS+')                            return 'rank-sssp';
  if (['SSS','SS+','SS','S+','S'].includes(rankName)) return 'rank-plat';
  if (['AAA','AA','A'].includes(rankName))            return 'rank-gold';
  if (rankName === 'BBB')                             return 'rank-blue';
  if (rankName === 'C')                               return 'rank-brown';
  return 'rank-grey';
}

// ──────────────────────────────────────────────────────────
//  タブ切り替えロジック
// ──────────────────────────────────────────────────────────
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');

      // ボタンの state 更新
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // コンテンツの表示更新
      tabContents.forEach(content => {
        if (content.id === target) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      });
    });
  });
}

function showError(html) {
  const area = document.getElementById('error-area');
  const msg  = document.getElementById('error-msg');
  if (area) area.classList.remove('hidden');
  if (msg)  msg.innerHTML = html;
}

function hideLoading() {
  const area = document.getElementById('loading-area');
  if (area) area.classList.add('hidden');
}

// ──────────────────────────────────────────────────────────
//  グラフ描画ロジック
// ──────────────────────────────────────────────────────────
let bestChartInst = null;

function renderBestChart(bestJson, bestAvg) {
  const canvas = document.getElementById('bestChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');

  const avgLabel = document.getElementById('chart-average-label');
  if (avgLabel) avgLabel.textContent = `Average: ${bestAvg.toFixed(4)}`;

  if (bestChartInst) {
    bestChartInst.destroy();
  }

  if (!bestJson || bestJson.length === 0) return;

  // テーマカラーをCSS変数から取得
  const style = getComputedStyle(document.documentElement);
  const colorText = 'rgba(232, 234, 246, 0.7)'; // 見やすくするため明るく
  const colorBorder = style.getPropertyValue('--border-hi').trim() || '#253070';
  const colorBorderGrid = style.getPropertyValue('--border').trim() || '#1a2040';
  const colorAccent = style.getPropertyValue('--accent').trim() || '#7c6dfa';
  const colorAccent3 = style.getPropertyValue('--accent3').trim() || '#00e5ff';
  const colorBgCard = style.getPropertyValue('--bg-card').trim() || '#0e1220';
  const colorBgTooltip = style.getPropertyValue('--bg-card2').trim() || '#121728';

  const forces = bestJson.map(d => d.force || 0);
  const maxForces = bestJson.map(d => (d.constant || 0) + 5.35); // AJC FORCE = 譜面定数 + 5.35
  const minF = Math.min(...forces);

  // Y軸の最小値を少し下に設定して見やすくする（0.05刻み）
  const suggestedMin = Math.max(0, Math.floor((minF - 0.05) * 20) / 20);

  // カスタム背景プラグイン（画像保存時にテーマの背景色で塗りつぶす）
  const bgColorPlugin = {
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart, args, options) => {
      const {ctx} = chart;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = options.color || '#0e1220';
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    }
  };

  // 棒グラフのグラデーション作成
  const barGradient = ctx.createLinearGradient(0, 0, 0, 300);
  barGradient.addColorStop(0, '#a094fa'); // 明るい紫
  barGradient.addColorStop(1, colorAccent + '55'); // 下部も少し明るく

  // AJC用の虹色グラデーション
  const rainbowGradient = ctx.createLinearGradient(0, 0, 0, 300);
  rainbowGradient.addColorStop(0.0, '#ff4b8b');
  rainbowGradient.addColorStop(0.2, '#ffb84d');
  rainbowGradient.addColorStop(0.4, '#4dffa6');
  rainbowGradient.addColorStop(0.6, '#4da6ff');
  rainbowGradient.addColorStop(0.8, '#b84dff');
  rainbowGradient.addColorStop(1.0, '#ff4b8b');

  const rainbowHoverGradient = ctx.createLinearGradient(0, 0, 0, 300);
  rainbowHoverGradient.addColorStop(0.0, '#ff8bb8');
  rainbowHoverGradient.addColorStop(0.2, '#ffd488');
  rainbowHoverGradient.addColorStop(0.4, '#88ffd4');
  rainbowHoverGradient.addColorStop(0.6, '#88d4ff');
  rainbowHoverGradient.addColorStop(0.8, '#d488ff');
  rainbowHoverGradient.addColorStop(1.0, '#ff8bb8');

  bestChartInst = new Chart(ctx, {
    data: {
      labels: bestJson.map((_, i) => `#${i + 1}`),
      datasets: [
        {
          type: 'line',
          label: 'ベスト枠 average',
          data: Array(bestJson.length).fill(bestAvg),
          borderColor: colorAccent3,
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          order: 0
        },
        {
          type: 'bar',
          label: '単曲FORCE',
          data: forces,
          backgroundColor: bestJson.map(d => d.lamp === 'AJC' ? rainbowGradient : barGradient),
          hoverBackgroundColor: bestJson.map(d => d.lamp === 'AJC' ? rainbowHoverGradient : '#c3bbff'),
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.85,
          categoryPercentage: 0.9,
          order: 1,
          grouped: false
        },
        {
          type: 'bar',
          label: 'AJC FORCE（理論値）',
          data: maxForces,
          backgroundColor: 'rgba(164, 102, 224, 0.35)', // 薄紫色（少し明るく）
          hoverBackgroundColor: 'rgba(164, 102, 224, 0.5)',
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.85,
          categoryPercentage: 0.9,
          order: 2,
          grouped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        customCanvasBackgroundColor: {
          color: colorBgCard
        },
        tooltip: {
          filter: (tooltipItem) => tooltipItem.datasetIndex === 1, // 単曲FORCEのデータセットのみツールチップ表示
          backgroundColor: colorBgTooltip,
          titleColor: '#ffffff',
          bodyColor: '#e8eaf6',
          borderColor: colorBorder,
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          bodyFont: { family: 'Outfit, sans-serif' },
          titleFont: { family: 'Outfit, sans-serif', weight: 'bold' },
          callbacks: {
            title: (tooltipItems) => {
              const idx = tooltipItems[0].dataIndex;
              const data = bestJson[idx];
              return `#${idx + 1} ${data.title} (${data.diff || ''})`;
            },
            label: (context) => {
              const data = bestJson[context.dataIndex];
              const scoreStr = (data.score || 0).toLocaleString();
              const rankStr = getRankInfo(data.score || 0).rank;
              const lampStr = data.lamp || '—';
              const constStr = (data.constant || 0).toFixed(1);
              const maxForce = ((data.constant || 0) + 5.35).toFixed(4);
              return [
                `FORCE:     ${context.parsed.y.toFixed(4)}`,
                `MAX FORCE: ${maxForce}`,
                `Score:     ${scoreStr}`,
                `Rank:      ${rankStr}`,
                `Lamp:      ${lampStr}`,
                `Const:     ${constStr}`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          min: suggestedMin,
          ticks: {
            color: colorText,
            font: { family: 'Outfit, sans-serif' }
          },
          grid: {
            color: colorBorderGrid,
            drawBorder: false,
          }
        },
        x: {
          display: true,
          grid: {
            display: false,
            drawBorder: true,
            color: colorBorderGrid
          },
          ticks: {
            color: colorText,
            font: { family: 'Outfit, sans-serif' },
            maxRotation: 0,
            autoSkip: false,
            callback: function(val, index) {
              const num = index + 1;
              if (num === 1 || num % 5 === 0) {
                return '#' + num;
              }
              return '';
            }
          }
        }
      }
    },
    plugins: [bgColorPlugin]
  });

  // 開閉ボタンの設定
  const toggleBtn = document.getElementById('chart-toggle-btn');
  const collapseArea = document.getElementById('chart-collapse-area');

  if (toggleBtn && collapseArea) {
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

    let isCollapsed = false;
    newToggleBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      const icon = newToggleBtn.querySelector('#chart-toggle-icon');
      if (isCollapsed) {
        collapseArea.style.maxHeight = '0px';
        if (icon) icon.style.transform = 'rotate(180deg)';
      } else {
        collapseArea.style.maxHeight = '400px';
        if (icon) icon.style.transform = 'rotate(0deg)';
      }
    });
  }
}

// ──────────────────────────────────────────────────────────
//  理論値枠グラフ描画ロジック
// ──────────────────────────────────────────────────────────
let theoryChartInst = null;

function renderTheoryChart(ajcJson, ajcAvg) {
  const canvas = document.getElementById('theoryChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');

  const avgLabel = document.getElementById('theory-chart-average-label');
  if (avgLabel) avgLabel.textContent = `Average: ${ajcAvg.toFixed(4)}`;

  if (theoryChartInst) {
    theoryChartInst.destroy();
  }

  if (!ajcJson || ajcJson.length === 0) return;

  const style = getComputedStyle(document.documentElement);
  const colorText = 'rgba(232, 234, 246, 0.7)';
  const colorBorderGrid = style.getPropertyValue('--border').trim() || '#1a2040';
  const colorBorderTooltip = style.getPropertyValue('--border-hi').trim() || '#253070';
  const colorAccent = style.getPropertyValue('--accent').trim() || '#7c6dfa';
  const colorAccent3 = style.getPropertyValue('--accent3').trim() || '#00e5ff';
  const colorBgCard = style.getPropertyValue('--bg-card').trim() || '#0e1220';
  const colorBgTooltip = style.getPropertyValue('--bg-card2').trim() || '#121728';

  const forces = ajcJson.map(d => d.singleForce || 0);
  const minF = Math.min(...forces);
  const suggestedMin = Math.max(0, Math.floor((minF - 0.05) * 20) / 20);

  const bgColorPlugin = {
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart, args, options) => {
      const {ctx} = chart;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = options.color || '#0e1220';
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    }
  };

  const barGradient = ctx.createLinearGradient(0, 0, 0, 300);
  barGradient.addColorStop(0, '#a094fa'); // 明るい紫
  barGradient.addColorStop(1, colorAccent + '55'); // 少し明るい透明紫

  theoryChartInst = new Chart(ctx, {
    data: {
      labels: ajcJson.map((_, i) => `#${i + 1}`),
      datasets: [
        {
          type: 'line',
          label: '理論値枠 average',
          data: Array(ajcJson.length).fill(ajcAvg),
          borderColor: colorAccent3,
          borderWidth: 2,
          borderDash: [4, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          order: 0
        },
        {
          type: 'bar',
          label: '単曲AJC-FORCE',
          data: forces,
          backgroundColor: barGradient,
          hoverBackgroundColor: '#c3bbff',
          borderRadius: 4,
          borderSkipped: false,
          barPercentage: 0.85,
          categoryPercentage: 0.9,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        customCanvasBackgroundColor: { color: colorBgCard },
        tooltip: {
          filter: (tooltipItem) => tooltipItem.datasetIndex !== 0,
          backgroundColor: colorBgTooltip,
          titleColor: '#ffffff',
          bodyColor: '#e8eaf6',
          borderColor: colorBorderTooltip,
          borderWidth: 1,
          padding: 10,
          displayColors: false,
          bodyFont: { family: 'Outfit, sans-serif' },
          titleFont: { family: 'Outfit, sans-serif', weight: 'bold' },
          callbacks: {
            title: (tooltipItems) => {
              const idx = tooltipItems[0].dataIndex;
              const data = ajcJson[idx];
              return `#${idx + 1} ${data.title} (${data.diff || ''})`;
            },
            label: (context) => {
              const data = ajcJson[context.dataIndex];
              const constStr = (data.constant || 0).toFixed(1);
              return [
                `AJC-FORCE: ${context.parsed.y.toFixed(4)}`,
                `Const:         ${constStr}`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          min: suggestedMin,
          ticks: {
            color: colorText,
            font: { family: 'Outfit, sans-serif' }
          },
          grid: {
            color: colorBorderGrid,
            drawBorder: false,
          }
        },
        x: {
          display: true,
          grid: {
            display: false,
            drawBorder: true,
            color: colorBorderGrid
          },
          ticks: {
            color: colorText,
            font: { family: 'Outfit, sans-serif' },
            maxRotation: 0,
            autoSkip: false,
            callback: function(val, index) {
              const num = index + 1;
              if (num === 1 || num % 5 === 0) return '#' + num;
              return '';
            }
          }
        }
      }
    },
    plugins: [bgColorPlugin]
  });

  const toggleBtn = document.getElementById('theory-chart-toggle-btn');
  const collapseArea = document.getElementById('theory-chart-collapse-area');

  if (toggleBtn && collapseArea) {
    const newToggleBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

    let isCollapsed = false;
    newToggleBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      const icon = newToggleBtn.querySelector('#theory-chart-toggle-icon');
      if (isCollapsed) {
        collapseArea.style.maxHeight = '0px';
        if (icon) icon.style.transform = 'rotate(180deg)';
      } else {
        collapseArea.style.maxHeight = '400px';
        if (icon) icon.style.transform = 'rotate(0deg)';
      }
    });
  }
}

// ──────────────────────────────────────────────────────────
//  理論値数ボーナス円グラフ描画ロジック
// ──────────────────────────────────────────────────────────
let bonusChartInst = null;

function renderBonusChart(masCount, masTotal, ultCount, ultTotal) {
  const canvas = document.getElementById('bonusPieChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const ctx = canvas.getContext('2d');

  if (bonusChartInst) {
    bonusChartInst.destroy();
  }

  const unachieved = (masTotal + ultTotal) - (masCount + ultCount);
  const achievedTotal = masCount + ultCount;
  const allTotal = masTotal + ultTotal;
  const percent = allTotal > 0 ? (achievedTotal / allTotal * 100).toFixed(1) : '0.0';

  const style = getComputedStyle(document.documentElement);
  const colorMas = style.getPropertyValue('--c-mas').trim() || '#8b3fcf';
  const colorUlt = style.getPropertyValue('--c-ult-text').trim() || '#ef9a9a';
  const colorEmpty = 'rgba(255, 255, 255, 0.05)';
  const colorBorder = style.getPropertyValue('--bg-card').trim() || '#0e1220';
  const colorTooltipBg = style.getPropertyValue('--bg-card2').trim() || '#121728';
  const colorBorderTooltip = style.getPropertyValue('--border-hi').trim() || '#253070';
  const colorText = 'rgba(232, 234, 246, 0.7)';
  const colorAccent3 = style.getPropertyValue('--accent3').trim() || '#00e5ff';

  const centerTextPlugin = {
    id: 'centerTextPlugin',
    beforeDraw: (chart) => {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      ctx.save();
      const centerX = chartArea.left + (chartArea.right - chartArea.left) / 2;
      const centerY = chartArea.top + (chartArea.bottom - chartArea.top) / 2;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // %テキスト（真ん中少し上）
      ctx.font = '800 2.2rem "Outfit", sans-serif';
      ctx.fillStyle = colorAccent3;
      ctx.fillText(`${percent}%`, centerX, centerY - 10);

      // 合計数テキスト（%の下）
      ctx.font = '500 1rem "Outfit", "Noto Sans JP", sans-serif';
      ctx.fillStyle = colorText;
      ctx.fillText(`${achievedTotal} / ${allTotal}`, centerX, centerY + 20);

      ctx.restore();
    }
  };

  bonusChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['MAS', 'ULT', '未達成'],
      datasets: [{
        data: [masCount, ultCount, Math.max(0, unachieved)],
        backgroundColor: [colorMas, colorUlt, colorEmpty],
        borderColor: colorBorder,
        borderWidth: 3,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: colorText,
            font: { family: 'Outfit, "Noto Sans JP", sans-serif' },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: colorTooltipBg,
          titleColor: '#ffffff',
          bodyColor: '#e8eaf6',
          borderColor: colorBorderTooltip,
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          bodyFont: { family: 'Outfit, sans-serif' },
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const val = context.parsed;
              const total = masTotal + ultTotal;
              const percent = total > 0 ? (val / total * 100).toFixed(1) : 0;
              return ` ${label}: ${val}曲 (${percent}%)`;
            }
          }
        }
      }
    },
    plugins: [centerTextPlugin]
  });
}
