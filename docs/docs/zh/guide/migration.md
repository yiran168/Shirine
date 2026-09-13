# Shishirinee 杩佺Щ鎸囧崡 (v0.3.0)

鏈寚鍗楀府鍔╃幇鏈?Shishirinee 鐢ㄦ埛杩佺Щ鍒版渶鏂扮増鏈€?
## 鍙樻洿姒傝

v0.3.0 鐗堟湰鍖呭惈閲嶅ぇ鐨勬灦鏋勫彉鏇达細

1. **妗嗘灦杩佺Щ**: 鐢ㄨ嚜瀹氫箟杞婚噺绾ф鏋舵浛浠?ElysiaJS
2. **API 鍙樻洿**: 鏂扮殑 API 瀹㈡埛绔帴鍙?3. **鐧诲綍鏂瑰紡**: 鏂板璐﹀彿瀵嗙爜鐧诲綍鏀寔
4. **OAuth 鍙樻洿**: GitHub OAuth 鍙橀噺鍚嶆洿鏂?5. **鎬ц兘鎻愬崌**: 鏄捐憲鐨勬€ц兘鏀硅繘

## 杩佺Щ姝ラ

### 绗竴姝ワ細鍚屾 Fork

1. 杩涘叆鎮ㄥ湪 GitHub 涓?fork 鐨勪粨搴?2. 鐐瑰嚮 **"Sync fork"** 鎸夐挳
3. 鐐瑰嚮 **"Update branch"** 鍚堝苟鍙樻洿

### 绗簩姝ワ細鏇存柊鐜鍙橀噺

#### 蹇呴渶鍙樻洿

**GitHub OAuth 鍙橀噺锛堝鏋滀娇鐢?GitHub 鐧诲綍锛?*

鏃у彉閲忓悕宸插純鐢細

```
GITHUB_CLIENT_ID      鈫?Shishirinee_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET  鈫?Shishirinee_GITHUB_CLIENT_SECRET
```

**鎿嶄綔姝ラ**锛?1. 杩涘叆 Settings 鈫?Secrets and variables 鈫?Actions
2. 娣诲姞甯?`Shishirinee_` 鍓嶇紑鐨勬柊 Secrets
3. 锛堝彲閫夛級鍒犻櫎鏃?Secrets

#### 鍙€夛細娣诲姞璐﹀彿瀵嗙爜鐧诲綍

濡傛灉鎮ㄦ洿鍠滄绠€鍗曠殑璐﹀彿瀵嗙爜鐧诲綍鑰岄潪 GitHub OAuth锛?
1. 娣诲姞浠ヤ笅 Secrets锛?   - `ADMIN_USERNAME`: 鎮ㄦ兂瑕佺殑鐢ㄦ埛鍚?   - `ADMIN_PASSWORD`: 鎮ㄦ兂瑕佺殑瀵嗙爜

### 绗笁姝ワ細绉婚櫎 Pages锛堝彲閫変絾鎺ㄨ崘锛?
鑷?0.3.0 寮€濮嬶紝Shishirinee 鏀逛负浣跨敤 Workers 鎵樼闈欐€佽祫婧愶紝涓嶅啀渚濊禆 Cloudflare Pages銆傚缓璁寜浠ヤ笅姝ラ杩佺Щ锛?
1. **瑙ｇ粦 Pages 鍩熷悕**
   - 杩涘叆 Cloudflare Dashboard 鈫?Pages
   - 閫夋嫨鎮ㄧ殑 Pages 椤圭洰 鈫?鑷畾涔夊煙
   - 鍒犻櫎缁戝畾鐨勫煙鍚?
2. **灏嗗煙鍚嶇粦瀹氬埌 Worker**
   - 杩涘叆 Cloudflare Dashboard 鈫?Workers & Pages
   - 閫夋嫨鎮ㄧ殑 Worker (`Shishirinee-server`)
   - 鐐瑰嚮"瑙﹀彂鍣? 鈫?"娣诲姞鑷畾涔夊煙"
   - 杈撳叆鎮ㄧ殑鍩熷悕骞朵繚瀛?
3. **娓呯悊澶氫綑鐨勫煙鍚嶇粦瀹?*
   - 妫€鏌?Worker 鐨勮嚜瀹氫箟鍩熷垪琛?   - 鍒犻櫎涓嶉渶瑕佺殑缁戝畾锛堝 `seo/*`銆乣sub/*` 绛夛級

4. **鏇存柊 GitHub OAuth Callback**
   - 杩涘叆 GitHub 鈫?Settings 鈫?Developer settings 鈫?OAuth Apps
   - 鎵惧埌鎮ㄧ殑 OAuth App
   - 灏?Authorization callback URL 浠庯細
     - `https://<worker-domain>/user/github/callback`
   - 淇敼涓猴細
     - `https://<your-domain>/api/user/github/callback`

### 绗洓姝ワ細鏇存柊 Cloudflare API Key 鏉冮檺

纭繚鎮ㄧ殑 Cloudflare API Token 鍏锋湁浠ヤ笅鏉冮檺锛?- **D1**:Edit
- **Workers R2 瀛樺偍**:Edit (濡傛灉浣跨敤 R2 瀛樺偍)
- **Workers 鑴氭湰**:Edit

![1000000663](/cloudflare-api-key-cn.png)


### 绗簲姝ワ細閲嶅懡鍚嶅垎鏀悕


1. 鑻ュ厛鍓?fork 浠撳簱鐨勫垎鏀负 `dev`锛岄渶鎵嬪姩閲嶅懡鍚嶄负 `main` 鎴?`master`


### 绗叚姝ワ細閮ㄧ讲

1. 杩涘叆浠撳簱鐨?Actions 鏍囩
2. 閫夋嫨 **"Build"** 宸ヤ綔娴?3. 鐐瑰嚮 **"Run workflow"**
4. 鍦ㄦ瀯寤烘垚鍔熷悗浼氳嚜鍔ㄨЕ鍙?`Deploy` 宸ヤ綔娴佽嚜鍔ㄩ儴缃插埌 workers

### 绗竷姝ワ細楠岃瘉閮ㄧ讲

1. 璁块棶鎮ㄧ殑鍓嶇 URL
2. 娴嬭瘯鐧诲綍鍔熻兘
3. 妫€鏌ョ幇鏈夋枃绔犳槸鍚﹀彲璁块棶
4. 楠岃瘉鍥剧墖鏄惁姝ｇ‘鍔犺浇

## 鐮村潖鎬у彉鏇存眹鎬?
### API 瀹㈡埛绔帴鍙?
**鏃т唬鐮?*锛堜笉鍐嶆敮鎸侊級锛?```typescript
const feeds = await client.feed.index.get({ query: { page: 1 } });
```

**鏂颁唬鐮?*锛?```typescript
const feeds = await client.feed.list({ page: 1 });
```

濡傛灉鎮ㄦ湁浣跨敤鏃?API 鐨勮嚜瀹氫箟鍓嶇浠ｇ爜锛岃鐩稿簲鏇存柊銆?
### 璁よ瘉娴佺▼

- **鏃?*: 鍚庣閲嶅畾鍚戝埌鍓嶇 callback URL
- **鏂?*: 鐙珛鐨?`/login` 椤甸潰锛屼笓鐢ㄧ櫥褰曟祦绋?
### 鐜鍙橀噺鍙樺寲

| 鏃у悕绉?| 鏂板悕绉?| 蹇呴渶 |
|--------|--------|------|
| `GITHUB_CLIENT_ID` | `Shishirinee_GITHUB_CLIENT_ID` | 鍙€? |
| `GITHUB_CLIENT_SECRET` | `Shishirinee_GITHUB_CLIENT_SECRET` | 鍙€? |
| - | `ADMIN_USERNAME` | 鍙€? |
| - | `ADMIN_PASSWORD` | 鍙€? |

*蹇呴』閰嶇疆鑷冲皯涓€绉嶇櫥褰曟柟寮?
## 杩佺Щ鍚?
### 灏濊瘯鏂板姛鑳?
1. **涓汉璧勬枡绠＄悊**: 璁块棶 `/profile` 鏇存柊澶村儚鍜岀敤鎴峰悕
2. **鎬ц兘鎻愬崌**: 浣撻獙鏇村揩鐨勫喎鍚姩鍜屾洿浣庣殑 CPU 浣跨敤鐜?3. **鏇村ソ鐨勭櫥褰曚綋楠?*: 鏂扮殑鐙珛鐧诲綍椤甸潰锛屾敼杩涚劍鐐瑰鐞?
### 娓呯悊锛堝彲閫夛級

鎴愬姛杩佺Щ鍚庯紝鎮ㄥ彲浠ワ細

1. 鍒犻櫎宸插純鐢ㄧ殑鐜鍙橀噺
2. 濡備笉鍐嶉渶瑕侊紝鍒犻櫎鏃х殑棰勮閮ㄧ讲
3. 鏇存柊鑷畾涔夎剼鏈互浣跨敤鏂扮殑 API 鎺ュ彛

## 鏁呴殰鎺掗櫎

### "鐗堟湰涓嶅尮閰? 閿欒

**瑙ｅ喅鏂规**: 纭繚 git 鏍囩涓?package.json 鐗堟湰鍖归厤銆傚悓姝ュ簲璇ヤ細鑷姩澶勭悊銆?
### "鏃犳硶鐧诲綍"

**瑙ｅ喅鏂规**锛?1. 楠岃瘉鑷冲皯閰嶇疆浜嗕竴绉嶇櫥褰曟柟寮忥紙GitHub OAuth 鎴?璐﹀彿瀵嗙爜锛?2. 妫€鏌?Secrets 鏄惁姝ｇ‘璁剧疆
3. 灏濊瘯娓呴櫎娴忚鍣ㄧ紦瀛?
### "鍥剧墖鏃犳硶鍔犺浇"

**瑙ｅ喅鏂规**锛?1. 妫€鏌?S3/R2 閰嶇疆
2. 楠岃瘉 `S3_ACCESS_HOST` 鏄惁姝ｇ‘璁剧疆
3. 妫€鏌?R2 瀛樺偍妗舵潈闄?
## 鍥炴粴锛堝闇€瑕侊級

濡傛灉杩佺Щ澶辫触闇€瑕佸洖婊氾細

1. 鎭㈠涔嬪墠鐨?git 鏍囩锛歚git checkout v0.2.x`
2. 寮哄埗鎺ㄩ€佸埌 main锛堚殸锔?鐮村潖鎬э級锛歚git push origin HEAD:main --force`
3. 浠?Actions 閲嶆柊閮ㄧ讲

## 闇€瑕佸府鍔╋紵

- 馃摉 [瀹屾暣鏂囨。](https://Shishirinee-docs.xeu.life)
- 馃悰 [GitHub Issues](https://github.com/yiran168/ShiShishirineee/issues)
- 馃挰 [GitHub Discussions](https://github.com/yiran168/ShiShishirineee/discussions)

---

*鏈€鍚庢洿鏂帮細2025-02-08*

