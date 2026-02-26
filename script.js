/**
 * chuni-force-calculator
 * chunirec records/showall API からスコアを取得し、chuni-force 値を算出して表示する
 *
 * 要件:
 *  - 対象難易度: MAS / ULT / EXP / ADV / BAS（WORLD'S END 等は除外）
 *  - is_const_unknown: true であっても API から得られた const 値をそのまま使用
 *  - AJC 判定: score === 1,010,000
 *  - 理論値枠集計: MAS / ULT のみ
 */

'use strict';

// ──────────────────────────────────────────
//  定数
// ──────────────────────────────────────────
const API_TOKEN   = '255e414dcb7295f135eca9cabb890b85ad651fedc2148026491cd7044f847406e11e01cb366885f8deadaf4d259edbab5151a798b8888d6f13b6cd5805dec8b9';
const REIWA_URL   = 'https://reiwa.f5.si/chunirec_all.json';
const API_URL     = 'https://api.chunirec.net/2.0/records/showall.json';
const BEST_COUNT  = 50;

/** 対象難易度（これ以外は除外） */
const TARGET_DIFFS = new Set(['MAS', 'ULT', 'EXP', 'ADV', 'BAS']);

// ──────────────────────────────────────────
//  DOM
// ──────────────────────────────────────────
const usernameInput    = document.getElementById('username');
const calcBtn          = document.getElementById('calc-btn');
const errorArea        = document.getElementById('error-area');
const errorMsg         = document.getElementById('error-msg');
const loadingArea      = document.getElementById('loading-area');
const resultArea       = document.getElementById('result-area');
const cfValueEl        = document.getElementById('cf-value');
const cfTheoryEl       = document.getElementById('cf-theory');
const bdBestSumEl      = document.getElementById('bd-best-sum');
const bdBestAvgEl      = document.getElementById('bd-best-avg');
const bdTheoryBonusEl  = document.getElementById('bd-theory-bonus');
const theoryTbody      = document.getElementById('theory-tbody');
const bestTbody        = document.getElementById('best-tbody');
const bestCountBadge   = document.getElementById('best-count-badge');
const usernameBadge    = document.getElementById('result-username-badge');

// ──────────────────────────────────────────
//  イベント
// ──────────────────────────────────────────
calcBtn.addEventListener('click', onCalc);
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onCalc();
});

// 前回入力したユーザーネームを復元
const savedUser = localStorage.getItem('chuniforce_username');
if (savedUser) usernameInput.value = savedUser;

// ──────────────────────────────────────────
//  メイン処理
// ──────────────────────────────────────────
async function onCalc() {
  const username = usernameInput.value.trim();
  if (!username) {
    showError('ユーザーネームを入力してください。');
    return;
  }

  setLoading(true);
  hideError();
  hideResult();

  // ユーザーネームをlocalStorageに保存
  localStorage.setItem('chuniforce_username', username);

  try {
    // スコアデータと定数マップを並行取得
    const [records, constMap] = await Promise.all([
      fetchScores(username),
      fetchConstantMap(),
    ]);

    // 対象難易度でフィルタ
    const filtered = filterRecords(records);
    if (filtered.length === 0) {
      showError('対象難易度（MAS/ULT/EXP/ADV/BAS）のスコアデータが取得できませんでした。スコアを公開状態に設定しているか確認してください。');
      return;
    }

    const result = calcChuniForce(filtered, constMap);
    renderResult(username, result);

  } catch (err) {
    console.error(err);
    const msg = err.message || '';
    if (msg.includes('404') || msg.includes('403') || msg.includes('401')) {
      showError('ユーザーが見つかりませんでした。ユーザーネームを確認してください。');
    } else if (msg.includes('private') || msg.includes('非公開')) {
      showError('スコアが非公開に設定されています。');
    } else {
      showError(`通信エラーが発生しました: ${msg}`);
    }
  } finally {
    setLoading(false);
  }
}

// ──────────────────────────────────────────
//  API 通信
// ──────────────────────────────────────────
async function fetchScores(username) {
  const params = new URLSearchParams({
    token:     API_TOKEN,
    region:    'jp2',
    user_name: username,
  });
  const res = await fetch(`${API_URL}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // レスポンスが配列 / { records: [...] } の両形式に対応
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.records)) return data.records;
  if (data && Array.isArray(data.entries)) return data.entries;
  if (data && typeof data === 'object') return Object.values(data).flat();
  throw new Error('予期しないAPIレスポンス形式です');
}

// ──────────────────────────────────────────
//  フィルタ & 正規化
// ──────────────────────────────────────────
/**
 * diff フィールドを MAS / ULT / EXP / ADV / BAS に正規化する
 * 上記以外（WORLD'S END 等）は null を返す
 */
function normalizeDiff(raw) {
  const d = (raw || '').toUpperCase().trim();
  // chunirec は省略形でそのまま返す( MAS, ULT, EXP, ADV, BAS )
  if (TARGET_DIFFS.has(d)) return d;
  // 念のため長い表記にも対応
  const map = {
    MASTER:   'MAS',
    ULTIMA:   'ULT',
    EXPERT:   'EXP',
    ADVANCED: 'ADV',
    BASIC:    'BAS',
  };
  return map[d] ?? null;
}

function filterRecords(records) {
  return records.filter(r => normalizeDiff(r.diff) !== null);
}

// ──────────────────────────────────────────
//  reiwa.f5.si から正確な譜面定数マップを取得
//  戻り値: { [title]: { MAS, ULT, EXP, ADV, BAS } }  ※ 値は number | null
// ──────────────────────────────────────────
async function fetchConstantMap() {
  try {
    const res = await fetch(REIWA_URL);
    if (!res.ok) throw new Error(`reiwa HTTP ${res.status}`);
    const list = await res.json();
    const byTitle = {};
    for (const item of list) {
      const title = item.meta?.title;
      if (!title) continue;
      const entry = {};
      for (const diff of ['BAS', 'ADV', 'EXP', 'MAS', 'ULT']) {
        const c = item.data?.[diff]?.const;
        entry[diff] = c != null ? parseFloat(c) : null;
      }
      byTitle[title] = entry;
    }
    console.log('[reiwa] loaded', Object.keys(byTitle).length, 'songs');
    return byTitle;
  } catch (e) {
    console.warn('[reiwa] fetch failed, falling back to chunirec const:', e);
    return {}; // フォールバック
  }
}

// ──────────────────────────────────────────
//  譜面定数の取得
//  優先順位: reiwa のタイトル検索 → chunirec の const → level
//  is_const_unknown: true であっても chunirec の const 値をそのまま使用
// ──────────────────────────────────────────
function getConstant(r, constMap = {}) {
  const title = r.title ?? null;
  const diff  = normalizeDiff(r.diff);

  // 1. reiwa: タイトルで検索（最優先）
  if (title && constMap[title]) {
    const c = constMap[title][diff];
    if (c != null) return c;
  }

  // 2. chunirec API の const フィールド（is_const_unknown でも使用）
  const c = r['const'];
  if (c != null) return parseFloat(c);

  // 3. level にフォールバック（保険）
  if (r.level != null) return parseFloat(r.level) || 0;
  return 0;
}

// ──────────────────────────────────────────
//  ランプ判定
// ──────────────────────────────────────────
/**
 * AJC 判定: score === 1,010,000（理論値）
 * AJ 判定: is_alljustice === true（AJC 以外）
 * FC 判定: is_fullcombo === true（AJ 以外）
 */
function getLamp(r) {
  const score = parseInt(r.score, 10) || 0;
  if (score === 1010000)   return 'AJC';
  if (r.is_alljustice)     return 'AJ';
  if (r.is_fullcombo)      return 'FC';
  return 'CLR';
}

function getLampBonus(lamp) {
  switch (lamp) {
    case 'AJC': return 3.1;
    case 'AJ':  return 3.0;
    case 'FC':  return 2.0;
    case 'CLR': return 1.5;
    default:    return 0.0;
  }
}

// ──────────────────────────────────────────
//  スコア補正値の計算
//  戻り値: 譜面定数に加算するスコア補正値
// ──────────────────────────────────────────
function calcScoreBonus(score, constant) {
  if (score >= 1010000) return 2.25;

  if (score >= 1009000)
    return 2.15 + (score - 1009000) * 0.0001;

  if (score >= 1007500)
    return 2.0 + (score - 1007500) * 0.0001;

  if (score >= 1005000)
    return 1.5 + (score - 1005000) * 0.0002;

  if (score >= 1000000)
    return 1.0 + (score - 1000000) * 0.0001;

  if (score >= 990000)
    return 0.6 + Math.floor((score - 990000) / 10) * 0.0004;

  if (score >= 975000)
    return 0.0 + Math.floor((score - 975000) / 10) * 0.0004;

  if (score >= 950000)
    return -1.67 + Math.floor((score - 950000) / 15) * 0.001;

  if (score >= 925000)
    return -3.34 + Math.floor((score - 925000) / 15) * 0.001;

  if (score >= 900000)
    return -5.0 + Math.floor((score - 900000) / 15) * 0.001;

  // BBB 区間 (800000〜900000): step = 2000 / (const - 5) 点ごとに +0.01
  // BBB 基準値 (800000): rating = (const - 5) / 2, bonus = -(const + 5) / 2
  const c5 = constant - 5;
  if (score >= 800000) {
    const step   = c5 > 0 ? 2000 / c5 : Infinity;
    const base   = c5 > 0 ? -((constant + 5) / 2) : -constant;
    return base + Math.floor((score - 800000) / step) * 0.01;
  }

  // C 区間 (500000〜800000): step = 6000 / (const - 5) 点ごとに +0.01, 基準 = -const (rating=0)
  if (score >= 500000) {
    const step = c5 > 0 ? 6000 / c5 : Infinity;
    return -constant + Math.floor((score - 500000) / step) * 0.01;
  }

  // 500000 未満: rating = 0 → bonus = -const
  return -constant;
}

// ──────────────────────────────────────────
//  単曲 chuni-force 値の算出
// ──────────────────────────────────────────
function calcSingleForce(score, constant, lamp) {
  const scoreBonus = calcScoreBonus(score, constant);
  const lampBonus  = getLampBonus(lamp);
  const force      = constant + scoreBonus + lampBonus;
  return { force, scoreBonus, lampBonus };
}

// ──────────────────────────────────────────
//  ランク名と基準補正値（表示用）
// ──────────────────────────────────────────
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

// ──────────────────────────────────────────
//  ランクに応じた CSS クラス名
// ──────────────────────────────────────────
function getRankClass(rankName) {
  if (rankName === 'SSS+')                        return 'rank-sssp';
  if (['SSS','SS+','SS','S+','S'].includes(rankName)) return 'rank-plat';
  if (['AAA','AA','A'].includes(rankName))        return 'rank-gold';
  if (rankName === 'BBB')                         return 'rank-blue';
  if (rankName === 'C')                           return 'rank-brown';
  return 'rank-grey';
}
function calcChuniForce(records, constMap = {}) {
  // 各楽曲の単曲 force を算出
  const entries = records.map(r => {
    const diff     = normalizeDiff(r.diff);
    const score    = parseInt(r.score, 10) || 0;
    const constant = getConstant(r, constMap);
    const lamp     = getLamp(r);
    const title    = r.title || r.music_title || '(不明)';
    const { force, scoreBonus, lampBonus } = calcSingleForce(score, constant, lamp);
    return { diff, score, constant, lamp, title, force, scoreBonus, lampBonus };
  });

  // 降順ソートして上位 50曲をベスト枠に
  entries.sort((a, b) => b.force - a.force);
  const best50 = entries.slice(0, BEST_COUNT);

  const bestSum = best50.reduce((s, e) => s + e.force, 0);
  const bestAvg = bestSum / BEST_COUNT;

  // 理論値枠カウント（MAS / ULT のみ、score === 1,010,000）
  const masTheory = records.filter(r =>
    normalizeDiff(r.diff) === 'MAS' && parseInt(r.score, 10) === 1010000
  ).length;

  const ultTheory = records.filter(r =>
    normalizeDiff(r.diff) === 'ULT' && parseInt(r.score, 10) === 1010000
  ).length;

  const theorySum   = masTheory + ultTheory;
  const theoryBonus = theorySum / 1000;

  // 暫定 chuni-force
  const chuniforce = bestAvg + theoryBonus;

  // chuni-force 理論値
  // ① reiwaの全楽曲（全難易度）から、存在する譜面定数をすべてリストアップ
  const allConstants = [];
  for (const title in constMap) {
    const diffs = constMap[title];
    for (const d in diffs) {
      if (diffs[d] !== null) {
        allConstants.push(diffs[d]);
      }
    }
  }

  // ② 譜面定数の降順にソートし、上位50譜面を選出
  allConstants.sort((a, b) => b - a);
  const theoryTop50Constants = allConstants.slice(0, BEST_COUNT);

  // ③ 全て score=1,010,000 / AJC として force 値を算出・平均
  const theoryBestSum = theoryTop50Constants.reduce((s, c) => {
    return s + calcSingleForce(1010000, c, 'AJC').force;
  }, 0);
  const theoryBestAvg = theoryBestSum / BEST_COUNT;

  // ④ 全曲の MAS・ULT の総数を理論値ボーナスとして換算
  let masUltTotal = 0;
  for (const title in constMap) {
    if (constMap[title]['MAS'] !== null) masUltTotal++;
    if (constMap[title]['ULT'] !== null) masUltTotal++;
  }
  const maxTheoryBonus   = masUltTotal / 1000;
  const chuniforceTheory = theoryBestAvg + maxTheoryBonus;

  return {
    best50,
    bestSum,
    bestAvg,
    masTheory,
    ultTheory,
    theorySum,
    theoryBonus,
    chuniforce,
    chuniforceTheory,
  };
}

// ──────────────────────────────────────────
//  エンブレムと星の計算 (requirements.md 5.4 準拠)
// ──────────────────────────────────────────
function getClassInfo(force) {
  if (force < 10.0) return { id: 1, name: 'Ⅰ', color: 'ainshen',   stars: force < 2.5 ? 1 : force < 5.0 ? 2 : force < 7.5 ? 3 : 4 };
  if (force < 12.0) return { id: 2, name: 'Ⅱ', color: 'zweilean',  stars: force < 10.5 ? 1 : force < 11.0 ? 2 : force < 11.5 ? 3 : 4 };
  if (force < 14.0) return { id: 3, name: 'Ⅲ', color: 'dreidian',  stars: force < 12.5 ? 1 : force < 13.0 ? 2 : force < 13.5 ? 3 : 4 };
  if (force < 15.0) return { id: 4, name: 'Ⅳ', color: 'fierambre', stars: force < 14.25 ? 1 : force < 14.5 ? 2 : force < 14.75 ? 3 : 4 };
  if (force < 16.0) return { id: 5, name: 'Ⅴ', color: 'funfmeil',  stars: force < 15.25 ? 1 : force < 15.5 ? 2 : force < 15.75 ? 3 : 4 };
  if (force < 17.0) return { id: 6, name: 'Ⅵ', color: 'sechside',  stars: force < 16.25 ? 1 : force < 16.5 ? 2 : force < 16.75 ? 3 : 4 };
  if (force < 18.0) return { id: 7, name: 'Ⅶ', color: 'siebergent',stars: force < 17.25 ? 1 : force < 17.5 ? 2 : force < 17.75 ? 3 : 4 };
  if (force < 19.0) return { id: 8, name: 'Ⅷ', color: 'achtrum',   stars: force < 18.25 ? 1 : force < 18.5 ? 2 : force < 18.75 ? 3 : 4 };
  if (force < 20.0) return { id: 9, name: 'Ⅸ', color: 'neunstral', stars: force < 19.25 ? 1 : force < 19.5 ? 2 : force < 19.75 ? 3 : 4 };
  // CLASS 10 (20.000 ~)
  return { id: 10, name: 'Ⅹ', color: 'zeternal', stars: force < 21.0 ? 1 : force < 22.0 ? 2 : force < 23.0 ? 3 : 4 };
}

// ──────────────────────────────────────────
//  描画
// ──────────────────────────────────────────
function renderResult(username, result) {
  const {
    best50, bestSum, bestAvg,
    masTheory, ultTheory, theorySum,
    theoryBonus, chuniforce, chuniforceTheory,
  } = result;

  // 総合値
  cfValueEl.textContent       = chuniforce.toFixed(3);
  cfTheoryEl.textContent      = chuniforceTheory.toFixed(3);
  bdBestSumEl.textContent     = bestSum.toFixed(4);
  bdBestAvgEl.textContent     = bestAvg.toFixed(4);
  bdTheoryBonusEl.textContent = '+' + theoryBonus.toFixed(3);
  usernameBadge.textContent   = username;
  bestCountBadge.textContent  = `${best50.length}曲`;

  // エンブレム描画（ローマ数字テキスト）
  const romanEl   = document.getElementById('cf-roman');
  const starsWrap = document.getElementById('cf-stars');
  const valLabel  = document.getElementById('cf-value-label');
  const valNum    = document.getElementById('cf-value');
  const cls       = getClassInfo(chuniforce);

  // 文字の設定
  romanEl.textContent = cls.name;

  // 各要素の色クラスを一旦リセットしてから付与
  for (let i = 1; i <= 10; i++) {
    romanEl.classList.remove('cf-color-' + i);
    if (valLabel) valLabel.classList.remove('cf-color-' + i);
    valNum.classList.remove('cf-color-' + i);
  }
  const colorClass = 'cf-color-' + cls.id;
  romanEl.classList.add(colorClass);
  if (valLabel) valLabel.classList.add(colorClass);
  valNum.classList.add(colorClass);

  // 星アイコンの生成 (MAX 4つ)
  let starsHtml = '';
  for (let i = 1; i <= 4; i++) {
    const activeClass = i <= cls.stars ? 'active' : '';
    starsHtml += `<div class="star-icon ${activeClass}"></div>`;
  }
  starsWrap.innerHTML = starsHtml;

  // 理論値枠テーブル
  theoryTbody.innerHTML = `
    <tr>
      <td style="text-align:center;font-family:var(--font-en);font-size:1.15rem;font-weight:700;color:#ce93d8">${masTheory}</td>
      <td style="text-align:center;font-family:var(--font-en);font-size:1.15rem;font-weight:700;color:#ef9a9a">${ultTheory}</td>
      <td style="text-align:center;font-family:var(--font-en);font-size:1.15rem;font-weight:700">${theorySum}</td>
      <td style="text-align:center;font-family:var(--font-en);font-size:1.15rem;font-weight:700;color:var(--gold)">${theoryBonus.toFixed(3)}</td>
    </tr>`;

  // ベスト枠テーブル
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

  showResult();
}

// ──────────────────────────────────────────
//  UI ヘルパー
// ──────────────────────────────────────────
function setLoading(on) {
  calcBtn.disabled = on;
  loadingArea.classList.toggle('hidden', !on);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorArea.classList.remove('hidden');
}

function hideError() {
  errorArea.classList.add('hidden');
}

function showResult() {
  resultArea.classList.remove('hidden');
  resultArea.classList.add('fade-in');
}

function hideResult() {
  resultArea.classList.add('hidden');
  resultArea.classList.remove('fade-in');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, maxLen) {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}
