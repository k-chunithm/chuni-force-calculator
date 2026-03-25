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

## 2. データベースの中身（テーブル構成）

現在の CHUNIFORCE Calculator では、用途に分けて **3つのテーブル**（`users`, `user_history`, `ranking_cache`）を運用しています。
以前は `users` テーブル単体でのみ運用していましたが、機能の拡張に伴い履歴管理やキャッシングの機能が追加されました。
いずれもREST APIの認証は自己完結型トークン（JWT等）で処理しており、複雑なリレーション（JOIN）を極力減らした効率的かつ軽量な設計になっています。

### ① `users` テーブル
ユーザーごとのアカウント情報や、最新のCHUNIFORCE計算結果・プロフィール情報を保持するメインテーブルです。各曲のスコア等データの多い部分は JSON文字列に圧縮して保存しています。chunirec APIから得られるプロフィール情報（称号、クラスなど）もここに追加集約されています。

| カラム名 | データ型 | 概要・役割 |
|---|---|---|
| `username` | TEXT (PK) | ユーザーID（chunirec の一意のユーザー名） |
| `password_hash` | TEXT | ハッシュ化されたパスワード |
| `email` | TEXT | メールアドレス（パスワードリセット用など） |
| `display_name` | TEXT | マイページやランキングで表示するプレイヤー名 |
| `is_public` | INTEGER | プロフィールの公開設定フラグ（0=非公開, 1=公開） |
| `chuniforce` | REAL | 総合CHUNIFORCE値（ランキング用に使用） |
| `cf_theory` | REAL | 理論値枠の合計 FORCE |
| `best_avg` | REAL | ベスト枠の平均FORCE |
| `ajc_avg` | REAL | 理論値枠の平均FORCE |
| `ajc_bonus` | REAL | 理論値数ボーナスの加算値 |
| `ajc_mas_count` | INTEGER | MASで達成済みの理論値曲数 |
| `ajc_mas_total` | INTEGER | 全MAS対象曲数 |
| `ajc_ult_count` | INTEGER | ULTで達成済みの理論値曲数 |
| `ajc_ult_total` | INTEGER | 全ULT対象曲数 |
| `best_json` | TEXT | ベスト枠50曲分の詳細配列（JSON文字列） |
| `ajc_json` | TEXT | 理論値枠の詳細配列（JSON文字列） |
| `rating` | REAL | 現在のレーティング |
| `rating_max` | REAL | 到達したMAXレーティング |
| `class` | TEXT | 所属クラス |
| `title` | TEXT | 装備している称号名 |
| `title_rarity` | INTEGER | 装備称号のレアリティ |
| `honor` | TEXT | chunirecの旧来形式の称号オブジェクトなど |
| `play_count` | INTEGER | プレイ回数 |
| `friend_code` | TEXT | フレンドコード |
| `profile_json` | TEXT | 将来拡張用・生プロフィール情報の完全なJSON文字列 |
| `reset_token` | TEXT | 再設定用トークン |
| `reset_token_expires`| TEXT | 再設定用トークン有効期限 |
| `updated_at` | TEXT | データが最終更新された日時 |

### ② `user_history` テーブル
マイページの推移グラフ等を描画するために、CHUNIFORCEなどのスコアが更新されるたびに時系列データとして記録を蓄積する履歴テーブルです。

| カラム名 | データ型 | 概要・役割 |
|---|---|---|
| `username` | TEXT | ユーザーID |
| `chuniforce` | REAL | 記録時点の総合CHUNIFORCE値 |
| `best_avg` | REAL | 記録時点のベスト枠平均 |
| `ajc_avg` | REAL | 記録時点の理論値枠平均 |
| `ajc_bonus` | REAL | 記録時点の各種ボーナス |
| `ajc_mas_count` | INTEGER | 記録時点のMAS理論値達成数 |
| `ajc_ult_count` | INTEGER | 記録時点のULT理論値達成数 |
| `ajc_mas_total` | INTEGER | (システム用) 全MAS数 |
| `ajc_ult_total` | INTEGER | (システム用) 全ULT数 |
| `timestamp` | TEXT | 記録日時 |

### ③ `ranking_cache` テーブル
ランキング一覧画面の表示を高速化するため、定期的にユーザーの一覧をソートしてキャッシュしておくための一時データテーブルです。

| カラム名 | データ型 | 概要・役割 |
|---|---|---|
| `category` | TEXT (PK) | ランキング種別（`chuniforce`, `best_avg` など） |
| `rank` | INTEGER (PK) | キャッシュ時点の順位 |
| `username` | TEXT | ユーザーID |
| `display_name` | TEXT | 表示名 |
| `is_public` | INTEGER | 公開設定状態 |
| `value` | REAL | キャッシュされたそのカテゴリのスコア |
| `ajc_mas_count` | INTEGER | (補助表示用情報) MAS理論値達成数 |
| `ajc_ult_count` | INTEGER | (補助表示用情報) ULT理論値達成数 |
| `cached_at` | TEXT | キャッシュ生成日時 |

---

## 3. 具体的なSQL文（Read / Write の連携）

実際のアプリケーションコード（`js/main.js` や `js/api.js`）からAPI経由でWorkerに届いたリクエストは、以下のSQLに変換されてD1に対し実行されます。

### 【Write】計算データ・プロフィール情報の書き込み
**発火タイミング**: ユーザーが `calculator.html` で「CHUNIFORCEを計算」を利用して結果が出た直後（ログイン中のみ自動保存）、またはアカウントの手動更新時

**API経路**: `main.js` ➔ `fetch(POST /user)` ➔ Worker ➔ D1

取得・計算したすべての結果（および関連するプロフィール情報すべて）をデータベースに保存します。「データがなければ新規作成(INSERT)、既にあれば上書き(UPDATE)」をするために、SQLite特有の **`UPSERT`（INSERT ... ON CONFLICT ... DO UPDATE）構文** を使います。

```sql
INSERT INTO users (
  username, display_name, chuniforce,
  best_avg, ajc_avg, ajc_bonus,
  ajc_mas_count, ajc_mas_total, ajc_ult_count, ajc_ult_total,
  best_json, ajc_json, updated_at,
  rating, rating_max, honor, class, play_count, friend_code, title, title_rarity, profile_json
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(username) DO UPDATE SET
  display_name = excluded.display_name,
  chuniforce = excluded.chuniforce,
  best_avg = excluded.best_avg,
  -- ... その他多数の該当カラム
  rating_max = excluded.rating_max,
  title = excluded.title,
  updated_at = datetime('now');
```
※同時に `user_history` テーブルに対しても、今回のスコア履歴を `INSERT` します。

---

### 【Write】設定の更新
**発火タイミング**: ユーザーが `setting.html` で公開設定やパスワード・メールアドレスを変更したとき

**API経路**: `setting.html` ➔ `fetch(POST /user/settings)` ➔ Worker ➔ D1

部分的なデータだけを書き換えます。
```sql
UPDATE users
SET email = ?, is_public = ?
WHERE username = ?;
```

---

### 【Read】マイページデータの呼び出し
**発火タイミング**: 誰かが特定のマイページURL（`user/index.html#username`）を開いたとき

**API経路**: `user_page.js` ➔ `fetch(GET /user?name=username)` ➔ Worker ➔ D1

保存されているグラフ描画用の一式や、詳細なプロフィール情報を取り出します。Worker側では、取り出した時の `is_public` の値やリクエスト元のユーザーIDを判別し、「他人の非公開データ」にあたる場合は `403 Forbidden` 等を返してブロックします。

```sql
SELECT * FROM users WHERE username = ?;
```
※同時に `user_history` からそのユーザーの過去の推移データも `SELECT` して結合し、フロント側に返却します。長大なテキストである `best_json` 等はJavaScript側で `JSON.parse()` してグラフの各パーツ情報に復元しています。

---

### 【Read】総合ランキング一覧の呼び出し
**発火タイミング**: `ranking.html` を開いたとき

**API経路**: `ranking.js` ➔ `fetch(GET /ranking)` ➔ Worker ➔ D1

ランキングデータは通常、定期的に生成される `ranking_cache` テーブルから即座に取得されます。

```sql
SELECT * FROM ranking_cache
WHERE category = 'chuniforce'
ORDER BY rank ASC;
```
※事前にバッチ処理（Cronトリガー）にて `users` テーブルを利用したランキング生成が自動で行われています。
