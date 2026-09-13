# 璐＄尞

鎴戜滑寰堜箰鎰忔帴鍙楁偍瀵硅繖涓」鐩殑琛ヤ竵鍜岃础鐚€傛偍鍙渶閬靛惊涓€浜涘皬鎸囧崡鍗冲彲銆?
## Commit-msg 閽╁瓙

鎴戜滑鍦?`cli/templates/git-commit-msg.sh` 涓湁涓€涓ず渚?commit-msg hook銆傝杩愯浠ヤ笅鍛戒护璁剧疆锛?
```sh
ln -s ../../cli/templates/git-commit-msg.sh ./.git/hooks/commit-msg
```

Windows 涓嬭鐩存帴灏?`commit-msg.sh` 鏂囦欢澶嶅埗鍒?`.git/hooks/commit-msg`銆?
```powershell
cp .\scripts\commit-msg.sh .\.git\hooks\commit-msg
```

杩欏皢鍦ㄦ瘡娆℃彁浜や箣鍓嶈繍琛屼互涓嬫鏌ワ細

1. **绫诲瀷妫€鏌?* - `bun run check` 楠岃瘉鎵€鏈夊寘鐨?TypeScript 绫诲瀷
2. **浠ｇ爜鏍煎紡鍖?* - 妫€鏌ヤ唬鐮佹牸寮忓拰椋庢牸
3. **鎻愪氦娑堟伅鏍煎紡** - 楠岃瘉鎻愪氦娑堟伅鏄惁浠ヤ互涓嬩箣涓€寮€澶达細`feat|chore|fix|docs|ci|style|test|pref`

:::warning 閲嶈鎻愮ず
閽╁瓙杩樹細杩愯娴嬭瘯銆傛彁浜ゅ墠璇风‘淇濇墍鏈夋祴璇曢€氳繃锛?```sh
bun run test
```
:::

濡傛灉鎮ㄦ兂璺宠繃閽╁瓙锛堜笉鎺ㄨ崘锛夛紝璇蜂娇鐢?`--no-verify` 閫夐」杩愯 `git commit`銆?
## 璁剧疆寮€鍙戠幆澧?
1. Fork & Clone 浠撳簱

2. 瀹夎 [Node](https://nodejs.org/en/download/package-manager) & [Bun](https://bun.sh/)

3. 瀹夎渚濊禆椤?    ```sh
    bun i
    ```

4. 鍦?`.env.local` 鏂囦欢涓～鍐欏繀瑕佺殑閰嶇疆

:::tip
閫氬父鎯呭喌涓嬶紝鎮ㄥ彧闇€瑕佸～鍐?`AVATAR`銆乣NAME` 鍜?`DESCRIPTION`銆?濡傞渶閰嶇疆 GitHub OAuth锛岄渶瑕佸垱寤轰竴涓?OAuth App锛屽洖璋冨湴鍧€涓?`http://localhost:11498/api/user/github/callback`
:::

5. 杩愯璁剧疆鑴氭湰鐢熸垚閰嶇疆鏂囦欢
```sh
bun run dev:setup
```

杩欏皢鏍规嵁鎮ㄧ殑 `.env.local` 閰嶇疆鑷姩鐢熸垚 `wrangler.toml` 鍜?`.dev.vars` 鏂囦欢銆?
6. 鎵ц鏁版嵁搴撹縼绉?```sh
bun run db:migrate
```

7.锛堝彲閫夛級閰嶇疆 S3/R2 鐢ㄤ簬鍥剧墖涓婁紶

濡傞渶浣跨敤鍥剧墖涓婁紶鍔熻兘锛岃鍦?`.env.local` 涓～鍐?S3 閰嶇疆锛?- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

8. 鍚姩寮€鍙戞湇鍔″櫒
    ```sh
    bun run dev
    ```

9. 涓轰簡鏇村ソ鍦版帶鍒跺紑鍙戞湇鍔″櫒锛屾偍鍙互鍒嗗埆鍦ㄤ袱涓粓绔腑鍒嗗埆杩愯瀹㈡埛绔笌鏈嶅姟绔殑 dev 鍛戒护锛?    ```sh
    # tty1
    bun run dev:client
    
    # tty2
    bun run dev:server
    ```

## 娴嬭瘯瑕佹眰

鍦ㄦ彁浜?Pull Request 涔嬪墠锛岃纭繚鎵€鏈夋祴璇曢€氳繃锛?
```sh
# 杩愯鎵€鏈夋祴璇?bun run test

# 杩愯绫诲瀷妫€鏌?bun run check

# 杩愯鏍煎紡鍖栨鏌?bun run format:check
```

### 涓烘柊鍔熻兘娣诲姞娴嬭瘯

娣诲姞鏂扮殑 API 绔偣鏃讹細
1. 鍦?`packages/api/src/types.ts` 涓畾涔夌被鍨嬶紙瀹㈡埛绔拰鏈嶅姟绔叡浜級
2. 鍦?`server/src/**/__tests__/*.test.ts` 涓坊鍔犳湇鍔＄娴嬭瘯
3. 濡傛湁闇€瑕侊紝鍦?`client/src/**/__tests__/*.test.ts` 涓坊鍔犲鎴风娴嬭瘯

## 鎻愪氦鏇存敼

1. 瀵逛簬绠€鍗曠殑琛ヤ竵锛屽湪 UTC+8 鏃跺尯鐨勬棩闂撮€氬父 10 鍒嗛挓鍐呭嵆鍙鍏惰繘琛屽鏍搞€?
2. 鍦?PR 鍑嗗濂借繘琛屽鏍稿悗锛屼笉瑕佸己鍒舵帹閫佸皬鐨勬洿鏀广€傝繖鏍峰仛浼氳揩浣跨淮鎶よ€呴噸鏂伴槄璇绘偍鐨勬暣涓?PR锛屼粠鑰屽欢杩熷鏍歌繃绋嬨€?
3. 濮嬬粓淇濇寔 CI 涓虹豢鑹层€?
4. 濡傛灉 CI 鍦ㄦ偍鐨?PR 涓婂け璐ワ紝璇蜂笉瑕佹帹閫併€傚嵆浣挎偍璁や负杩欎笉鏄ˉ涓佺殑閿欒銆傚鏋滃叾浠栧師鍥犵牬鍧忎簡 CI锛岃鍦ㄦ帹閫佷箣鍓嶅府鍔╀慨澶嶆牴鏈師鍥犮€?
*寮€濮嬫剦蹇湴鍐欎唬鐮佸惂锛?

## 浠ｇ爜瀹℃牳
鎵€鏈夋彁浜わ紝鍖呮嫭椤圭洰鎴愬憳鐨勬彁浜わ紝閮介渶瑕佸鏍搞€傛垜浠娇鐢?GitHub 鎷夊彇璇锋眰鏉ュ疄鐜版鐩殑銆傛湁鍏充娇鐢ㄦ媺鍙栬姹傜殑鏇村淇℃伅锛岃鍙傞槄 GitHub 甯姪銆?
