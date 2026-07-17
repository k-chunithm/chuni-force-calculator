# CHUNIFORCE Calculator

音楽ゲーム「CHUNITHM」において、既存のレート計算とは異なる新しい実力指標「**CHUNIFORCE**」を算出・表示するWebアプリケーションです。SOUND VOLTEXの「VOLTFORCE」に着想を得ており、プレイヤーの実力を新しい角度から可視化します。

公開サイト:
- GitHub Pages: https://k-chunithm.github.io/chuni-force-calculator/
- Cloudflare Pages: https://chuni-force-calculator.pages.dev/

---

## 主な機能

- **CHUNIFORCE計算**: chunirecで公開設定になっているスコアデータを元に、ベスト枠50曲および理論値枠を合算してCHUNIFORCE値を算出します。
- **CLASS / エンブレム表示**: 算出されたCHUNIFORCE値に応じて、CLASS Ⅰ〜Ⅹまでの段階的な称号（エンブレム）を授与します。
- **ユーザーアカウント（任意）**: アカウント登録を行うことで、自身の成績や推移をマイページに保存・公開できます。セッションの有効期限切れ検知や、自動ログアウト機能も備えています。
- **ランキング**: 登録ユーザーの中でのCHUNIFORCE値やベスト枠平均などのランキング（TOP 100）を閲覧可能です。

---

## 技術スタック

| 要素 | 技術・サービス |
|---|---|
| **フロントエンド** | HTML / CSS / JavaScript (Vanilla) |
| **ホスティング** | GitHub Pages / Cloudflare Pages |
| **バックエンド (API)** | Cloudflare Workers |
| **データベース** | Cloudflare D1 (SQLite互換) |
| **外部連携API** | chunirec API (スコア取得), reiwa.f5.si (譜面定数取得), Resend (メール送信) |

---

## ドキュメント

プロジェクトの詳細な仕様やセットアップ方法については、`docs/` フォルダ内の各ドキュメントをご参照ください。

- [**要件定義書 (`docs/requirements.md`)**](docs/requirements.md): CHUNIFORCEの計算式、機能要件、データ仕様など。
- [**Cloudflare Workers セットアップ手順 (`docs/Cloudflare_setup.md`)**](docs/Cloudflare_setup.md): バックエンドAPIとCORSプロキシの設定手順。
- [**D1 Database ガイド (`docs/D1_Database_Guide.md`)**](docs/D1_Database_Guide.md): データベースのスキーマや操作コマンド。
- [**R2 Image Hosting (`docs/R2_Image_Hosting.md`)**](docs/R2_Image_Hosting.md): （使用中の場合）Cloudflare R2 を用いた画像のホスティングに関する手順。

---

## 計算ロジックの概要

CHUNIFORCEは以下の要素を合算して算出されます。詳細は要件定義書を確認してください。

```text
CHUNIFORCE = (ベスト枠50曲の単曲FORCE値の平均)
              + (理論値枠上位50曲の単曲AJC-FORCE値の平均)
              + (MAS & ULT の理論値総数 ÷ 10000)
```
*単曲FORCE値 = 譜面定数 + スコア補正値 + ランプ補正値*

---

## ローカルでの実行

本システムは静的ファイルで構成されているため、ローカルで確認する場合は任意のローカルサーバーを使用します。

```bash
# Pythonを使用する場合
python3 -m http.server 8000

# Node.js (http-server)を使用する場合
npx http-server
```

バックエンド(Worker)のローカル開発を行う場合はWranglerを使用します。
```bash
cd cloudflare-worker
npm install
npm run dev
```

---

## 免責事項・注意事項

- 本システムはファンメイドの非公式ツールであり、株式会社セガとは一切関係ありません。
- **chunirec**のAPIを利用していますが、chunirec公式のツールではありません。chunirec側に負荷をかけないよう、APIの呼び出し間隔（キャッシュやクールダウン）には十分配慮して設計されています。
