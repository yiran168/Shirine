# 鎻愪氦瑙勮寖

鏈枃妗ｆ弿杩颁簡 Shishirinee 椤圭洰鐨勬彁浜や俊鎭鑼冦€傞伒寰繖浜涜鑼冨彲浠ヨ鎴戜滑鑷姩鐢熸垚鍙樻洿鏃ュ織鍜屽彂甯冭鏄庛€?
## 鏍煎紡

姣忎釜鎻愪氦淇℃伅搴旈伒寰互涓嬫牸寮忥細

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

## 绫诲瀷

| 绫诲瀷 | 鎻忚堪 | 绀轰緥 |
|------|------|------|
| `feat` | 鏂板姛鑳?| `feat(auth): 娣诲姞 GitHub OAuth 鐧诲綍` |
| `fix` | Bug 淇 | `fix(api): 瑙ｅ喅 CORS 闂` |
| `docs` | 鏂囨。鍙樻洿 | `docs(readme): 鏇存柊閮ㄧ讲鎸囧崡` |
| `style` | 浠ｇ爜鏍煎紡鍙樻洿锛堟牸寮忓寲銆佸垎鍙风瓑锛?| `style: 浣跨敤 prettier 鏍煎紡鍖朻 |
| `refactor` | 浠ｇ爜閲嶆瀯 | `refactor(db): 浼樺寲鏌ヨ鎬ц兘` |
| `perf` | 鎬ц兘浼樺寲 | `perf(cache): 瀹炵幇 Redis 缂撳瓨` |
| `test` | 娣诲姞鎴栨洿鏂版祴璇?| `test(api): 娣诲姞鐢ㄦ埛璁よ瘉娴嬭瘯` |
| `chore` | 鏋勫缓杩囩▼鎴栬緟鍔╁伐鍏峰彉鏇?| `chore(deps): 鏇存柊渚濊禆` |
| `ci` | CI/CD 鍙樻洿 | `ci: 娣诲姞鍙戝竷宸ヤ綔娴乣 |
| `revert` | 鍥為€€鏇存敼 | `revert: 鎾ら攢鐮村潖鎬у彉鏇碻 |

## 浣滅敤鍩?
浣滅敤鍩熸槸鍙€夌殑锛屽簲鎸囩ず鍙楀奖鍝嶇殑浠ｇ爜鍖哄煙锛?
- `api` - 鍚庣 API 鍙樻洿
- `client` - 鍓嶇/瀹㈡埛绔彉鏇?- `db` - 鏁版嵁搴撳彉鏇?- `auth` - 璁よ瘉鐩稿叧
- `ui` - UI 缁勪欢
- `deps` - 渚濊禆椤?- `config` - 閰嶇疆鏂囦欢
- `docs` - 鏂囨。
- `release` - 鍙戝竷鐩稿叧

## 涓婚

- 浣跨敤绁堜娇璇皵锛?娣诲姞"鑰屼笉鏄?娣诲姞浜?鎴?娣诲姞"锛?- 棣栧瓧姣嶄笉澶у啓
- 鏈熬涓嶅姞鍙ュ彿
- 鏈€澶?50 涓瓧绗?
**濂界殑绀轰緥锛?*
- `feat(auth): 娣诲姞瀵嗙爜閲嶇疆鍔熻兘`
- `fix(api): 澶勭悊鏁版嵁搴撶┖鍝嶅簲`
- `docs(readme): 鏇存柊瀹夎璇存槑`

**涓嶅ソ鐨勭ず渚嬶細**
- `feat: Added new feature`锛堣繃鍘绘椂鎬侊紝棣栧瓧姣嶅ぇ鍐欙級
- `fix: fixed the bug.`锛堣繃鍘绘椂鎬侊紝鏈熬鏈夊彞鍙凤級
- `update stuff`锛堟棤绫诲瀷锛屾弿杩版ā绯婏級

## 姝ｆ枃

- 浣跨敤绁堜娇璇皵
- 姣忚 72 涓瓧绗﹀鎹㈣
- 瑙ｉ噴**鍋氫簡浠€涔?*鍜?*涓轰粈涔?*锛岃€屼笉鏄?*鎬庝箞鍋?*
- 涓庝富棰樹箣闂寸敤绌鸿鍒嗛殧

绀轰緥锛?```
feat(auth): 瀹炵幇 JWT 浠ょ墝鍒锋柊

娣诲姞鑷姩浠ょ墝鍒锋柊鏈哄埗浠ラ槻姝㈢敤鎴锋剰澶栭€€鍑虹櫥褰曘€?浠ょ墝鐜板湪浼氬湪杩囨湡鍓?5 鍒嗛挓鍒锋柊銆?
杩欓€氳繃鏃犵紳缁存姢浼氳瘽鏉ユ敼鍠勭敤鎴蜂綋楠屻€?```

## 椤佃剼

- 寮曠敤 Issue 鍜?PR锛歚Closes #123`銆乣Fixes #456`
- 鐮村潖鎬у彉鏇达細`BREAKING CHANGE: 鎻忚堪`

绀轰緥锛?```
feat(api): 鏇存敼鐢ㄦ埛绔偣鐨勫搷搴旀牸寮?
BREAKING CHANGE: 鐢ㄦ埛绔偣鐜板湪灏嗙敤鎴锋暟鎹寘瑁呭湪
`data` 瀛楁涓繑鍥烇紝鑰屼笉鏄洿鎺ヨ繑鍥炪€傝鐩稿簲鏇存柊
鎮ㄧ殑瀹㈡埛绔唬鐮併€?
Closes #789
```

## 绀轰緥

### 鍔熻兘
```
feat(articles): 娣诲姞甯﹂瑙堢殑 Markdown 缂栬緫鍣?
浣跨敤 Monaco Editor 瀹炵幇鍒嗗睆 Markdown 缂栬緫鍣紝鏀寔
瀹炴椂棰勮銆傛敮鎸佽娉曢珮浜拰鍥剧墖涓婁紶銆?
Closes #234
```

### Bug 淇
```
fix(ui): 瑙ｅ喅绉诲姩绔鑸彍鍗曢噸鍙犻棶棰?
瀵艰埅鑿滃崟鍦ㄥ皬浜?768px 鐨勫睆骞曚笂涓庡唴瀹归噸鍙犮€?璋冩暣 z-index 鍜屽畾浣嶄互瑙ｅ喅璇ラ棶棰樸€?
Fixes #567
```

### 鏂囨。
```
docs(deploy): 娣诲姞 Cloudflare 璁剧疆鎸囧崡

涓烘柊鐨勯儴缃叉坊鍔?Cloudflare Workers銆丏1
鏁版嵁搴撳拰 R2 瀛樺偍鐨勭患鍚堟寚鍗椼€?```

### 鐮村潖鎬у彉鏇?```
feat(auth): 杩佺Щ鍒版柊鐨?OAuth 鎻愪緵鍟?
BREAKING CHANGE: GitHub OAuth 瀹炵幇宸茶鏇挎崲
涓洪€氱敤 OAuth2 鎻愪緵鍟嗐€傜幆澧冨彉閲忓凡鏇存敼锛?- GITHUB_CLIENT_ID 鈫?OAUTH_CLIENT_ID
- GITHUB_CLIENT_SECRET 鈫?OAUTH_CLIENT_SECRET

杩佺Щ鎸囧崡锛歨ttps://docs.example.com/migration/v2
```

## 鎻愪氦淇℃伅妫€鏌?
鎴戜滑寤鸿浣跨敤 commitlint 鏉ュ己鍒舵墽琛岃繖浜涜鑼冿細

```bash
# 瀹夎 commitlint
npm install --save-dev @commitlint/config-conventional @commitlint/cli

# 鍒涘缓 commitlint.config.js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

## 涓轰粈涔堬紵

- **鑷姩鐢熸垚鍙樻洿鏃ュ織**锛氬彲浠ヨ嚜鍔ㄧ敓鎴愬彂甯冭鏄?- **娓呮櫚鐨勫巻鍙茶褰?*锛氭槗浜庣悊瑙ｅ彂鐢熶簡浠€涔堝彉鏇翠互鍙婁负浠€涔?- **璇箟鍖栫増鏈帶鍒?*锛氬府鍔╃‘瀹氱増鏈崌绾э紙feat=minor锛宖ix=patch锛宐reaking=major锛?- **鏇村ソ鐨勫崗浣?*锛氫竴鑷寸殑鏍煎紡浣夸唬鐮佸鏌ユ洿瀹规槗

## 宸ュ叿

- **Commitizen**锛氫氦浜掑紡鎻愪氦淇℃伅鏋勫缓鍣?  ```bash
  npm install -g commitizen
  git cz  # 鏇夸唬 git commit
  ```

- **VS Code 鎵╁睍**锛?Conventional Commits" 鐢ㄤ簬鑷姩瀹屾垚

## 鏈夐棶棰橈紵

濡傛灉鎮ㄤ笉纭畾鎻愪氦绫诲瀷鎴栨牸寮忥紝璇峰湪鎮ㄧ殑 PR 涓闂垨鍙傝€冧粨搴撲腑鐜版湁鐨勬彁浜ゃ€?
