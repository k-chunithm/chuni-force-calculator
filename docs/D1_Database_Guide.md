# Cloudflare D1（SQLite）データベース構成とSQLの流れ

このドキュメントでは、CHUNIFORCE Calculator における Cloudflare D1（サーバーレスリレーショナルデータベース）の構築フロー、内部構造（スキーマ）、および実際の送受信におけるSQLコマンド（Read/Write）の具体例をまとめます。

---

## 1. D1データベースの作成フロー

Cloudflare D1 はバックエンド（Cloudflare Worker）に直結して動く、超高速な分散型SQLiteデータベースです。作成の流れは主に以下の3ステップで行います。

1. **データベースの作成 (CLI)**
   ターミナル等のCLI環境で以下のコマンドを実行し、Cloudflareのインフラ上に空のデータベースを作成します。
   ```bash
   npx wrangler d1 create chuni-force-db
   ```
2. **`wrangler.toml` へのバインディング（紐付け）設定**
   コマンド実行後に表示される `database_name` と `database_id` を、Workerの設定ファイル（`wrangler.toml`）に追記します。
   これにより、Workerのコード内で `env.DB.prepare(...)` のように直接データベースを操作できるようになります。
3. **スキーマ作成（テーブル構築）と初期化**
   あらかじめ設計した「テーブル構造」が書かれたSQLファイル（例: `schema.sql`）を用意し、以下のコマンドでデータベースを初期化します。

   - **ローカル環境テスト用:**
     ```bash
     npx wrangler d1 execute chuni-force-db --local --file=./schema.sql
     ```
   - **本番環境（リモート）への適用:**
     ```bash
     npx wrangler d1 execute chuni-force-db --remote --file=./schema.sql
     ```

---

## 2. データベースの中身（テーブル設計案）

現在の CHUNIFORCE Calculator の設計において、D1データベースで管理しているメインテーブルは **`users` テーブル 1つのみ** です。
ランキングやマイページの表示に必要な全データ（各曲のスコア等）は、すべて `best_json` などのJSON形式のカラムに圧縮して保存し、REST APIの認証は自己完結型トークン（JWT等）で処理しているため、複数のテーブルを結合（JOIN）する必要がない非常に効率的かつ軽量な設計（NoSQLライクな使い方）になっています。

※ ただし、もし将来的に「過去の成績の推移グラフ」や「セッションの厳密な管理」など大幅に機能拡張を行う場合、以下のようなテーブルが追加される可能性があります。
- **`score_history` テーブル**: いつ・どのくらいFORCEが変動したかを時系列グラフにするため、日々の更新データを蓄積する履歴テーブル
- **`sessions` テーブル**: ログイン状態（セッション）をデータベース側で管理し、リモートで他の端末をログアウトさせられるようにするテーブル
- **`access_logs` テーブル**: 「誰がいつ計算リクエストを送信したか」を監視したり、短時間の過剰アクセス（Rate Limit）を管理・制限するためのテーブル

以下は現在稼働している `users` テーブルの詳細です。

### `users` テーブル構造
| カラム名 | データ型 | デフォルト/制約 | 概要・役割 |
|---|---|---|---|
| `username` | TEXT | PRIMARY KEY | ユーザーID（ログインID・一意） |
| `password_hash` | TEXT | NOT NULL | 暗号化ハッシュ化されたパスワード |
| `display_name` | TEXT | | マイページやランキングで表示するプレイヤー名 |
| `chuniforce` | REAL | 0.0 | 総合CHUNIFORCE値（ランキング用に使用） |
| `best_avg` | REAL | 0.0 | ベスト枠の平均FORCE |
| `ajc_avg` | REAL | 0.0 | 理論値枠の平均FORCE |
| `ajc_bonus` | REAL | 0.0 | 理論値数ボーナスの加算値 |
| `ajc_mas_count` | INTEGER | 0 | MASで達成済みの理論値曲数 |
| `ajc_mas_total` | INTEGER | 0 | 全MAS対象曲数 |
| `ajc_ult_count` | INTEGER | 0 | ULTで達成済みの理論値曲数 |
| `ajc_ult_total` | INTEGER | 0 | 全ULT対象曲数 |
| `best_json` | TEXT | | ベスト枠50曲分の詳細配列（長文のJSON文字列） |
| `ajc_json` | TEXT | | 理論値枠の詳細配列（長文のJSON文字列） |
| `email` | TEXT | | パスワード再設定用などのメールアドレス |
| `is_public` | INTEGER | 1 (公開) | マイページの公開設定フラグ（0=非公開, 1=公開） |
| `updated_at` | DATETIME | | データが最終更新された日時 |

---

## 3. 具体的なSQL文（Read / Write の連携）

実際のアプリケーションコード（`js/main.js` や `js/user.js`）からAPI経由でWorkerに届いたリクエストは、以下のSQLに変換されてD1に対し実行されます。

### 【Write】計算データの書き込み（INSERT / UPDATE）
**発火タイミング**: ユーザーが `calculator.html` で「CHUNIFORCEを計算」を利用して結果が出た直後

**API経路**: `main.js` ➔ `fetch(POST /user)` ➔ Worker ➔ D1

取得・計算したすべての結果をデータベースに保存します。「データがなければ新規作成(INSERT)、既にあれば上書き(UPDATE)」をするために、SQLite特有の **`UPSERT`（INSERT ... ON CONFLICT ... DO UPDATE）構文** を使います。

```sql
INSERT INTO users (
  username, display_name, chuniforce,
  best_avg, ajc_avg, ajc_bonus,
  ajc_mas_count, ajc_mas_total, ajc_ult_count, ajc_ult_total,
  best_json, ajc_json, updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
ON CONFLICT(username) DO UPDATE SET
  display_name = excluded.display_name,
  chuniforce = excluded.chuniforce,
  best_avg = excluded.best_avg,
  -- （以下、取得した各種データやJSON文字列をすべて更新）
  updated_at = datetime('now');
```

---

### 【Write】設定の更新（UPDATE）
**発火タイミング**: ユーザーが `setting.html` で公開設定やメアドを変更したとき

**API経路**: `settings.js` ➔ `fetch(POST /user/settings)` ➔ Worker ➔ D1

部分的なデータだけを書き換えます。
```sql
UPDATE users
SET email = ?, is_public = ?, updated_at = datetime('now')
WHERE username = ?;
```

---

### 【Read】マイページデータの呼び出し（SELECT）
**発火タイミング**: 誰かが特定のマイページURL（`user/index.html#username`）を開いたとき

**API経路**: `user.js` ➔ `fetch(GET /user?name=username)` ➔ Worker ➔ D1

保存されているグラフ描画用の一式（JSONデータなど）を取り出します。Worker側では、取り出した時の `is_public` の値やリクエスト元のユーザーIDを判別し、「他人の非公開データ」にあたる場合は `403 Forbidden` 等を返してブロックします。

```sql
SELECT
  display_name, chuniforce,
  best_avg, ajc_avg, ajc_bonus,
  ajc_mas_count, ajc_mas_total, ajc_ult_count, ajc_ult_total,
  best_json, ajc_json, is_public, updated_at
FROM users
WHERE username = ?;
```
※ 長大なテキストである `best_json` を取り出し、JavaScript側で `JSON.parse()` してグラフの各パーツ情報に復元しています。

---

### 【Read】総合ランキング一覧の呼び出し（SELECT / ORDER BY）
**発火タイミング**: `ranking.html` を開いたとき

**API経路**: `ranking.js` ➔ `fetch(GET /ranking)` ➔ Worker ➔ D1

スコアが公開状態（`is_public = 1`）になっている全ユーザーから、CHUNIFORCEの高い順（`DESC`）に100人を抽出してランキングを作ります。グラフ用の重いJSONデータは不要なので、表示に必要な一部のカラムのみを速やかに取り出します。

```sql
SELECT
  username, display_name, chuniforce, updated_at
FROM users
WHERE is_public = 1
ORDER BY chuniforce DESC
LIMIT 100;
```
