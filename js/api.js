export const API_TOKEN   = '255e414dcb7295f135eca9cabb890b85ad651fedc2148026491cd7044f847406e11e01cb366885f8deadaf4d259edbab5151a798b8888d6f13b6cd5805dec8b9';
export const REIWA_URL   = 'https://reiwa.f5.si/chunirec_all.json';
export const API_URL     = 'https://api.chunirec.net/2.0/records/showall.json';

// ──────────────────────────────────────────
//  API 通信
// ──────────────────────────────────────────
export async function fetchScores(username) {
  const params = new URLSearchParams({
    token:     API_TOKEN,
    region:    'jp2',
    user_name: username,
  });
  const res = await fetch(`${API_URL}?${params}`);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
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
export async function fetchProfile(username) {
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
//  reiwa.f5.si から正確な譜面定数マップを取得
//  戻り値: { [title]: { MAS, ULT, EXP, ADV, BAS } }  ※ 値は number | null
// ──────────────────────────────────────────
export async function fetchConstantMap() {
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
