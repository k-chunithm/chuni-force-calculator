import { getClassInfo } from './calc.js';

let currentRenderData = null;
export function getCurrentRenderData() {
  return currentRenderData;
}

let errorArea, errorMsg, loadingArea, resultArea, cfValueEl, cfTheoryEl, bdBestAvgEl, bdTheoryBonusEl, bdTheoryCountBonusEl, theoryTbody;
let tableMasTheoryCountEl, tableMasTheoryMaxEl, tableUltTheoryCountEl, tableUltTheoryMaxEl, tableTotalTheoryCountEl, tableTotalTheoryMaxEl, tableTheoryCountBonusEl;
let bestTbody, bestCountBadge, usernameBadge, calcBtn;

export function initRender() {
  errorArea        = document.getElementById('error-area');
  errorMsg         = document.getElementById('error-msg');
  loadingArea      = document.getElementById('loading-area');
  resultArea       = document.getElementById('result-area');
  cfValueEl        = document.getElementById('cf-value');
  cfTheoryEl       = document.getElementById('cf-theory');
  bdBestAvgEl      = document.getElementById('bd-best-avg');
  bdTheoryBonusEl  = document.getElementById('bd-theory-bonus');
  bdTheoryCountBonusEl = document.getElementById('bd-theory-count-bonus');
  theoryTbody      = document.getElementById('theory-tbody');

  tableMasTheoryCountEl   = document.getElementById('table-mas-theory-count');
  tableMasTheoryMaxEl     = document.getElementById('table-mas-theory-max');
  tableUltTheoryCountEl   = document.getElementById('table-ult-theory-count');
  tableUltTheoryMaxEl     = document.getElementById('table-ult-theory-max');
  tableTotalTheoryCountEl = document.getElementById('table-total-theory-count');
  tableTotalTheoryMaxEl   = document.getElementById('table-total-theory-max');
  tableTheoryCountBonusEl = document.getElementById('table-theory-count-bonus');

  bestTbody        = document.getElementById('best-tbody');
  bestCountBadge   = document.getElementById('best-count-badge');
  usernameBadge    = document.getElementById('result-username-badge');

  calcBtn          = document.getElementById('calc-btn');
}

function getRankInfo(score) {
  if (score >= 1009000) return { rank: 'SSS+', baseBonus: 2.15 };
  if (score >= 1007500) return { rank: 'SSS',  baseBonus: 2.0  };
  if (score >= 1005000) return { rank: 'SS+',  baseBonus: 1.5  };
  if (score >= 1000000) return { rank: 'SS',   baseBonus: 1.0  };
  if (score >=  990000) return { rank: 'S+',   baseBonus: 0.6  };
  if (score >=  975000) return { rank: 'S',    baseBonus: 0.0  };
  if (score >=  950000) return { rank: 'AAA',  baseBonus: -1.67 };
  if (score >=  925000) return { rank: 'AA',   baseBonus: -3.34 };
  if (score >=  900000) return { rank: 'A',    baseBonus: -5.0  };
  if (score >=  800000) return { rank: 'BBB',  baseBonus: null  };
  if (score >=  500000) return { rank: 'C',    baseBonus: null  };
  return { rank: 'D', baseBonus: null };
}

function getRankClass(rankName) {
  if (rankName === 'SSS+')                        return 'rank-sssp';
  if (['SSS','SS+','SS','S+','S'].includes(rankName)) return 'rank-plat';
  if (['AAA','AA','A'].includes(rankName))        return 'rank-gold';
  if (rankName === 'BBB')                         return 'rank-blue';
  if (rankName === 'C')                           return 'rank-brown';
  return 'rank-grey';
}


export function renderResult(username, result) {
  currentRenderData = { username, result };

  const {
    best50, bestSum, bestAvg,
    masTheoryCount, ultTheoryCount, allMasTheoryCount, allUltTheoryCount, theoryBest50,
    theoryBonus, theoryCountBonus, chuniforce, chuniforceTheory,
  } = result;

  cfValueEl.textContent       = chuniforce.toFixed(3);
  cfTheoryEl.textContent      = chuniforceTheory.toFixed(3);
  bdBestAvgEl.textContent     = bestAvg.toFixed(4);
  bdTheoryBonusEl.textContent = theoryBonus.toFixed(4);
  if (bdTheoryCountBonusEl) {
    bdTheoryCountBonusEl.textContent = '+' + theoryCountBonus.toFixed(4);
  }

  if (tableMasTheoryCountEl)   tableMasTheoryCountEl.textContent = masTheoryCount;
  if (tableMasTheoryMaxEl)     tableMasTheoryMaxEl.textContent = ' / ' + allMasTheoryCount;
  if (tableUltTheoryCountEl)   tableUltTheoryCountEl.textContent = ultTheoryCount;
  if (tableUltTheoryMaxEl)     tableUltTheoryMaxEl.textContent = ' / ' + allUltTheoryCount;
  if (tableTotalTheoryCountEl) tableTotalTheoryCountEl.textContent = (masTheoryCount + ultTheoryCount);
  if (tableTotalTheoryMaxEl)   tableTotalTheoryMaxEl.textContent = ' / ' + (allMasTheoryCount + allUltTheoryCount);
  if (tableTheoryCountBonusEl) tableTheoryCountBonusEl.textContent = '+' + theoryCountBonus.toFixed(4);

  if (usernameBadge) usernameBadge.textContent = username;
  if (bestCountBadge) bestCountBadge.textContent = `${best50.length}曲`;
  const theoryCountBadge = document.getElementById('theory-count-badge');
  if (theoryCountBadge) theoryCountBadge.textContent = `${theoryBest50.length}曲`;

  const romanEl   = document.getElementById('cf-roman');
  const starsWrap = document.getElementById('cf-stars');
  const valLabel  = document.getElementById('cf-value-label');
  const valNum    = document.getElementById('cf-value');
  const cls       = getClassInfo(chuniforce);

  romanEl.textContent = cls.name;

  for (let i = 1; i <= 10; i++) {
    romanEl.classList.remove('cf-color-' + i);
    if (valLabel) valLabel.classList.remove('cf-color-' + i);
    valNum.classList.remove('cf-color-' + i);
  }
  const colorClass = 'cf-color-' + cls.id;
  romanEl.classList.add(colorClass);
  if (valLabel) valLabel.classList.add(colorClass);
  valNum.classList.add(colorClass);

  let starsHtml = '';
  for (let i = 1; i <= 4; i++) {
    const activeClass = i <= cls.stars ? 'active' : '';
    starsHtml += `<div class="star-icon ${activeClass}"></div>`;
  }
  starsWrap.innerHTML = starsHtml;

  if (theoryTbody) {
    if (theoryBest50.length === 0) {
      theoryTbody.innerHTML = `<tr><td colspan="5" class="placeholder-cell">対象記録がありません</td></tr>`;
    } else {
      theoryTbody.innerHTML = theoryBest50.map((e, i) => {
        const rank = i + 1;
        const rankClass = rank <= 3 ? 'rank-num top3' : 'rank-num';
        const diffClass = `d-${e.diff.toLowerCase()}`;
        return `
          <tr>
            <td class="col-rank"><span class="${rankClass}">#${rank}</span></td>
            <td class="col-title" style="text-align:left;">${escHtml(e.title)}</td>
            <td class="col-diff"><span class="diff-badge ${diffClass}">${e.diff}</span></td>
            <td class="col-const" style="text-align:center;">${e.constant.toFixed(1)}</td>
            <td class="col-force" style="text-align:center;">${e.singleForce.toFixed(4)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  if (bestTbody) {
    bestTbody.innerHTML = best50.map((e, i) => {
      const rank      = i + 1;
      const isTop3    = rank <= 3;
      const diffClass = `d-${e.diff.toLowerCase()}`;
      const lampClass = { AJC: 'lamp-ajc', AJ: 'lamp-aj', FC: 'lamp-fc', CLR: 'lamp-none' }[e.lamp] || 'lamp-none';

      const { rank: rankName, baseBonus } = getRankInfo(e.score);
      const baseForce       = baseBonus !== null
        ? (e.constant + baseBonus).toFixed(2)
        : '—';
      const scoreBonusDelta = baseBonus !== null
        ? e.scoreBonus - baseBonus
        : e.scoreBonus;
      const sbSign = scoreBonusDelta >= 0 ? '+' : '';

      return `<tr>
        <td style="text-align:center"><span class="rank-num${isTop3 ? ' top3' : ''}">${rank}</span></td>
        <td title="${escHtml(e.title)}">${escHtml(truncate(e.title, 30))}</td>
        <td style="text-align:center"><span class="diff-badge ${diffClass}">${e.diff}</span></td>
        <td style="text-align:right">${e.constant.toFixed(1)}</td>
        <td style="text-align:right">${e.score.toLocaleString()}</td>
        <td style="text-align:center"><span class="lamp-badge ${lampClass}">${e.lamp}</span></td>
        <td style="text-align:center">${
          baseBonus !== null
            ? `<span class="rank-label ${getRankClass(rankName)}">${rankName}</span>`
            : '—'
        }</td>
        <td style="text-align:right;color:var(--text-muted)">${baseForce}</td>
        <td style="text-align:right;color:${scoreBonusDelta >= 0 ? 'var(--success)' : 'var(--error)'}">${sbSign}${scoreBonusDelta.toFixed(4)}</td>
        <td style="text-align:right;color:var(--warning)">${e.lampBonus > 0 ? '+' : ''}${e.lampBonus.toFixed(1)}</td>
        <td style="text-align:right"><strong class="force-val">${e.force.toFixed(4)}</strong></td>
      </tr>`;
    }).join('');
  }

  showResult();
}

export function setLoading(on, text = 'データを取得・計算中…') {
  if(calcBtn) calcBtn.disabled = on;
  const textEl = loadingArea.querySelector('.loading-text');
  if (textEl) textEl.textContent = text;
  loadingArea.classList.toggle('hidden', !on);
}

export function showError(msg) {
  errorMsg.textContent = msg;
  errorArea.classList.remove('hidden');
}

// レートリミット（429）専用: カウントダウン付きメッセージ
let _rateLimitTimer = null;
export function showRateLimitError(waitSeconds = 900) {
  if (_rateLimitTimer) {
    clearInterval(_rateLimitTimer);
    _rateLimitTimer = null;
  }

  let remaining = waitSeconds;

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}分 ${String(s).padStart(2, '0')}秒` : `${s}秒`;
  }

  function update() {
    if (remaining > 0) {
      errorMsg.innerHTML =
        `⏳ API のアクセス制限（Rate Limit）に達しました。（通信エラー：HTTP 429）<br>` +
        `あと <strong>${fmt(remaining)}</strong> 後に再度お試しください。`;
    } else {
      errorMsg.innerHTML =
        `✅ 制限時間が経過しました。もう一度「計算する」をお試しください。`;
      clearInterval(_rateLimitTimer);
      _rateLimitTimer = null;
    }
  }

  update();
  errorArea.classList.remove('hidden');
  _rateLimitTimer = setInterval(() => {
    remaining--;
    update();
  }, 1000);
}

export function hideError() {
  if (_rateLimitTimer) {
    clearInterval(_rateLimitTimer);
    _rateLimitTimer = null;
  }
  errorArea.classList.add('hidden');
}

export function showResult() {
  resultArea.classList.remove('hidden');
  resultArea.classList.add('fade-in');
  const genBtnArea = document.getElementById('generate-action-area');
  if (genBtnArea) genBtnArea.classList.remove('hidden');
}

export function hideResult() {
  resultArea.classList.add('hidden');
  resultArea.classList.remove('fade-in');
  const genBtnArea = document.getElementById('generate-action-area');
  if (genBtnArea) genBtnArea.classList.add('hidden');
}

export function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}
