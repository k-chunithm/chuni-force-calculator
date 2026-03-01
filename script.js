/**
 * CHUNIFORCE Calculator
 * chunirec records/showall API からスコアを取得し、CHUNIFORCE 値を算出して表示する
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
    // スコアデータ、定数マップ、プロフィール情報を並行取得
    const [records, constMap, profile] = await Promise.all([
      fetchScores(username),
      fetchConstantMap(),
      fetchProfile(username),
    ]);

    // プロフィールからプレイヤー名（表示名）を取得、なければ入力IDをフォールバック
    let displayUsername = username;
    if (profile && profile.player_name) {
      displayUsername = profile.player_name;
    }

    // 対象難易度でフィルタ
    const filtered = filterRecords(records);
    if (filtered.length === 0) {
      showError('対象難易度（MAS/ULT/EXP/ADV/BAS）のスコアデータが取得できませんでした。スコアを公開状態に設定しているか確認してください。');
      return;
    }

    const result = calcChuniForce(filtered, constMap);
    renderResult(displayUsername, result);

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
//  プロフィール情報取得 (chunirec records/profile.json)
// ──────────────────────────────────────────
async function fetchProfile(username) {
  const params = new URLSearchParams({
    token:     API_TOKEN,
    region:    'jp2',
    user_name: username,
  });
  try {
    const res = await fetch(`https://api.chunirec.net/2.0/records/profile.json?${params}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('[chunirec] profile fetch failed:', e);
    return null;
  }
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
      const entry = { img: item.meta?.img }; // 画像取得用IDを保存
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
//  単曲 CHUNIFORCE 値の算出
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
    const img      = constMap[title]?.img || null;
    const { force, scoreBonus, lampBonus } = calcSingleForce(score, constant, lamp);
    return { diff, score, constant, lamp, title, img, force, scoreBonus, lampBonus };
  });

  // 降順ソートして上位 50曲をベスト枠に
  entries.sort((a, b) => b.force - a.force);
  const best50 = entries.slice(0, BEST_COUNT);

  const bestSum = best50.reduce((s, e) => s + e.force, 0);
  const bestAvg = bestSum / BEST_COUNT;

  // ------------------------------------------------------------------
  // 新・理論値枠計算（MAS/ULT の理論値のうち、譜面定数(Const)上位50曲）
  // ------------------------------------------------------------------

  // MAS・ULTの理論値楽曲をすべて抽出
  const theoryEntries = records.filter(r => {
    const d = normalizeDiff(r.diff);
    const s = parseInt(r.score, 10);
    return (d === 'MAS' || d === 'ULT') && s === 1010000;
  }).map(r => {
    const diff = normalizeDiff(r.diff);
    const constant = getConstant(r, constMap);
    const title = r.title || r.music_title || '(不明)';
    const img = constMap[title]?.img || null;
    const singleBonus = Math.pow(constant / 15.0, 2) * 0.04;
    return { diff, title, constant, img, singleBonus };
  });

  // 定数の降順にソートし、最大50曲を抽出
  theoryEntries.sort((a, b) => b.constant - a.constant);
  const theoryBest50 = theoryEntries.slice(0, BEST_COUNT);

  // 全体の理論値件数（参考用）
  const masTheoryCount = theoryEntries.filter(e => e.diff === 'MAS').length;
  const ultTheoryCount = theoryEntries.filter(e => e.diff === 'ULT').length;

  // 定数上位50曲の単曲ボーナスを合算
  const theoryBonus = theoryBest50.reduce((s, e) => s + e.singleBonus, 0);

  // 暫定 CHUNIFORCE
  const chuniforce = bestAvg + theoryBonus;

  // CHUNIFORCE 理論値
  // ① reiwaの全楽曲（全難易度）から、存在する譜面定数をすべてリストアップ
  const allConstants = [];
  for (const title in constMap) {
    const diffs = constMap[title];
    for (const d in diffs) {
      if (typeof diffs[d] === 'number') {
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

  // ④ すべての MAS・ULT 譜面に理論値ボーナスを適用した場合の最大値を算出
  const allTheoryConstants = [];
  for (const title in constMap) {
    if (constMap[title]['MAS'] !== null) allTheoryConstants.push(constMap[title]['MAS']);
    if (constMap[title]['ULT'] !== null) allTheoryConstants.push(constMap[title]['ULT']);
  }
  // 降順ソート＆上位50個を取得し、新仕様式で累乗計算
  allTheoryConstants.sort((a, b) => b - a);
  const theoryTop50AllSongs = allTheoryConstants.slice(0, BEST_COUNT);

  const maxTheoryBonus = theoryTop50AllSongs.reduce((s, c) => {
    return s + (Math.pow(c / 15.0, 2) * 0.04);
  }, 0);

  const chuniforceTheory = theoryBestAvg + maxTheoryBonus;

  return {
    best50,
    bestSum,
    bestAvg,
    masTheoryCount,
    ultTheoryCount,
    theoryBest50,
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
  // 画像出力用にデータを保持
  currentRenderData = { username, result };

  const {
    best50, bestSum, bestAvg,
    masTheoryCount, ultTheoryCount, theoryBest50,
    theoryBonus, chuniforce, chuniforceTheory,
  } = result;

  // 総合値
  cfValueEl.textContent       = chuniforce.toFixed(3);
  cfTheoryEl.textContent      = chuniforceTheory.toFixed(3);
  bdBestSumEl.textContent     = bestSum.toFixed(4);
  bdBestAvgEl.textContent     = bestAvg.toFixed(4);
  bdTheoryBonusEl.textContent = '+' + theoryBonus.toFixed(4);
  usernameBadge.textContent   = username;
  bestCountBadge.textContent  = `${best50.length}曲`;
  const theoryCountBadge      = document.getElementById('theory-count-badge');
  if(theoryCountBadge) theoryCountBadge.textContent = `${theoryBest50.length}曲`;

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
          <td class="col-force" style="text-align:center; color: var(--accent3);">+${e.singleBonus.toFixed(4)}</td>
        </tr>
      `;
    }).join('');
  }

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
  const genBtnArea = document.getElementById('generate-action-area');
  if (genBtnArea) genBtnArea.classList.remove('hidden');
}

function hideResult() {
  resultArea.classList.add('hidden');
  resultArea.classList.remove('fade-in');
  const genBtnArea = document.getElementById('generate-action-area');
  if (genBtnArea) genBtnArea.classList.add('hidden');
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

// ──────────────────────────────────────────
//  画像出力用処理
// ──────────────────────────────────────────
const btnGenerateImg = document.getElementById('btn-generate-img');
const captureWrapper = document.getElementById('capture-wrapper');
const captureArea    = document.getElementById('capture-area');

// 直近の計算結果を保持する
let currentRenderData = null;
let currentImgDataUrl = null;

// 元の renderResult の直後や呼び出し元でこれを更新させるためのラッパー等を後で追加するが、
// ひとまず画像生成メインロジックを書く
btnGenerateImg.addEventListener('click', async () => {
  if (!currentRenderData) return;
  const { username, result } = currentRenderData;
  const {
    best50,
    bestAvg,
    chuniforce,
    chuniforceTheory,
    masTheoryCount,
    ultTheoryCount,
    theoryBest50,
    theoryBonus
  } = result;

  // ボタンをローディング状態に
  const originalText = btnGenerateImg.innerHTML;
  btnGenerateImg.innerHTML = `<span class="btn-text">生成中...</span>`;
  btnGenerateImg.disabled = true;

  try {
    // 1. テンプレートにデータを流し込む
    const now = new Date();
    const dateStr = now.getFullYear() + '/' +
                    String(now.getMonth()+1).padStart(2,'0') + '/' +
                    String(now.getDate()).padStart(2,'0') + ' ' +
                    String(now.getHours()).padStart(2,'0') + ':' +
                    String(now.getMinutes()).padStart(2,'0');

    // 楽曲画像をBase64データとして事前に取得する関数
    const fetchImageAsBase64 = async (url) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        return await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        return null; // エラー時はnullを返す
      }
    };

    const best50WithImages = await Promise.all(best50.map(async (e) => {
      const defaultImg = 'figs/favicon.png'; // またはBase64文字列
      const rawUrl = e.img ? `https://reiwa.f5.si/jackets/chunithm/${e.img}.webp` : defaultImg;
      let b64 = await fetchImageAsBase64(rawUrl);
      if (!b64 && e.img) b64 = 'figs/favicon.png';
      return { ...e, jacketB64: b64 };
    }));

    const theory50WithImages = await Promise.all(theoryBest50.map(async (e) => {
      const defaultImg = 'figs/favicon.png';
      const rawUrl = e.img ? `https://reiwa.f5.si/jackets/chunithm/${e.img}.webp` : defaultImg;
      let b64 = await fetchImageAsBase64(rawUrl);
      if (!b64 && e.img) b64 = 'figs/favicon.png';
      return { ...e, jacketB64: b64 };
    }));

    let gridHtml = '';
    best50WithImages.forEach((e, i) => {
      const diffClass = `d-${e.diff.toLowerCase()}`;
      gridHtml += `
        <div class="capture-song">
          <div class="c-song-rank">#${i + 1}</div>
          <div class="c-song-const" style="position: absolute; top: 6px; right: 6px; z-index: 2; font-size: 14px; font-family: var(--font-en); font-weight: bold; color: #fff; background: rgba(0,0,0,0.75); padding: 0 4px; border-radius: 4px; text-shadow: 0 1px 2px #000; border: 1px solid rgba(255,255,255,0.2);">${(e.constant || 0).toFixed(1)}</div>
          <img class="c-song-jacket" src="${e.jacketB64}" />
          <div class="c-song-details">
            <div class="c-song-meta" style="display: flex; justify-content: flex-start; margin-bottom: 2px;">
              <span class="diff-badge ${diffClass}" style="transform: scale(0.85) origin-left;">${e.diff}</span>
            </div>
            <div class="c-song-title">${escHtml(e.title)}</div>
            <div class="c-song-stats">
              <span class="c-song-score">${e.score} ${e.lamp !== 'CLEAR' && e.lamp !== 'FAILED' ? e.lamp : ''}</span>
              <span class="c-song-force">${e.force.toFixed(4)}</span>
            </div>
          </div>
        </div>
      `;
    });

    let theoryGridHtml = '';
    theory50WithImages.forEach((e, i) => {
      const diffClass = `d-${e.diff.toLowerCase()}`;
      theoryGridHtml += `
        <div class="capture-song">
          <div class="c-song-rank" style="color:var(--accent3);">#${i + 1}</div>
          <div class="c-song-const" style="position: absolute; top: 6px; right: 6px; z-index: 2; font-size: 14px; font-family: var(--font-en); font-weight: bold; color: #fff; background: rgba(0,0,0,0.75); padding: 0 4px; border-radius: 4px; text-shadow: 0 1px 2px #000; border: 1px solid rgba(255,255,255,0.2);">${(e.constant || 0).toFixed(1)}</div>
          <img class="c-song-jacket" src="${e.jacketB64}" />
          <div class="c-song-details">
            <div class="c-song-meta" style="display: flex; justify-content: flex-start; margin-bottom: 2px;">
              <span class="diff-badge ${diffClass}" style="transform: scale(0.85) origin-left;">${e.diff}</span>
            </div>
            <div class="c-song-title">${escHtml(e.title)}</div>
            <div class="c-song-stats">
              <span class="c-song-score" style="color:#ffd700;">1,010,000 AJC</span>
              <span class="c-song-force" style="color:var(--accent3);">+${e.singleBonus.toFixed(4)}</span>
            </div>
          </div>
        </div>
      `;
    });

    const cls = getClassInfo(chuniforce);

    // カラーコードをJS側でマップしてインライン適用（html2canvas強制）
    const colorMap = {
      1: '#bdc3c7', // グレー (要件定: 1)
      2: '#4aa8ff', // ブルー
      3: '#2ecc71', // グリーン
      4: '#ff9f43', // オレンジ
      5: '#ff4757', // レッド
      6: '#e056fd', // ピンク紫
      7: '#ecf0f1', // シルバー
      8: '#f1c40f', // ゴールド
      9: '#9b59b6', // パープル
      10: '#7c6dfa' // 虹色(テキスト代替としてタイトルのforce色であるネオンパープル)
    };
    const emblemColor = colorMap[cls.id] || '#fff';

    // すべてのCLASSでSVGを用いてテキストとネオン効果（ドロップシャドウ）を描画
    const forceValue = chuniforce.toFixed(3);
    const isRainbow = (cls.id === 10);
    const fillStyle = isRainbow ? 'url(#rainbowGrad)' : emblemColor;

    // 星の文字列生成 (★と☆)
    let activeStars = '';
    let inactiveStars = '';
    for (let s = 1; s <= 4; s++) {
      if (s <= cls.stars) activeStars += '★';
      else inactiveStars += '☆';
    }

    // 実際のサイト(result-card)デザインに近い、エンブレムと数値を横に並べた1つのSVGを作成
    const combinedSvgHtml = `
      <svg width="400" height="110" viewBox="0 0 400 110" xmlns="http://www.w3.org/2000/svg" style="display: block; overflow: visible;">
        <defs>
          <linearGradient id="rainbowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ff4d4d"/>
            <stop offset="15%" stop-color="#f96d00"/>
            <stop offset="30%" stop-color="#f2cb05"/>
            <stop offset="50%" stop-color="#2ecc71"/>
            <stop offset="70%" stop-color="#4aa8ff"/>
            <stop offset="85%" stop-color="#9b59b6"/>
            <stop offset="100%" stop-color="#e056fd"/>
          </linearGradient>
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComponentTransfer in="blur" result="glow">
              <feFuncA type="linear" slope="0.7" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <!-- 左側：エンブレムブロック -->
        <g transform="translate(45, 0)">
          <!-- ローマ数字(上辺合わせ) -->
          <text x="0" y="64" font-family="'Outfit', sans-serif" font-weight="900" font-size="64px" text-anchor="middle" fill="${fillStyle}" filter="url(#neonGlow)">
            ${cls.name}
          </text>
          <!-- 星(下辺合わせ) -->
          <text x="0" y="85" font-family="'Outfit', sans-serif" font-size="20px" text-anchor="middle" letter-spacing="3">
            <tspan fill="#ffd700" filter="url(#neonGlow)">${activeStars}</tspan><tspan fill="rgba(255,255,255,0.2)">${inactiveStars}</tspan>
          </text>
        </g>

        <!-- 右側：CHUNIFORCEブロック -->
        <g transform="translate(95, 0)">
          <!-- CHUNIFORCEラベル(上辺合わせ) -->
          <text x="0" y="27" font-family="'Outfit', sans-serif" font-weight="bold" font-size="15px" fill="${fillStyle}" letter-spacing="3" filter="url(#neonGlow)">
            CHUNIFORCE
          </text>
          <!-- CHUNIFORCE数値(下辺合わせ) -->
          <text x="0" y="85" font-family="'Outfit', sans-serif" font-weight="900" font-size="64px" fill="${fillStyle}" filter="url(#neonGlow)">
            ${forceValue}
          </text>
        </g>
      </svg>
    `;

    captureArea.innerHTML = `
      <div class="capture-header">
        <div class="capture-title-area">
          <div class="capture-title">
            <span class="title-logo-chuni">CHUNI</span><span class="title-logo-force">FORCE</span>
            <span class="title-text">ベスト枠対象楽曲</span>
          </div>
          <div class="capture-subtitle">By CHUNIFORCE Calculator</div>
        </div>
        <div class="capture-timestamp">
          GENERATE: ${dateStr}
        </div>
      </div>
      <div class="capture-player-info">
        <div class="capture-name-block">
          <div class="capture-name-label">Player's Name</div>
          <div class="capture-name">${escHtml(username)}</div>
        </div>
        <div class="capture-force-block" style="border: none; padding: 0;">
          <div style="display: flex; align-items: center; justify-content: flex-end;">
            ${combinedSvgHtml}
            <div class="capture-breakdown" style="display: flex; flex-direction: column; justify-content: center; gap: 8px; padding-left: 20px; border-left: 1px dashed rgba(255,255,255,0.2);">
              <div style="font-size: 14px; color: var(--text-muted); letter-spacing: 0.5px;">
                <span style="display:inline-block; width: 85px;">Best 50</span>
                <span style="font-family: var(--font-en); font-size: 18px; font-weight: bold; color: #fff;">${bestAvg.toFixed(4)}</span>
              </div>
              <div style="font-size: 14px; color: var(--text-muted); letter-spacing: 0.5px;">
                <span style="display:inline-block; width: 85px;">AJC Bonus</span>
                <span style="font-family: var(--font-en); font-size: 18px; font-weight: bold; color: var(--accent3);">+${theoryBonus.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="capture-theory-block">
          <div class="capture-theory-label">理論値 (MAX)</div>
          <div class="capture-theory">${chuniforceTheory.toFixed(3)}</div>
        </div>
      </div>
      <div style="display: flex; gap: 40px; padding: 0 40px; box-sizing: border-box; width: 100%;">
        <!-- 左側：ベスト枠50曲 -->
        <div style="flex: 1;">
          <div class="capture-grid-title" style="margin: 0 0 15px 0;">Best ${best50.length} Songs</div>
          <div class="capture-grid" style="padding: 0; box-shadow: none;">
            ${gridHtml}
          </div>
        </div>

        <!-- 右側：理論値枠50曲 -->
        <div style="flex: 1;">
          <div class="capture-grid-title" style="margin: 0 0 15px 0;">AJC Bonus (Top ${theoryBest50.length} Songs)</div>
          <div class="capture-grid" style="padding: 0; box-shadow: none;">
            ${theoryGridHtml}
          </div>
        </div>
      </div>

      <div class="capture-footer">
        Generated by CHUNIFORCE Calculator<br>
        ※本画像におけるロゴ・背景・楽曲ジャケット画像の著作権は、全て著作権所有者に帰属します。<br>
        ※本画像は非公式のものであり、株式会社SEGA様及びその関連会社とは一切関係ありません。
      </div>
    `;

    // 2. html2canvas で画像化 (画像読み込み待機は Base64 化により不要)
    const canvas = await html2canvas(captureArea, {
      scale: 2,
      useCORS: true,
      allowTaint: false, // trueだとcanvas.toDataURLでSecurityErrorになるためfalse
      backgroundColor: '#ffffff'
    });

    // 3. プレビュー表示
    const imgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const previewImg = document.getElementById('generated-image');
    const previewArea = document.getElementById('image-preview-area');

    currentImgDataUrl = imgDataUrl;
    previewImg.src = imgDataUrl;
    previewArea.classList.remove('hidden');

    // スクロールしてプレビューを見せる
    setTimeout(() => {
      previewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } catch (err) {
    console.error('画像生成エラー:', err);
    alert('画像の生成に失敗しました。');
  } finally {
    // 復元
    btnGenerateImg.innerHTML = originalText;
    btnGenerateImg.disabled = false;
  }
});

// ──────────────────────────────────────────
//  保存・X(Twitter)への共有 アクション
// ──────────────────────────────────────────
const btnSaveImg = document.getElementById('btn-save-img');
const btnShareX  = document.getElementById('btn-share-x');

if (btnSaveImg) {
  btnSaveImg.addEventListener('click', () => {
    if (!currentImgDataUrl || !currentRenderData) return;
    const link = document.createElement('a');
    link.href = currentImgDataUrl;
    link.download = `chuniforce_${currentRenderData.username}.jpg`;
    link.click();
  });
}

if (btnShareX) {
  btnShareX.addEventListener('click', async () => {
    if (!currentImgDataUrl || !currentRenderData) return;

    const shareText = `${currentRenderData.username}のCHUNIFORCE\n#CHUNIFORCE #チュウニズム`;

    // スマホ等で使える Web Share API (画像ファイル添付) を試みる
    if (navigator.share && navigator.canShare) {
      try {
        const res = await fetch(currentImgDataUrl);
        const blob = await res.blob();
        const file = new File([blob], `chuniforce_${currentRenderData.username}.jpg`, { type: 'image/jpeg' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            text: shareText,
            files: [file]
          });
          return; // 成功したら終了
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Share failed:', err);
        return; // ユーザーキャンセル等のエラーは無視
      }
    }

    // Web Share API が使えない環境（PCのブラウザ等）の場合は、自動保存を優先しWeb Intentを開く
    alert('お使いの環境では画像を直接X(Twitter)の投稿画面へ転送できません。\\n画像を保存しますので、この後開くX(Twitter)の画面にて手動で画像を添付してください。');

    const link = document.createElement('a');
    link.href = currentImgDataUrl;
    link.download = `chuniforce_${currentRenderData.username}.jpg`;
    link.click();

    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(intentUrl, '_blank');
  });
}

// ──────────────────────────────────────────
//  ハンバーガーメニュー・モーダル制御
// ──────────────────────────────────────────
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const navOverlay    = document.getElementById('nav-overlay');
const menuCloseBtn  = document.getElementById('menu-close-btn');

const contentModal  = document.getElementById('content-modal');
const contentModalClose = document.getElementById('content-modal-close');
const contentModalBody  = document.getElementById('content-modal-body');

// メニューの開閉
menuToggleBtn.addEventListener('click', () => {
  menuToggleBtn.classList.toggle('open');
  if (navOverlay.classList.contains('hidden')) {
    navOverlay.classList.remove('hidden');
    navOverlay.setAttribute('aria-hidden', 'false');
  } else {
    navOverlay.classList.add('hidden');
    navOverlay.setAttribute('aria-hidden', 'true');
  }
});

function closeNavMenu() {
  menuToggleBtn.classList.remove('open');
  navOverlay.classList.add('hidden');
  navOverlay.setAttribute('aria-hidden', 'true');
}
menuCloseBtn.addEventListener('click', closeNavMenu);
navOverlay.addEventListener('click', (e) => {
  if (e.target === navOverlay) closeNavMenu();
});

// モーダルコンテンツ定義
const modalContents = {
  'modal-about': `
    <h3>CHUNIFORCEとは？</h3>
    <p>「CHUNIFORCE」は、CHUNITHMにおける新たな非公式の実力指標です。<br>
    プレイヤーの実力をより正確に測るため、スコアの高さと譜面定数に基づいた算出方式（VOLFORCEに近い概念）を採用しています。</p>
    <p>本ツールはchunirec APIからスコアデータを取得し、独自の計算式を当てはめて「ベスト枠50曲」および「理論値枠50曲」から結果を算出します。</p>
    <p>※本ツールはCHUNITHM公式とは関係のないファンメイドツールです。</p>
  `,
  'modal-how': `
    <h3>使い方</h3>
    <ol style="margin-left: 1.5rem; color: var(--text); line-height: 1.8;">
      <li>chunirec（<a href="https://chunirec.net" target="_blank" style="color:var(--accent3);">https://chunirec.net</a>）に登録し、チュウニズムネットからスコアデータを更新してください。</li>
      <li>chunirecの「設定」で、スコアデータが「公開」設定になっていることを確認してください。</li>
      <li>本サイトの検索窓に <strong>chunirecのユーザーネーム</strong> を入力し、「計算する」ボタンを押します。</li>
      <li>計算結果とランキング詳細、CHUNIFORCE値が表示されます。「画像を生成」ボタンで結果をキャプチャしてSNS等でシェアできます！</li>
    </ol>
  `,
  'modal-qa': `
    <h3>Q &amp; A</h3>
    <dl style="color: var(--text); line-height: 1.8;">
      <dt style="font-weight:bold; color:var(--accent); margin-top:0.8rem;">Q. ユーザーが見つからない/エラーが出る</dt>
      <dd>A. ユーザーネームが間違っているか、chunirecのスコアが非公開設定になっている可能性があります。</dd>

      <dt style="font-weight:bold; color:var(--accent); margin-top:0.8rem;">Q. 計算式はどうなっているの？</dt>
      <dd>A. 他の音楽ゲームの実力指標をベースにしつつ、CHUNITHM独自のランプ補正（AJC等）を加味しています。<br>また、「理論値枠」はMASTER/ULTIMAの理論値（1,010,000点）の上位50曲に対して定数に応じたボーナスを付与します。</dd>

      <dt style="font-weight:bold; color:var(--accent); margin-top:0.8rem;">Q. 新曲のデータが反映されない</dt>
      <dd>A. APIおよびデータが有志のサイトから提供されているため、更新までしばらくお待ち下さい。</dd>
    </dl>
  `
};

// ナビボタンクリックでモーダル表示
const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = e.target.getAttribute('data-target');
    if (modalContents[target]) {
      contentModalBody.innerHTML = modalContents[target];
      closeNavMenu(); // メニューを閉じてから
      contentModal.classList.remove('hidden');
      contentModal.setAttribute('aria-hidden', 'false');
    }
  });
});

// モーダルを閉じてメイン画面へ戻る
function closeContentModal() {
  contentModal.classList.add('hidden');
  contentModal.setAttribute('aria-hidden', 'true');
}
contentModalClose.addEventListener('click', closeContentModal);
contentModal.addEventListener('click', (e) => {
  if (e.target === contentModal) closeContentModal();
});
