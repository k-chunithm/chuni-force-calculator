# Cloudflare Workers プロキシ セットアップ手順

APIキーをフロントエンドから隠すため、Cloudflare Workers でプロキシを構築する手順。

## 構成

```
[ブラウザ] → [Cloudflare Worker] → [api.chunirec.net]
                  ↑ APIキーはここに環境変数として保存
```

---

## 1. 事前準備

```bash
npm install -g wrangler
wrangler login   # ブラウザが開くのでCloudflareアカウントでログイン
```

---

## 2. Worker プロジェクト作成

```bash
cd /path/to/chuni-force-calculator
wrangler init cloudflare-worker
```

対話プロンプトの回答：

| 質問 | 回答 |
|------|------|
| What would you like to start with? | **Hello World example** |
| Which template would you like to use? | **Worker only** |
| Which language do you want to use? | **JavaScript** |
| git for version control? | No（親リポジトリに任せる） |
| Deploy now? | No |

---

## 3. Worker コードの書き換え

`cloudflare-worker/src/index.js` を以下で上書き：

```javascript
const CHUNIREC_BASE = 'https://api.chunirec.net/2.0';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env), status: 204 });
    }
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const url    = new URL(request.url);
    const path   = url.searchParams.get('path') || 'records/showall.json';
    const params = new URLSearchParams(url.searchParams);
    params.delete('path');
    params.set('token', env.CHUNIREC_TOKEN);  // APIキーをサーバー側で付与

    const target = `${CHUNIREC_BASE}/${path}?${params}`;
    const res    = await fetch(target);
    const body   = await res.text();

    return new Response(body, {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
      status: res.status,
    });
  }
};

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin':  env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
```

---

## 4. シークレットの登録

```bash
cd cloudflare-worker

# Chunirec APIトークンを登録（実行後のプロンプトでトークンを貼り付けてEnter）
wrangler secret put CHUNIREC_TOKEN

# CORSで許可するオリジンを登録（例: https://k-chunithm.github.io）
wrangler secret put ALLOWED_ORIGIN
```

> **注意：** `wrangler secret put CHUNIREC_TOKEN` の `CHUNIREC_TOKEN` はシークレットの**名前**。
> トークンの値はコマンド実行後のプロンプトで入力する。

---

## 5. デプロイ

```bash
npm run deploy
```

初回は workers.dev サブドメインの登録が必要（プロンプトに従う）。

成功すると以下が表示される：
```
https://chunirec-proxy.k-chunithm.workers.dev
```

---

## 6. フロントエンドの修正

`js/api.js` からトークンを削除し、プロキシ経由に変更：

```javascript
// Before（削除）
export const API_TOKEN = '...';
export const API_URL = 'https://api.chunirec.net/2.0/records/showall.json';

// After
const PROXY_URL = 'https://chunirec-proxy.k-chunithm.workers.dev';
```

`fetchScores` / `fetchProfile` の fetch 先を `PROXY_URL` に変更し、
リクエストパラメータに `path: 'records/showall.json'` を追加する。

---

## 再デプロイ（コード変更時）

```bash
cd cloudflare-worker
npm run deploy
```

## シークレットの更新

```bash
wrangler secret put CHUNIREC_TOKEN   # トークンを更新
wrangler secret put ALLOWED_ORIGIN  # オリジンを更新
```

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| CORS エラー | `ALLOWED_ORIGIN` を正しいオリジンで再設定 |
| 401 Unauthorized | `CHUNIREC_TOKEN` を再設定 |
| TypeError: Failed to fetch | `PROXY_URL` のURLを確認 |
