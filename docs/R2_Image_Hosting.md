# R2 画像ホスティングと同期の手順

このドキュメントでは、CHUNIFORCE Calculator の楽曲画像を Cloudflare R2 で管理・同期する方法について説明します。

## 概要

以前の環境では `reiwa.f5.si` や各ワーカーに依存した複雑な同期フローがありましたが、現在は **公式の SEGA JSON (`music.json`) から直接画像を取得し、WebP に変換して R2 に自動アップロードする** 構成に刷新されています。
日々の新曲追加の検知とアップロード作業は、GitHub Actions が自動で行います。

## R2 バケットのセットアップ

楽曲画像を保存するための R2 バケットを Cloudflare ダッシュボードで作成します。

1. **バケットの作成**
   - Cloudflare ダッシュボードの左メニューから「R2」を開き、「Create bucket」ボタンをクリックします。
   - Bucket name に `chuniforce-images` と入力し、作成します（名前を変える場合は環境変数 `R2_BUCKET_NAME` などの手動修正が必要です）。
2. **ストレージクラスと料金**
   - R2 は月間 10GB まで無料枠があります。楽曲画像（webp）は軽量なため、全曲分でも無料枠内に十分収まります。
3. **パブリックアクセスの設定 (不要)**
   - 本システムでは **Worker が画像を代行配信する** ため、R2 バケット自体の「パブリックアクセス（r2.dev）」を有効にする必要はありません。安全のために閉じたままにしておいてください。

## GitHub Actions による自動同期

毎日 24:00 (JST) に、公式の楽曲リストに変更がないかを GitHub Actions が自動でチェックします。追加された新しい楽曲が見つかった場合は、スクリプトが画像を WebP に変換し、R2 バケットへ自動で転送します。

### 必要なシークレットの設定
GitHub Actions が適切に R2 へ書き込めるよう、以下の値を GitHub リポジトリ（**Settings > Secrets and variables > Actions**）に「New repository secret」として登録する必要があります。

- `R2_ENDPOINT_URL`（例：`https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com`）
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`（例：`chuniforce-images`）

※ `R2_DIRECTORY`（`chunithm-jackets`）はワークフローファイル内に直接記述されているため、シークレットへの登録は不要です。

## 手動での実行（ローカル環境）

ローカル環境のPC（ターミナル）から、手動で一括同期や修正を行うことも可能です。

1. **必要なライブラリのインストール**
   ```bash
   pip install requests boto3 Pillow
   ```
2. **シェルの設定と実行**
   プロジェクトルートにある `scripts/run_sync.sh` に `R2_ENDPOINT_URL` などを記述して実行すると、公式から差分画像を見つけ次第すべて登録します。
   ```bash
   ./scripts/run_sync.sh
   ```

### フォルダの完全初期化
R2内の全画像を消して一からやり直したい場合は用意されている `delete_folder.py` を活用します。
`run_sync.sh` 内の実行ファイルを `python scripts/delete_folder.py` に書き換え実行すると、`chunithm-jackets/` ディレクトリ内の全ファイルを安全に一括削除できます。

## 技術仕様
- **R2 バケット名:** `chuniforce-images`
- **保存ディレクトリ名:** `chunithm-jackets/` （R2上のプレフィックス）
- **画像配信 URL:** `https://chunirec-proxy.k-chunithm.workers.dev/jacket/{img}.webp`
   - Cloudflare Worker の `index.js` 内部で `chunithm-jackets/{img}.webp` への変換を自動処理しています。
- **保存形式:** WebP (`image/webp`)
- **メタデータ:** オブジェクトストレージのカスタムメタデータとして `%URLエンコードされた文字%` 形式で `title`, `artist` の情報を不可視領域に含めています。
