export const BEST_COUNT  = 50;
export const TARGET_DIFFS = new Set(['MAS', 'ULT', 'EXP', 'ADV', 'BAS']);

export function normalizeDiff(raw) {
  const d = (raw || '').toUpperCase().trim();
  if (TARGET_DIFFS.has(d)) return d;
  const map = {
    MASTER:   'MAS',
    ULTIMA:   'ULT',
    EXPERT:   'EXP',
    ADVANCED: 'ADV',
    BASIC:    'BAS',
  };
  return map[d] ?? null;
}

export function filterRecords(records) {
  return records.filter(r => normalizeDiff(r.diff) !== null);
}

export function getConstant(r, constMap = {}) {
  const title = r.title ?? null;
  const diff  = normalizeDiff(r.diff);

  if (title && constMap[title]) {
    const c = constMap[title][diff];
    if (c != null) return c;
  }

  const c = r['const'];
  if (c != null) return parseFloat(c);

  if (r.level != null) return parseFloat(r.level) || 0;
  return 0;
}

export function getLamp(r) {
  const score = parseInt(r.score, 10) || 0;
  if (score === 1010000)   return 'AJC';
  if (r.is_alljustice)     return 'AJ';
  if (r.is_fullcombo)      return 'FC';
  return 'CLR';
}

export function getLampBonus(lamp) {
  switch (lamp) {
    case 'AJC': return 3.1;
    case 'AJ':  return 3.0;
    case 'FC':  return 2.0;
    case 'CLR': return 1.5;
    default:    return 0.0;
  }
}

export function calcScoreBonus(score, constant) {
  if (score >= 1010000) return 2.25;
  if (score >= 1009000) return 2.15 + (score - 1009000) * 0.0001;
  if (score >= 1007500) return 2.0 + (score - 1007500) * 0.0001;
  if (score >= 1005000) return 1.5 + (score - 1005000) * 0.0002;
  if (score >= 1000000) return 1.0 + (score - 1000000) * 0.0001;
  if (score >= 990000)  return 0.6 + Math.floor((score - 990000) / 10) * 0.0004;
  if (score >= 975000)  return 0.0 + Math.floor((score - 975000) / 10) * 0.0004;
  if (score >= 950000)  return -1.67 + Math.floor((score - 950000) / 15) * 0.001;
  if (score >= 925000)  return -3.34 + Math.floor((score - 925000) / 15) * 0.001;
  if (score >= 900000)  return -5.0 + Math.floor((score - 900000) / 15) * 0.001;

  const c5 = constant - 5;
  if (score >= 800000) {
    const step = c5 > 0 ? 2000 / c5 : Infinity;
    const base = c5 > 0 ? -((constant + 5) / 2) : -constant;
    return base + Math.floor((score - 800000) / step) * 0.01;
  }
  if (score >= 500000) {
    const step = c5 > 0 ? 6000 / c5 : Infinity;
    return -constant + Math.floor((score - 500000) / step) * 0.01;
  }
  return -constant;
}

export function calcSingleForce(score, constant, lamp) {
  const scoreBonus = calcScoreBonus(score, constant);
  const lampBonus  = getLampBonus(lamp);
  const force      = constant + scoreBonus + lampBonus;
  return { force, scoreBonus, lampBonus };
}

export function getRankInfo(score) {
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

export function getRankClass(rankName) {
  if (rankName === 'SSS+')                        return 'rank-sssp';
  if (['SSS','SS+','SS','S+','S'].includes(rankName)) return 'rank-plat';
  if (['AAA','AA','A'].includes(rankName))        return 'rank-gold';
  if (rankName === 'BBB')                         return 'rank-blue';
  if (rankName === 'C')                           return 'rank-brown';
  return 'rank-grey';
}

export function getClassInfo(force) {
  if (force < 10.0) return { id: 1, name: 'Ⅰ', color: 'ainshen',   stars: force < 2.5 ? 1 : force < 5.0 ? 2 : force < 7.5 ? 3 : 4 };
  if (force < 12.0) return { id: 2, name: 'Ⅱ', color: 'zweilean',  stars: force < 10.5 ? 1 : force < 11.0 ? 2 : force < 11.5 ? 3 : 4 };
  if (force < 14.0) return { id: 3, name: 'Ⅲ', color: 'dreidian',  stars: force < 12.5 ? 1 : force < 13.0 ? 2 : force < 13.5 ? 3 : 4 };
  if (force < 15.0) return { id: 4, name: 'Ⅳ', color: 'fierambre', stars: force < 14.25 ? 1 : force < 14.5 ? 2 : force < 14.75 ? 3 : 4 };
  if (force < 16.0) return { id: 5, name: 'Ⅴ', color: 'funfmeil',  stars: force < 15.25 ? 1 : force < 15.5 ? 2 : force < 15.75 ? 3 : 4 };
  if (force < 17.0) return { id: 6, name: 'Ⅵ', color: 'sechside',  stars: force < 16.25 ? 1 : force < 16.5 ? 2 : force < 16.75 ? 3 : 4 };
  if (force < 18.0) return { id: 7, name: 'Ⅶ', color: 'siebergent',stars: force < 17.25 ? 1 : force < 17.5 ? 2 : force < 17.75 ? 3 : 4 };
  if (force < 19.0) return { id: 8, name: 'Ⅷ', color: 'achtrum',   stars: force < 18.25 ? 1 : force < 18.5 ? 2 : force < 18.75 ? 3 : 4 };
  if (force < 20.0) return { id: 9, name: 'Ⅸ', color: 'neunstral', stars: force < 19.25 ? 1 : force < 19.5 ? 2 : force < 19.75 ? 3 : 4 };
  return { id: 10, name: 'Ⅹ', color: 'zeternal', stars: force < 21.0 ? 1 : force < 22.0 ? 2 : force < 23.0 ? 3 : 4 };
}

export function calcChuniForce(records, constMap = {}) {
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

  entries.sort((a, b) => b.force - a.force);
  const best50 = entries.slice(0, BEST_COUNT);

  const bestSum = best50.reduce((s, e) => s + e.force, 0);
  const bestAvg = bestSum / BEST_COUNT;

  const theoryEntries = records.filter(r => parseInt(r.score, 10) === 1010000).map(r => {
    const diff = normalizeDiff(r.diff);
    const constant = getConstant(r, constMap);
    const title = r.title || r.music_title || '(不明)';
    const img = constMap[title]?.img || null;
    const singleForce = Math.pow(constant / 15.0, 2) * 2;
    return { diff, title, constant, img, singleForce };
  });

  theoryEntries.sort((a, b) => b.constant - a.constant);
  const theoryBest50 = theoryEntries.slice(0, BEST_COUNT);

  const masTheoryCount = theoryEntries.filter(e => e.diff === 'MAS').length;
  const ultTheoryCount = theoryEntries.filter(e => e.diff === 'ULT').length;

  const theoryBonusSum = theoryBest50.reduce((s, e) => s + e.singleForce, 0);
  const theoryBonus = theoryBonusSum / BEST_COUNT;
  const theoryCountBonus = (masTheoryCount + ultTheoryCount) / 10000;

  const chuniforce = bestAvg + theoryBonus + theoryCountBonus;

  const allConstants = [];
  for (const title in constMap) {
    for (const d in constMap[title]) {
      if (typeof constMap[title][d] === 'number') {
        allConstants.push(constMap[title][d]);
      }
    }
  }

  allConstants.sort((a, b) => b - a);
  const theoryTop50Constants = allConstants.slice(0, BEST_COUNT);

  const theoryBestSum = theoryTop50Constants.reduce((s, c) => {
    return s + calcSingleForce(1010000, c, 'AJC').force;
  }, 0);
  const theoryBestAvg = theoryBestSum / BEST_COUNT;

  const allTheoryConstants = [];
  let allMasTheoryCount = 0;
  let allUltTheoryCount = 0;
  for (const title in constMap) {
    if (constMap[title]['MAS'] !== null) {
      allTheoryConstants.push(constMap[title]['MAS']);
      allMasTheoryCount++;
    }
    if (constMap[title]['ULT'] !== null) {
      allTheoryConstants.push(constMap[title]['ULT']);
      allUltTheoryCount++;
    }
    if (constMap[title]['EXP'] !== null) allTheoryConstants.push(constMap[title]['EXP']);
    if (constMap[title]['ADV'] !== null) allTheoryConstants.push(constMap[title]['ADV']);
    if (constMap[title]['BAS'] !== null) allTheoryConstants.push(constMap[title]['BAS']);
  }

  allTheoryConstants.sort((a, b) => b - a);
  const theoryTop50AllSongs = allTheoryConstants.slice(0, BEST_COUNT);

  const maxTheoryBonusSum = theoryTop50AllSongs.reduce((s, c) => s + (Math.pow(c / 15.0, 2) * 2), 0);
  const maxTheoryBonus = maxTheoryBonusSum / BEST_COUNT;
  const maxTheoryCountBonus = (allMasTheoryCount + allUltTheoryCount) / 10000;
  const chuniforceTheory = theoryBestAvg + maxTheoryBonus + maxTheoryCountBonus;

  return {
    best50, bestSum, bestAvg, masTheoryCount, ultTheoryCount, allMasTheoryCount, allUltTheoryCount,
    theoryBest50, theoryBonus, theoryCountBonus, chuniforce, chuniforceTheory,
  };
}
