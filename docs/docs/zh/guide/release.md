# 鍙戝竷娴佺▼

鏈枃妗ｆ弿杩颁簡 Shishirinee 椤圭洰鐨勫彂甯冩祦绋嬨€?
## 姒傝堪

Shishirinee 浣跨敤[璇箟鍖栫増鏈帶鍒禲(https://semver.org/lang/zh-CN/)锛屽苟閬靛惊缁撴瀯鍖栫殑鍙戝竷宸ヤ綔娴佷互纭繚绋冲畾鎬у拰涓€鑷存€с€?
**涓昏鐗规€э細**
- 馃 **鑷姩鐢熸垚鍙戝竷璇存槑**锛氫粠甯歌鎻愪氦淇℃伅鐢熸垚
- 馃摑 **璇︾粏鐨勫彉鏇存棩蹇?*锛氬湪 `CHANGELOG.md` 涓淮鎶わ紝鍖呭惈杩佺Щ鎸囧崡
- 鉁?**鑷姩楠岃瘉**锛欳I 妫€鏌ョ増鏈竴鑷存€у苟杩愯娴嬭瘯
- 馃殌 **鑷姩閮ㄧ讲**锛氬湪鐗堟湰鏍囩涓婇儴缃插埌 Cloudflare

## 鐗堟湰鏍煎紡

鐗堟湰閬靛惊 `MAJOR.MINOR.PATCH` 鏍煎紡锛?
- **MAJOR**锛氫笉鍏煎鐨?API 鍙樻洿
- **MINOR**锛氭柊鍔熻兘锛堝悜鍚庡吋瀹癸級
- **PATCH**锛欱ug 淇锛堝悜鍚庡吋瀹癸級

棰勫彂甯冪増鏈彲浠ョ敤杩炲瓧绗︽爣璁帮紝渚嬪 `v1.0.0-beta.1`銆?
## 鎻愪氦淇℃伅瑙勮寖

鎴戜滑閬靛惊 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/) 瑙勮寖銆傝繖浣挎垜浠兘澶熻嚜鍔ㄧ敓鎴愬彂甯冭鏄庛€?
### 蹇€熷弬鑰?
| 绫诲瀷 | 鎻忚堪 | 绀轰緥 |
|------|------|------|
| `feat` | 鏂板姛鑳?| `feat(auth): 娣诲姞 GitHub OAuth` |
| `fix` | Bug 淇 | `fix(api): 瑙ｅ喅 CORS 闂` |
| `docs` | 鏂囨。 | `docs(readme): 鏇存柊鎸囧崡` |
| `refactor` | 浠ｇ爜閲嶆瀯 | `refactor(db): 浼樺寲鏌ヨ` |
| `perf` | 鎬ц兘浼樺寲 | `perf(cache): 娣诲姞 Redis` |
| `chore` | 缁存姢 | `chore(deps): 鏇存柊鍖卄 |

鏇村璇︽儏锛岃鍙傝€僛鎻愪氦瑙勮寖](./commit-convention.md)銆?
## 鍙戝竷宸ヤ綔娴?
### 1. 纭繚鎵€鏈夊彉鏇村凡灏辩华

- [ ] 鎵€鏈夊姛鑳?淇宸插悎骞跺埌 `main`
- [ ] 鎵€鏈夋彁浜ら伒寰猍甯歌鎻愪氦鏍煎紡](./commit-convention.md)
- [ ] 娴嬭瘯閫氳繃锛坄bun run check`銆乣bun run build`锛?
### 2. 杩愯鍙戝竷鑴氭湰

```bash
# 鍗囩骇琛ヤ竵鐗堟湰锛?.1.0 -> 0.1.1锛?bun cli/bin/Shishirinee.ts release patch

# 鍗囩骇娆¤鐗堟湰锛?.1.0 -> 0.2.0锛?bun cli/bin/Shishirinee.ts release minor

# 鍗囩骇涓昏鐗堟湰锛?.1.0 -> 1.0.0锛?bun cli/bin/Shishirinee.ts release major

# 鎴栬缃壒瀹氱増鏈?bun cli/bin/Shishirinee.ts release 1.2.3

# 棰勫彂甯冪増鏈?bun cli/bin/Shishirinee.ts release 0.3.0-rc.1
```

鑴氭湰灏嗭細
1. 鉁?杩愯鍙戝竷鍓嶆鏌ワ紙typecheck銆乥uild銆佺増鏈竴鑷存€э級
2. 馃摑 鏇存柊 workspace 鍐呮墍鏈?`package.json` 鏂囦欢涓殑鐗堟湰
3. 馃敆 涓?`CHANGELOG.md` 杩藉姞 release link
4. 馃彿锔?鍒涘缓 git 鎻愪氦鍜屾爣绛?
**閲嶈**锛氳剼鏈笉浼氭浛浣犳挵鍐?changelog 姝ｆ枃锛涘畠浼氳姹?`CHANGELOG.md` 涓凡缁忓瓨鍦ㄤ笌鐩爣鐗堟湰鍖归厤鐨勭珷鑺傘€?
### 3. 瀹℃煡鍜岀紪杈?CHANGELOG

杩愯鍙戝竷鑴氭湰鍚庯細

```bash
# 鎵撳紑 CHANGELOG.md 骞惰ˉ鍏ㄦ柊鐗堟湰閮ㄥ垎
# 娣诲姞璇︾粏鎻忚堪銆佽縼绉绘寚鍗楃瓑
nano CHANGELOG.md  # 鎴栦娇鐢ㄦ偍鍠滄鐨勭紪杈戝櫒

# 濡傛灉鎮ㄥ仛浜嗘洿鏀癸紝淇敼鎻愪氦
git add CHANGELOG.md
git commit --amend --no-edit
```

### 4. 璇曡繍琛岋紙鍙€夛級

瑕佸湪涓嶅簲鐢ㄦ洿鏀圭殑鎯呭喌涓嬮瑙堬細

```bash
bun cli/bin/Shishirinee.ts release minor --dry-run
```

### 5. 鎺ㄩ€佸彂甯?
```bash
# 鎺ㄩ€佹彁浜?git push origin main

# 鎺ㄩ€佹爣绛撅紙瑙﹀彂鍙戝竷宸ヤ綔娴侊級
git push origin v0.3.0-rc.1
```

### 6. 鑷姩鍙戝竷娴佺▼

涓€鏃︽爣绛捐鎺ㄩ€侊紝GitHub Actions 浼氳嚜鍔細

1. **馃攳 楠岃瘉**锛坄release.yml`锛?   - 楠岃瘉鐗堟湰涓€鑷存€?   - 杩愯 typecheck 鍜?build

2. **馃摑 鍙戝竷璇存槑鐢熸垚**锛坄release.yml`锛?   - 鎸夌被鍨嬪垎绫绘彁浜わ紙鍔熻兘銆佷慨澶嶇瓑锛?   - 浠?CHANGELOG.md 鎻愬彇璇︾粏璇存槑
   - 鍒涘缓鏍煎紡鍖栫殑 GitHub Release
   - 灏?`build-v<version>-cloudflare.tar.gz` 浣滀负 release asset 闄勫姞鍒板彂甯冮〉

3. **馃殌 閮ㄧ讲**锛坄deploy.yml`锛?   - 楠岃瘉閮ㄧ讲鐗堟湰
   - 閮ㄧ讲鍒?Cloudflare Workers
   - 杩愯鏁版嵁搴撹縼绉?
## 鍙戝竷璇存槑缁撴瀯

GitHub Releases 灏嗗寘鍚細

```markdown
## 鍙樻洿鍐呭

**瀹屾暣鍙樻洿鏃ュ織**锛歷0.1.0...v0.2.0

### 馃殌 鍔熻兘
- feat(auth): 娣诲姞 GitHub OAuth 鐧诲綍 (abc1234)
- feat(ui): 瀹炵幇鏆楅粦妯″紡 (def5678)

### 馃悰 Bug 淇
- fix(api): 瑙ｅ喅 CORS 闂 (ghi9012)

### 馃搵 璇︾粏鍙樻洿鏃ュ織
[姝ょ増鏈殑 CHANGELOG.md 鍐呭]

---

## 馃啓 鍗囩骇鎸囧崡
...
```

## 瀵逛簬 Fork 鐢ㄦ埛

### 浣跨敤 release 浜х墿杩涜鎵嬪姩閮ㄧ讲

濡傛灉浣犱笉鎯抽噸鏂板湪鑷繁鐨勪粨搴撻噷鏋勫缓锛屽彲浠ョ洿鎺ヤ娇鐢?GitHub Release 闄勫甫鐨勬瀯寤轰骇鐗╋細

1. 鎵撳紑瀵瑰簲鐗堟湰鐨?GitHub Release 椤甸潰
2. 鍦?Assets 涓壘鍒?`build-v<version>-cloudflare.tar.gz`
3. 澶嶅埗璇ユ枃浠剁殑涓嬭浇閾炬帴
4. 鎵嬪姩瑙﹀彂 `deploy.yml`锛屽皢杩欎釜閾炬帴浣滀负 `artifact_url` 浼犲叆

杩欎釜閾炬帴姝ｆ槸 `deploy.yml` 鐨?`artifact_url` 杈撳叆璁捐瑕佹秷璐圭殑鍐呭銆?
### 閫夐」 1锛氬悓姝?Fork锛堟帹鑽愶級

1. 杞埌鎮ㄥ湪 GitHub 涓婄殑 fork 浠撳簱
2. 鐐瑰嚮 **"Sync fork"** 鎸夐挳
3. 鏌ョ湅 [CHANGELOG.md](./changelog.md) 浜嗚В杩佺Щ姝ラ
4. 濡傛灉闇€瑕侊紝鏇存柊鐜鍙橀噺
5. 濡傛灉宸查厤缃紝閮ㄧ讲灏嗚嚜鍔ㄨ繍琛?
### 閫夐」 2锛氭墜鍔ㄦ洿鏂?
```bash
# 娣诲姞涓婃父杩滅▼
git remote add upstream https://github.com/yiran168/ShiShishirineee.git

# 鑾峰彇鏈€鏂版洿鏀?git fetch upstream

# 鍚堝苟鍒版偍鐨?main 鍒嗘敮
git checkout main
git merge upstream/main

# 鎺ㄩ€佸埌鎮ㄧ殑 fork
git push origin main
```

## 鍙戝竷妫€鏌ユ竻鍗?
鍦ㄥ垱寤哄彂甯冧箣鍓嶏細

- [ ] 鎵€鏈夋祴璇曢€氳繃锛坄bun run check`銆乣bun run build`锛?- [ ] 鎵€鏈夋彁浜ら伒寰父瑙勬牸寮?- [ ] CHANGELOG.md 宸叉彁鍓嶅啓濂藉搴旂増鏈珷鑺?- [ ] 鍖呭惈杩佺Щ鎸囧崡锛堢敤浜庣牬鍧忔€у彉鏇达級
- [ ] 鏂囨。宸叉洿鏂帮紙濡傛灉闇€瑕侊級

鎺ㄩ€佹爣绛惧悗锛?
- [ ] GitHub Release 鎴愬姛鍒涘缓
- [ ] 鍙戝竷璇存槑鐪嬭捣鏉ユ纭?- [ ] 閮ㄧ讲鎴愬姛瀹屾垚

## 绱ф€ュ彂甯?
瀵逛簬闇€瑕佺珛鍗冲彂甯冪殑涓ラ噸 Bug锛?
```bash
# 浠庢渶鏂版爣绛惧垱寤虹儹淇鍒嗘敮
git checkout -b fix/critical-bug v0.2.0

# 搴旂敤淇骞朵娇鐢ㄥ父瑙勬牸寮忔彁浜?git commit -m "fix(api): 瑙ｅ喅涓ラ噸瀹夊叏闂"

# 杩愯鍙戝竷鑴氭湰
bun cli/bin/Shishirinee.ts release patch

# 鎺ㄩ€侊紙鐑慨澶嶄笉闇€瑕佸悎骞跺埌 main锛?git push origin fix/critical-bug
git push origin v0.2.1
```

## 鏁呴殰鎺掗櫎

### 鐗堟湰涓嶅尮閰嶉敊璇?
**闂**锛欳I 鏄剧ず"鐗堟湰涓嶅尮閰?閿欒

**瑙ｅ喅鏂规**锛?1. 纭繚 git 鏍囩涓?`package.json` 鐗堟湰鍖归厤
2. 鍙戝竷鑴氭湰浼氳嚜鍔ㄥ鐞?3. 瀵逛簬鎵嬪姩鍙戝竷锛岀‘淇濓細`git tag v1.0.0` 涓?package.json 涓殑 `"version": "1.0.0"` 鍖归厤

### 绌虹殑鍙戝竷璇存槑

**闂**锛欸itHub Release 娌℃湁鍒楀嚭鍙樻洿

**瑙ｅ喅鏂规**锛?1. 纭繚鎻愪氦閬靛惊甯歌鏍煎紡锛坄feat:`銆乣fix:` 绛夛級
2. 妫€鏌ユ爣绛句箣闂存槸鍚﹀瓨鍦ㄦ彁浜わ細`git log v0.1.0..v0.2.0 --oneline`
3. 闈炲父瑙勬彁浜や笉浼氬嚭鐜板湪鍒嗙被鍒楄〃涓?
### 閮ㄧ讲澶辫触

**闂**锛氬彂甯冨悗閮ㄧ讲澶辫触

**瑙ｅ喅鏂规**锛?1. 妫€鏌?GitHub Actions 鏃ュ織浠ヨ幏鍙栫壒瀹氶敊璇?2. 楠岃瘉鎵€鏈夊繀闇€鐨?secrets 宸查厤缃?3. 妫€鏌?Cloudflare 浠〃鏉夸互鑾峰彇閮ㄧ讲閿欒
4. 濡傛灉闇€瑕侊紝浠?Actions 閫夐」鍗℃墜鍔ㄨЕ鍙戦儴缃?
### CHANGELOG.md 鍐茬獊

**闂**锛欳HANGELOG.md 涓殑鍚堝苟鍐茬獊

**瑙ｅ喅鏂规**锛?1. 淇濈暀涓や釜閮ㄥ垎
2. 鎸夋椂闂撮『搴忛噸鏂版帓鍒楋紙鏈€鏂扮殑鍦ㄥ墠锛?3. 鍒犻櫎閲嶅鏉＄洰

## 鏈€浣冲疄璺?
### 缂栧啓濂界殑鎻愪氦

鉁?**濂界殑**锛?```
feat(auth): 瀹炵幇 JWT 浠ょ墝鍒锋柊

娣诲姞鑷姩浠ょ墝鍒锋柊浠ラ槻姝細璇濊秴鏃躲€?浠ょ墝鍦ㄨ繃鏈熷墠 5 鍒嗛挓鍒锋柊銆?
Closes #123
```

鉂?**涓嶅ソ鐨?*锛?```
update auth stuff
fixed bug
```

### 缁存姢 CHANGELOG

- 鍦ㄥ紑鍙戞湡闂翠繚鎸?[Unreleased] 閮ㄥ垎鏇存柊
- 涓虹牬鍧忔€у彉鏇寸紪鍐欒縼绉绘寚鍗?- 鍦ㄨ縼绉婚儴鍒嗗寘鍚唬鐮佺ず渚?- 閫傚綋鏃惰嚧璋㈣础鐚€?
### 鐗堟湰鍗囩骇

- **Patch** (0.0.1)锛氫粎 Bug 淇
- **Minor** (0.1.0)锛氭柊鍔熻兘锛屽悜鍚庡吋瀹?- **Major** (1.0.0)锛氱牬鍧忔€у彉鏇?
涓嶇‘瀹氭椂锛屽鏂板姛鑳戒娇鐢?**minor**銆?
## 鏈夐棶棰橈紵

- 馃摉 闃呰[鎻愪氦瑙勮寖](./commit-convention.md)浜嗚В鎻愪氦鎸囧崡
- 馃悰 鎶ュ憡闂锛歔GitHub Issues](https://github.com/yiran168/ShiShishirineee/issues)
- 馃挰 鍔犲叆鎴戜滑鐨勭ぞ鍖鸿璁?
