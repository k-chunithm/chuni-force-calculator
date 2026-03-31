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

choiced = []
for music in data:
    if music["lev_mas"] != "":
        choiced.append(music)

os.makedirs(os.path.join(jacketpath, "jackets"), exist_ok=True)

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
        
        # Check if already exists in R2
        r2_exists = False
        if s3_client:
            try:
                s3_client.head_object(Bucket=R2_BUCKET_NAME, Key=r2_key)
                r2_exists = True
            except Exception as e:
                # 404 means it doesn't exist
                pass

        if not os.path.isfile(filepath) or (s3_client and not r2_exists):
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
                if s3_client and not r2_exists:
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
        else:
            print(f"「{title}」は既に存在しています (Local & R2)")
            
    except Exception as e:
        print(f"Error processing {title}: {e}")
        traceback.print_exc()
        time.sleep(1)

print("完了しました。")
