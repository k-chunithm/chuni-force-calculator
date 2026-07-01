import hashlib
import os
import time
import traceback
import urllib.parse
from io import BytesIO

import requests
import boto3
from PIL import Image

# Cloudflare R2 configurations
R2_ENDPOINT_URL = os.environ.get("R2_ENDPOINT_URL") # e.g., "https://<account_id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "chuniforce-images")
R2_DIRECTORY = os.environ.get("R2_DIRECTORY", "") # R2内のディレクトリ指定（空の場合は直下）

# Setup S3 client for Cloudflare R2
if R2_ENDPOINT_URL and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY:
    s3_client = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT_URL,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto" # Cloudflare R2 usually specifies auto
    )
else:
    s3_client = None
    print("Warning: R2 environment variables are not fully set. Images will only be saved locally.")

req_url = "https://chunithm.sega.jp/storage/json/music.json"
img_baseurl = "https://new.chunithm-net.com/chuni-mobile/html/mobile/img/"

jacketpath = "./"

print("楽曲情報を取得しています...")
data = requests.get(req_url).json()

manual_json_path = os.path.join(os.path.dirname(__file__), "manual_music.json")
if os.path.isfile(manual_json_path):
    print(f"手動追加リスト ({os.path.basename(manual_json_path)}) を読み込んでいます...")
    import json
    with open(manual_json_path, "r", encoding="utf-8") as f:
        manual_data = json.load(f)
        data.extend(manual_data)

choiced = []
for music in data:
    if "lev_mas" in music and music["lev_mas"] != "":
        choiced.append(music)

os.makedirs(os.path.join(jacketpath, "jackets"), exist_ok=True)

existing_r2_keys = set()
if s3_client:
    print("R2から既存のファイル一覧を取得しています...")
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        prefix = f"{R2_DIRECTORY.rstrip('/')}/" if R2_DIRECTORY else ""
        for page in paginator.paginate(Bucket=R2_BUCKET_NAME, Prefix=prefix):
            if 'Contents' in page:
                for obj in page['Contents']:
                    existing_r2_keys.add(obj['Key'])
        print(f"R2上の既存ファイル数: {len(existing_r2_keys)}")
    except Exception as e:
        print(f"R2のファイル一覧取得に失敗しました: {e}")

for music in choiced:
    try:
        url = img_baseurl + music["image"]
        title = music["title"]
        artist = music["artist"]
        if title == "Scythe of Death":
            artist = "Masahiro “Godspeed” Aoki"
            
        # 既存のフロントエンド（reiwaベース）は、公式の画像ファイル名（.jpgなどの前の部分）をIDとしています。
        # MD5ハッシュ化してしまうとIDが一致せず取得できないため、こちらを使用します。
        img_id = music["image"].split('.')[0]
        
        # 既存のCloudflare Worker実装が .webp でリクエストを受けるため、PNGからWEBPに変換して保存します
        filename = f"{img_id}.webp"
        filepath = os.path.join(jacketpath, "jackets", filename)
        
        # R2上のパス（オブジェクトキー）を作成。指定のディレクトリがあればスラッシュで繋ぐ
        # 例: R2_DIRECTORY が "images/" なら "images/xxxx.webp" になる
        r2_key = f"{R2_DIRECTORY.rstrip('/')}/" + filename if R2_DIRECTORY else filename
        
        needs_download = False
        if s3_client:
            needs_download = r2_key not in existing_r2_keys
        else:
            needs_download = not os.path.isfile(filepath)

        if needs_download:
            print(f"「{title}」を{url}からダウンロードしています")
            imageblob = requests.get(url)
            
            if imageblob.status_code == 200:
                # PNGからWEBPへ変換
                img = Image.open(BytesIO(imageblob.content))
                webp_buffer = BytesIO()
                img.save(webp_buffer, format="WEBP")
                webp_data = webp_buffer.getvalue()
                
                # ローカルに保存
                if not os.path.isfile(filepath):
                    with open(filepath, "wb") as f:
                        f.write(webp_data)
                
                # R2へアップロード
                if s3_client:
                    print(f"  -> R2バケット '{R2_BUCKET_NAME}' にアップロード中...")
                    
                    # S3のカスタムメタデータはASCII必須のためURLエンコードする
                    encoded_title = urllib.parse.quote(title.encode('utf-8'))
                    encoded_artist = urllib.parse.quote(artist.encode('utf-8'))
                    
                    s3_client.put_object(
                        Bucket=R2_BUCKET_NAME,
                        Key=r2_key,
                        Body=webp_data,
                        ContentType="image/webp",
                        Metadata={
                            "title": encoded_title,
                            "artist": encoded_artist
                        }
                    )
            
            time.sleep(1)
            
    except Exception as e:
        print(f"Error processing {title}: {e}")
        traceback.print_exc()
        time.sleep(1)

print("完了しました。")
