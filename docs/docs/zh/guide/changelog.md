# 鏇存柊鏃ュ織

### v0.3.0 2025-02-04 鏇存柊

#### 鏋舵瀯閲嶆瀯

- **杞婚噺绾ф鏋?*锛氬皢 ElysiaJS 鍚庣妗嗘灦閲嶆瀯涓鸿交閲忕骇鑷畾涔夋鏋讹紝涓撻棬閽堝 Cloudflare Workers 浼樺寲
  - 绉婚櫎浜嗙害 15 涓噸閲忕骇渚濊禆锛屾牳蹇冩鏋朵唬鐮?< 10KB
  - 瀹炵幇浜嗘寜闇€鍔犺浇鏋舵瀯锛屾瘡涓姹傚彧鍒濆鍖栧繀瑕佺殑鏈嶅姟
  - 浼樺寲鐨勫惎鍔ㄦ椂闂村拰鍐呭瓨鍗犵敤

#### 鏂板鍔熻兘

- **缂撳瓨绯荤粺**锛氬疄鐜颁簡鏀寔鏁版嵁搴撳拰 S3 鐨勭伒娲荤紦瀛樼郴缁?  - 鏂板 `CACHE_STORAGE_MODE` 鐜鍙橀噺锛屾敮鎸?`database` 鎴?`s3` 妯″紡
  - 鏀寔缂撳瓨鏁版嵁鐨勮嚜鍔ㄥ簭鍒楀寲鍜屽弽搴忓垪鍖?  - 鏂板缂撳瓨琛ㄧ敤浜庨珮棰戞暟鎹瓨鍌?
- **HyperLogLog 缁熻**锛歅V/UV 缁熻杩佺Щ鍒?HyperLogLog 绠楁硶
  - 浣跨敤 16384 涓瘎瀛樺櫒锛岃宸巼绾?0.81%
  - 鏂板 `visit_stats` 琛紝鍖呭惈 pv 璁℃暟鍣ㄥ拰 hll_data
  - 鏂囩珷缁熻鏌ヨ浠?O(n) 浼樺寲鍒?O(1)
  - 澶у箙鍑忓皯浜嗛珮娴侀噺鏂囩珷鐨勬煡璇㈡椂闂?
- **閿欒澶勭悊绯荤粺**锛氬疄鐜板叏闈㈢殑閿欒澶勭悊鏈哄埗
  - 鏂板缁撴瀯鍖栭敊璇被锛圴alidationError, NotFoundError 绛夛級
  - 瀹炵幇 `GlobalErrorBoundary` 鎹曡幏 React 娓叉煋閿欒
  - 鏂板 `useError` hooks 澶勭悊寮傛鎿嶄綔鍜?API 璋冪敤
  - 鏈嶅姟鍣ㄧ涓棿浠惰褰曢敊璇苟鐢熸垚璇锋眰 ID

- **Cookie 璁よ瘉**锛氫粠 Authorization Header 杩佺Щ鍒?Cookie-based 璁よ瘉
  - 鍚庣璁剧疆 HttpOnly銆丼ecure銆丼ameSite=lax 鐨?Cookie
  - 鍓嶇绉婚櫎 Authorization Header锛屼緷璧栨祻瑙堝櫒 Cookie
  - 澧炲己 CSRF 闃叉姢

#### 鏀硅繘鍜屼紭鍖?
- **API 瀹㈡埛绔噸鏋?*锛氱敤鑷畾涔?API 瀹㈡埛绔浛鎹?Elysia/Eden
  - 绉婚櫎 @elysiajs/eden 鍜?Shishirinee-server 渚濊禆
  - 鍒涘缓绫诲瀷瀹夊叏鐨?API 瀹㈡埛绔?  - 绠€鍖?API 璋冪敤鏂瑰紡锛堜粠 treaty 妯″紡鏀逛负鐩存帴鏂规硶璋冪敤锛?  - **鐮村潖鎬у彉鏇?*锛氬鎴风 API 鎺ュ彛鍙樻洿锛屼緥濡?`client.feed.index.get()` 鈫?`client.feed.list()`

- **OAuth 鑷畾涔夊疄鐜?*锛氱敤鑷畾涔?OAuth2 瀹炵幇鏇挎崲 elysia-oauth2
  - 閫氱敤 OAuth2 鎻掍欢鏋舵瀯锛屾敮鎸佷换浣?OAuth2 鎻愪緵鍟?  - 鍐呯疆 GitHub OAuth 鎻愪緵鍟嗕綔涓洪粯璁?  - 閫氳繃 state 鍙傛暟楠岃瘉鎻愪緵 CSRF 淇濇姢
  - TypeScript 鍏ㄧ被鍨嬫敮鎸?
- **渚濊禆娉ㄥ叆閲嶆瀯**锛氱敤鍘熺敓鏈哄埗鏇挎崲 typedi
  - 绉婚櫎 typedi 渚濊禆娉ㄥ叆瀹瑰櫒
  - 浣跨敤 Elysia 鐨?decorate() 鍜?derive() 杩涜渚濊禆娉ㄥ叆
  - 鏈嶅姟閫氳繃 store 璁块棶渚濊禆鑰岄潪 Container.get()

- **鍙嬮摼绯荤粺浼樺寲**锛氭洿鏂?Friend 鎺ュ彛骞惰皟鏁寸浉鍏?API 璋冪敤
  - 鏀硅繘绫诲瀷瀹夊叏鎬?
#### 淇

- 淇 uv 杩佺Щ鍒?hll 澶辫触鐨勯棶棰?- 淇 GitHub 鍥炶皟璺敱鐨?schema 楠岃瘉闂
- 淇鏌ヨ鍙傛暟鏁存暟瑙ｆ瀽闂
- 淇 CORS 棰勬璇锋眰澶勭悊闂
- 浼樺寲浠ｇ爜骞剁簿绠€浣撶Н

#### 鏁版嵁搴撹縼绉?
- 鏂板缂撳瓨琛?`cache`锛坘ey, type, data, created_at, updated_at锛?- 鏂板璁块棶缁熻琛?`visit_stats`锛坒eed_id, pv, hll_data锛?- 鏁版嵁搴撹縼绉昏剼鏈細`0006.sql`

#### 鐜鍙橀噺

鏂板鐜鍙橀噺锛?```ini
CACHE_STORAGE_MODE=<缂撳瓨瀛樺偍妯″紡锛歞atabase 鎴?s3锛岄粯璁?database>
```

### v0.2.0 2024-06-07 鏇存柊

- 鏂板 `S3_CACHE_FOLDER` 鐜鍙橀噺
- 鐜鍙橀噺鍔犲瘑鍒楄〃涓庡彉閲忓垪琛ㄦ洿鏂帮紝浠呬繚鐣欏繀椤诲姞瀵嗙殑鐜鍙橀噺
- 鍔犲瘑鍙橀噺鐜板湪鍙互閫氳繃 GitHub 鐩存帴閰嶇疆
- GitHub 鍙橀噺閰嶇疆鏇存柊锛屾柊澧炲繀椤婚€氳繃 GitHub 閰嶇疆鐨勫姞瀵嗗彉閲忥紙S3 瀛樺偍锛岀敤浜?SEO 绱㈠紩淇濆瓨锛?- `GITHUB_CLIENT_ID`涓巂GITHUB_CLIENT_SECRET`鐜板湪娣诲姞浜嗗墠缂€`Shishirinee_`锛坄Shishirinee_GITHUB_CLIENT_ID`,`Shishirinee_GITHUB_CLIENT_SECRET`锛夛紝浠ヨВ鍐?GitHub 鍙橀噺涓嶈兘浠?`GITHUB_` 寮€澶寸殑闂锛屼娇鐢?Cloudflare 闈㈡澘閰嶇疆鐨?`GITHUB_CLIENT_ID` 涓?`GITHUB_CLIENT_SECRET` 涓嶅彈褰卞搷

## 杩佺Щ鎸囧崡

鏃犵壒鍒鏄庢椂姝ｅ父鐨勭増鏈洿鏂扮洿鎺ュ悓姝?fork 鐨勪粨搴撳嵆鍙?
### v0.2.0 杩佺Щ鎸囧崡


```ini
SEO_BASE_URL=<SEO 鍩虹鍦板潃锛岀敤浜?SEO 绱㈠紩>
SEO_CONTAINS_KEY=<SEO 绱㈠紩鏃跺彧绱㈠紩浠?SEO_BASE_URL 寮€澶存垨鍖呭惈SEO_CONTAINS_KEY 鍏抽敭瀛楃殑閾炬帴锛岄粯璁や负绌?
S3_FOLDER=<S3 鍥剧墖璧勬簮瀛樺偍鐨勬枃浠跺す锛岄粯璁や负 'images/'>
S3_CACHE_FOLDER=<S3 缂撳瓨鏂囦欢澶癸紙鐢ㄤ簬 SEO銆侀珮棰戣姹傜紦瀛橈級锛岄粯璁や负 'cache/'>
S3_BUCKET=<S3 瀛樺偍妗跺悕绉?
S3_REGION=<S3 瀛樺偍妗舵墍鍦ㄥ尯鍩燂紝濡備娇鐢?Cloudflare R2 濉啓 auto 鍗冲彲>
S3_ENDPOINT=<S3 瀛樺偍妗舵帴鍏ョ偣鍦板潃>
S3_ACCESS_HOST=<S3 瀛樺偍妗惰闂湴鍧€锛屾湯灏炬棤'/'>
```

鍚屾椂娣诲姞浠ヤ笅鍔犲瘑鐜鍙橀噺锛堝姞瀵嗭紝娣诲姞鍒?Secrets锛夛細

```ini
S3_ACCESS_KEY_ID=<浣犵殑S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<浣犵殑S3SecretAccessKey>
```

浠ヤ笂鐜鍙橀噺鍦ㄤ箣鍓嶇殑鐗堟湰涓槸閫氳繃 Cloudflare 闈㈡澘閰嶇疆鐨勶紝鐜板湪闇€瑕佽縼绉诲埌 GitHub 涓厤缃紝鏂扮増鏈殑閮ㄧ讲 GitHub Action 浼氳嚜鍔ㄥ叾涓婁紶鍒?Cloudflare锛屼箣鍚庡氨涓嶅啀闇€瑕佸湪 Cloudflare 闈㈡澘涓厤缃繖浜涚幆澧冨彉閲忎簡

