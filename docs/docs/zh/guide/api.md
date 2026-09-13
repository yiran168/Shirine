# REST API 鎺ュ彛鏂囨。

ShiShishirineee 鍚庣鍩轰簬 Cloudflare Workers + Hono 鏋勫缓锛屾墍鏈夋帴鍙ｅ搷搴斿潎閬靛惊鏍囧噯 JSON 鏍煎紡銆?
---

## 缁熶竴鍝嶅簲鏍煎紡

```json
{
  "success": true,
  "data": { ... },
  "error": "鑻ュけ璐ユ椂杩斿洖閿欒鎻忚堪"
}
```

---

## 涓€銆佺敤鎴蜂笌璁よ瘉鎺ュ彛 (`/api/auth`, `/api/user`)

| 璺緞 | 鏂规硶 | 鏉冮檺瑕佹眰 | 鎻忚堪 |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | 鍏紑 | 鐢ㄦ埛娉ㄥ唽锛堥浣嶆敞鍐岃€呰嚜鍔ㄦ垚涓鸿秴绾х鐞嗗憳锛?|
| `/api/auth/login` | `POST` | 鍏紑 | 鐢ㄦ埛鐧诲綍锛岃繑鍥?JWT Token |
| `/api/auth/me` | `GET` | 鐧诲綍鐢ㄦ埛 | 鑾峰彇褰撳墠鐧诲綍鐢ㄦ埛鐨勮缁嗕俊鎭笌绉垎 |
| `/api/auth/logout` | `POST` | 鐧诲綍鐢ㄦ埛 | 閫€鍑虹櫥褰?|
| `/api/user/checkin` | `POST` | 鐧诲綍鐢ㄦ埛 | 姣忔棩鎵撳崱绛惧埌锛岃绠楃Н鍒嗗鍔变笌杩炵澶╂暟 |
| `/api/user/history` | `GET` | 鐧诲綍鐢ㄦ埛 | 鑾峰彇涓汉绛惧埌璁板綍鍘嗗彶 |
| `/api/user/profile` | `PUT` | 鐧诲綍鐢ㄦ埛 | 鏇存柊涓汉鏄电О銆佸ご鍍忔垨瀵嗙爜 |

---

## 浜屻€佸崥鏂囨帴鍙?(`/api/posts`)

| 璺緞 | 鏂规硶 | 鏉冮檺瑕佹眰 | 鎻忚堪 |
| :--- | :--- | :--- | :--- |
| `/api/posts` | `GET` | 鍏紑 | 鑾峰彇鍗氭枃鍒楄〃锛堟敮鎸佸垎椤点€佸垎绫讳笌鏍囩绛涢€夛級 |
| `/api/posts/:slugOrId` | `GET` | 鏅鸿兘鏉冮檺 | 鑾峰彇鍗曠瘒鍗氭枃璇︽儏锛堟湭婊¤冻鏉冮檺鏃惰劚鏁忥級 |
| `/api/posts/:id/unlock` | `POST` | 鐧诲綍鐢ㄦ埛 | 浣跨敤璐︽埛绉垎姘镐箙瑙ｉ攣鎸囧畾鏂囩珷 |
| `/api/posts` | `POST` | 绠＄悊鍛?| 鍙戝竷鏂板崥鏂?|
| `/api/posts/:id` | `PUT` | 绠＄悊鍛?| 鏇存柊鍗氭枃鍐呭涓庢潈闄愯瀹?|
| `/api/posts/:id` | `DELETE` | 绠＄悊鍛?| 鍒犻櫎鎸囧畾鍗氭枃 |

---

## 涓夈€佺浉鍐屽浘搴撴帴鍙?(`/api/albums`)

| 璺緞 | 鏂规硶 | 鏉冮檺瑕佹眰 | 鎻忚堪 |
| :--- | :--- | :--- | :--- |
| `/api/albums` | `GET` | 鍏紑 | 鑾峰彇鐩稿唽鍒楄〃 |
| `/api/albums/:id` | `GET` | 鏅鸿兘鏉冮檺 | 鑾峰彇鐩稿唽璇︽儏鍙婄収鐗囧垪琛?|
| `/api/albums/:id/unlock` | `POST` | 鐧诲綍鐢ㄦ埛 | 浣跨敤璐︽埛绉垎姘镐箙瑙ｉ攣鐩稿唽 |
| `/api/albums` | `POST` | 绠＄悊鍛?| 鏂板缓鐩稿唽 |
| `/api/albums/:id` | `PUT` | 绠＄悊鍛?| 鏇存柊鐩稿唽淇℃伅 |
| `/api/albums/:id` | `DELETE` | 绠＄悊鍛?| 鍒犻櫎鎸囧畾鐩稿唽 |

---

## 鍥涖€佸姩鎬佹棩璁版帴鍙?(`/api/moments`)

| 璺緞 | 鏂规硶 | 鏉冮檺瑕佹眰 | 鎻忚堪 |
| :--- | :--- | :--- | :--- |
| `/api/moments` | `GET` | 鍏紑 | 鑾峰彇鍔ㄦ€佹棩璁板垪琛?|
| `/api/moments` | `POST` | 绠＄悊鍛?| 鍙戝竷鏂板姩鎬佹棩璁帮紙鏀寔蹇冩儏銆佷綅缃笌鍥剧墖锛?|
| `/api/moments/:id` | `DELETE` | 绠＄悊鍛?| 鍒犻櫎鍔ㄦ€佹棩璁?|

---

## 浜斻€佸弸閾剧敵璇蜂笌绠＄悊 (`/api/friends`)

| 璺緞 | 鏂规硶 | 鏉冮檺瑕佹眰 | 鎻忚堪 |
| :--- | :--- | :--- | :--- |
| `/api/friends` | `GET` | 鍏紑 | 鑾峰彇宸叉壒鍑嗗弸閾惧垪琛?|
| `/api/friends/apply` | `POST` | 鍏紑 | 璁垮鎻愪氦鍙嬮摼鐢宠 |
| `/api/friends/:id` | `PUT` | 绠＄悊鍛?| 鏇存柊鍙嬮摼鎴栨壒鍑嗙姸鎬?(`status: approved`) |
| `/api/friends/:id` | `DELETE` | 绠＄悊鍛?| 鍒犻櫎鍙嬮摼 |

---

## 鍏€佸叏绔欎笌绯荤粺绠＄悊 (`/api/admin`, `/api/config`)

| 璺緞 | 鏂规硶 | 鏉冮檺瑕佹眰 | 鎻忚堪 |
| :--- | :--- | :--- | :--- |
| `/api/admin/stats` | `GET` | 绠＄悊鍛?| 鑾峰彇鍏ㄧ珯姒傝缁熻鏁版嵁 |
| `/api/admin/users` | `GET` | 绠＄悊鍛?| 鍒嗛〉鑾峰彇鎵€鏈夋敞鍐岀敤鎴峰垪琛?|
| `/api/admin/users/:id/points` | `PUT` | 绠＄悊鍛?| 璋冩暣鎸囧畾鐢ㄦ埛鐨勭Н鍒嗕綑棰濓紙鏀寔姝ｈ礋澧炲噺锛?|
| `/api/admin/users/:id/role` | `PUT` | 瓒呯骇绠＄悊鍛?| 鍙樻洿鐢ㄦ埛瑙掕壊 (`superadmin`/`admin`/`user`) |
| `/api/admin/users/:id/status` | `PUT` | 绠＄悊鍛?| 灏佺鎴栬В灏佺敤鎴?|
| `/api/config/site` | `GET` | 鍏紑 | 鑾峰彇鍏ㄧ珯瑙嗚涓庡熀纭€閰嶇疆 |
| `/api/config/site` | `PUT` | 绠＄悊鍛?| 鏇存柊鍏ㄧ珯瑙嗚閰嶇疆 |
| `/api/config/system` | `GET` | 鍏紑 | 鑾峰彇鍏紑绯荤粺閰嶇疆 (Turnstile 寮€鍏崇瓑) |
| `/api/config/system/admin` | `GET` | 绠＄悊鍛?| 鑾峰彇鍖呭惈瀵嗛挜涓庣鍒版ā寮忕殑瀹屾暣閰嶇疆 |
| `/api/config/system` | `PUT` | 绠＄悊鍛?| 淇濆瓨绛惧埌瑙勫垯銆乀urnstile 瀵嗛挜鍙婄湅鏉垮閰嶇疆 |

---

## 涓冦€佹枃浠朵笂浼?(`/api/upload`)

| 璺緞 | 鏂规硶 | 鏉冮檺瑕佹眰 | 鎻忚堪 |
| :--- | :--- | :--- | :--- |
| `/api/upload` | `POST` | 绠＄悊鍛?| 涓婁紶鍥剧墖鍒?Cloudflare R2锛岃繑鍥炲叕寮€璁块棶 URL |

