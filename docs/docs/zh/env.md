# 鐜鍙橀噺閰嶇疆鎸囧崡

Shishirinee 閮ㄧ讲闇€瑕侀厤缃袱绫荤幆澧冨彉閲忥細**Variables锛堟槑鏂囧彉閲忥級**鍜?*Secrets锛堝姞瀵嗗彉閲忥級**銆?
## 蹇€熷尯鍒?
| 绫诲瀷 | 瀛樺偍鏂瑰紡 | 鐢ㄩ€?| 绀轰緥 |
|------|---------|------|------|
| **Variables** | 鏄庢枃瀛樺偍鍦?`wrangler.toml` | 閰嶇疆鍙傛暟銆佸紑鍏抽€夐」 | 瀛樺偍妗跺悕绉般€佺紦瀛樻ā寮?|
| **Secrets** | 鍔犲瘑瀛樺偍鍦?Cloudflare | 鏁忔劅鍑瘉銆佸瘑閽?| API 瀵嗛挜銆佸瘑鐮併€乀oken |

---

## Variables锛堟槑鏂囧彉閲忥級

杩欎簺鍙橀噺鍦?`wrangler.toml` 涓槑鏂囧瓨鍌紝鐢ㄤ簬閰嶇疆鍔熻兘寮€鍏冲拰鍩烘湰鍙傛暟銆?
### 绔欑偣閰嶇疆

| 鍙橀噺鍚?| 蹇呭～ | 鎻忚堪 | 榛樿鍊?| 閰嶇疆閿悕 |
|--------|------|------|--------|----------|
| `NAME` | 鍚?| 缃戠珯鍚嶇О | Shishirinee | `site.name` |
| `DESCRIPTION` | 鍚?| 缃戠珯鎻忚堪 | A lightweight personal blogging system | `site.description` |
| `AVATAR` | 鍚?| 缃戠珯澶村儚 URL | - | `site.avatar` |
| `PAGE_SIZE` | 鍚?| 榛樿鍒嗛〉澶у皬 | 5 | `site.page_size` |
| `RSS_ENABLE` | 鍚?| 鍚敤 RSS 閾炬帴 | false | `rss` |

:::tip
绔欑偣閰嶇疆鍙湪閮ㄧ讲鍚庨€氳繃**璁剧疆椤甸潰**淇敼锛岀幆澧冨彉閲忎粎浣滀负鍒濆鍊笺€?:::

### 瀛樺偍閰嶇疆

| 鍙橀噺鍚?| 蹇呭～ | 鎻忚堪 | 榛樿鍊?| 绀轰緥 |
|--------|------|------|--------|------|
| `S3_FOLDER` | 鏄?| 鍥剧墖瀛樺偍璺緞 | images/ | `images/` |
| `S3_CACHE_FOLDER` | 鍚?| 缂撳瓨鏂囦欢璺緞 | cache/ | `cache/` |
| `S3_BUCKET` | 鏄?| S3 瀛樺偍妗跺悕绉?| - | `my-bucket` |
| `S3_REGION` | 鏄?| S3 鍖哄煙锛圧2 濉?auto锛?| - | `auto` |
| `S3_ENDPOINT` | 鏄?| S3 鎺ュ叆鐐瑰湴鍧€ | - | `https://xxx.r2.cloudflarestorage.com` |
| `S3_ACCESS_HOST` | 鍚?| 瀵瑰璁块棶鍦板潃 | 鍚?S3_ENDPOINT | `https://cdn.example.com` |
| `S3_FORCE_PATH_STYLE` | 鍚?| 寮哄埗璺緞鏍峰紡 | false | `false` |

### 鍔熻兘寮€鍏?
| 鍙橀噺鍚?| 蹇呭～ | 鎻忚堪 | 榛樿鍊?| 鎺ㄨ崘鍊?|
|--------|------|------|--------|--------|
| `CACHE_STORAGE_MODE` | 鍚?| 缂撳瓨妯″紡锛歴3/database | s3 | **database** |
| `WEBHOOK_URL` | 鍚?| 璇勮閫氱煡 Webhook | - | - |
| `RSS_TITLE` | 鍚?| RSS 鏍囬 | - | - |
| `RSS_DESCRIPTION` | 鍚?| RSS 鎻忚堪 | - | - |

:::tip 鏂扮敤鎴锋帹鑽?寤鸿灏?`CACHE_STORAGE_MODE` 璁句负 `database`锛屾棤闇€棰濆閰嶇疆 S3 缂撳瓨鍗冲彲浣跨敤锛岄檷浣庨儴缃插鏉傚害銆?:::

---

## Secrets锛堝姞瀵嗗彉閲忥級

杩欎簺鏁忔劅淇℃伅蹇呴』浣滀负 **Cloudflare Workers Secrets** 閰嶇疆锛岄儴缃叉椂閫氳繃鍛戒护琛岃緭鍏ユ垨鎻愬墠璁剧疆銆?
### 璁よ瘉鐩稿叧锛堣嚦灏戦厤缃竴绉嶏級

| 鍙橀噺鍚?| 鐢ㄩ€?| 鑾峰彇鏂瑰紡 |
|--------|------|----------|
| `Shishirinee_GITHUB_CLIENT_ID` | GitHub OAuth 瀹㈡埛绔?ID | GitHub OAuth App 璁剧疆 |
| `Shishirinee_GITHUB_CLIENT_SECRET` | GitHub OAuth 瀹㈡埛绔瘑閽?| GitHub OAuth App 璁剧疆 |
| `ADMIN_USERNAME` | 璐﹀彿瀵嗙爜鐧诲綍鐢ㄦ埛鍚?| 鑷璁惧畾 |
| `ADMIN_PASSWORD` | 璐﹀彿瀵嗙爜鐧诲綍瀵嗙爜 | 鑷璁惧畾 |
| `JWT_SECRET` | JWT 绛惧悕瀵嗛挜锛堜换鎰忛殢鏈哄瓧绗︿覆锛?| 鑷鐢熸垚 |

:::warning 璁よ瘉瑕佹眰
蹇呴』閰嶇疆 **GitHub OAuth** 鎴?**璐﹀彿瀵嗙爜** 鍏朵腑涓€绉嶇櫥褰曟柟寮忥紝鍚﹀垯鏃犳硶鐧诲綍鍚庡彴銆?:::

### S3 瀛樺偍鍑瘉

| 鍙橀噺鍚?| 鐢ㄩ€?| 鑾峰彇鏂瑰紡 |
|--------|------|----------|
| `S3_ACCESS_KEY_ID` | S3 璁块棶瀵嗛挜 ID | R2 API Token ID |
| `S3_SECRET_ACCESS_KEY` | S3 璁块棶瀵嗛挜 | R2 API Token |

### Cloudflare 閮ㄧ讲鍑瘉

| 鍙橀噺鍚?| 鐢ㄩ€?| 鑾峰彇鏂瑰紡 |
|--------|------|----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 璁块棶浠ょ墝 | Cloudflare 闈㈡澘 鈫?鎴戠殑涓汉璧勬枡 鈫?API 浠ょ墝 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 璐︽埛 ID | Cloudflare 闈㈡澘鍙充晶 sidebar |

---

## GitHub Actions 鍙橀噺閰嶇疆

浣跨敤 GitHub Actions 鑷姩閮ㄧ讲鏃讹紝闇€鍦?Repository 璁剧疆涓厤缃互涓嬪彉閲忥細

### Repository Variables锛圫ettings 鈫?Secrets and variables 鈫?Variables锛?
```
NAME              # 缃戠珯鍚嶇О
DESCRIPTION       # 缃戠珯鎻忚堪
AVATAR            # 缃戠珯澶村儚
PAGE_SIZE         # 鍒嗛〉澶у皬
RSS_ENABLE        # 鏄惁鍚敤 RSS
CACHE_STORAGE_MODE # 缂撳瓨妯″紡锛堟帹鑽?database锛?R2_BUCKET_NAME    # 鍙€夛細璁剧疆鍚庨儴缃蹭細浠庤 bucket 鎺ㄥ S3_*锛涙湭璁剧疆鏃朵笉浼氳嚜鍔ㄩ€夋嫨浠讳綍 R2 bucket
WORKER_NAME       # Worker 鍚嶇О锛堝彲閫夛級
DB_NAME           # D1 鏁版嵁搴撳悕绉帮紙鍙€夛級
```

### Repository Secrets锛圫ettings 鈫?Secrets and variables 鈫?Secrets锛?
```
CLOUDFLARE_API_TOKEN      # Cloudflare API 浠ょ墝
CLOUDFLARE_ACCOUNT_ID     # Cloudflare 璐︽埛 ID
S3_ENDPOINT               # S3/R2 鎺ュ叆鐐?S3_ACCESS_HOST            # S3/R2 璁块棶鍩熷悕
S3_BUCKET                 # S3 瀛樺偍妗跺悕绉?S3_ACCESS_KEY_ID          # S3 璁块棶瀵嗛挜 ID
S3_SECRET_ACCESS_KEY      # S3 璁块棶瀵嗛挜
Shishirinee_GITHUB_CLIENT_ID      # GitHub OAuth ID锛堝彲閫夛級
Shishirinee_GITHUB_CLIENT_SECRET  # GitHub OAuth Secret锛堝彲閫夛級
ADMIN_USERNAME            # 绠＄悊鍛樼敤鎴峰悕锛堝彲閫夛級
ADMIN_PASSWORD            # 绠＄悊鍛樺瘑鐮侊紙鍙€夛級
JWT_SECRET                # JWT 瀵嗛挜
```

---

## 鏈湴寮€鍙戠幆澧冨彉閲?
鏈湴寮€鍙戜娇鐢?`.env` 鏂囦欢锛屽弬鑰?`.env.example`锛?
```bash
# 绔欑偣閰嶇疆
NAME="My Blog"
DESCRIPTION="A personal blog"

# S3 瀛樺偍锛堜娇鐢?R2 鎴?MinIO锛?S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_BUCKET=my-bucket
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx

# 璁よ瘉锛圙itHub 鎴栬处鍙峰瘑鐮侊級
Shishirinee_GITHUB_CLIENT_ID=xxx
Shishirinee_GITHUB_CLIENT_SECRET=xxx
# 鎴?ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password

# 鍏朵粬
JWT_SECRET=random_secret_key
CACHE_STORAGE_MODE=database
```

