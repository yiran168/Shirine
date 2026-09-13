# Webhook 鎸囧崡

Shishirinee 鍙互鍦ㄤ互涓嬪満鏅悜鑷畾涔?webhook 鍙戦€侀€氱煡锛?
- 鏈夋柊璇勮鏃?- 鏈夋柊鐨勫弸閾剧敵璇锋椂

浣犲彲浠ョ敤瀹冩妸 Shishirinee 鎺ュ埌 Discord銆乀elegram Bot銆丼lack 缃戝叧銆侀涔︺€侀拤閽夈€乶8n銆乑apier锛屾垨鑰呬綘鑷繁鐨?HTTP 鏈嶅姟銆?
## 鍦ㄥ摢閲岄厤缃?
閮ㄧ讲瀹屾垚鍚庯紝杩涘叆鍚庡彴 **璁剧疆** 椤甸潰锛屾壘鍒?**Webhook** 閰嶇疆鍖恒€?
浣犱篃鍙互閫氳繃 `WEBHOOK_URL` 鐜鍙橀噺鎻愪緵涓€涓垵濮嬮粯璁ゅ€硷紝浣嗘洿鎺ㄨ崘鍦ㄨ缃〉閲岀粺涓€绠＄悊 webhook 琛屼负銆?
## 鏀寔鐨勯厤缃」

Shishirinee 褰撳墠鏀寔浠ヤ笅 webhook 閰嶇疆锛?
- `Webhook URL`锛氱洰鏍囧湴鍧€銆傝繖閲屼篃鏀寔妯℃澘鍙橀噺锛屽挨鍏堕€傚悎 GET 鍦烘櫙鎷兼帴 query stShishirineeg銆?- `Webhook Method`锛歚GET`銆乣POST`銆乣PUT`銆乣PATCH`銆乣DELETE`銆乣HEAD`銆乣OPTIONS`
- `Webhook Content-Type`锛氫緥濡?`application/json`銆乣text/plain`
- `Webhook Headers`锛氱敤浜庤嚜瀹氫箟璇锋眰澶寸殑 JSON 妯℃澘
- `Webhook Body Template`锛氶潪 GET 璇锋眰浣跨敤鐨勮姹備綋妯℃澘
- `鍙戦€佹祴璇?Webhook`锛氫娇鐢ㄥ綋鍓嶉〉闈笂鐨勫€煎彂閫佷竴娆℃祴璇曡姹傦紝鏈繚瀛樼殑淇敼涔熶細鐢熸晥

## 妯℃澘鍙橀噺

浣犲彲浠ュ湪 webhook URL銆佽姹傚ご鍜岃姹備綋妯℃澘涓娇鐢ㄨ繖浜涘彉閲忥細

- `{{event}}`
- `{{message}}`
- `{{title}}`
- `{{url}}`
- `{{username}}`
- `{{content}}`
- `{{description}}`

## 榛樿琛屼负

濡傛灉浣犲彧閰嶇疆浜?`Webhook URL`锛孯in 榛樿浼氫娇鐢細

- Method锛歚POST`
- Content-Type锛歚application/json`
- Headers锛歚{}`
- Body锛?
```json
{"content":"{{message}}"}
```

## GET 绀轰緥

濡傛灉浣犵殑 webhook 鏈嶅姟甯屾湜閫氳繃 query 鍙傛暟鎺ユ敹鍐呭锛屽彲浠ョ洿鎺ュ湪 URL 涓啓妯℃澘鍙橀噺锛?
```text
https://example.com/webhook?event={{event}}&message={{message}}&title={{title}}
```

鎺ㄨ崘閰嶇疆锛?
- Method锛歚GET`
- Body Template锛氫繚鎸侀粯璁ゆ垨蹇界暐

Shishirinee 浼氬 GET 椋庢牸 URL 涓殑鏌ヨ鍙傛暟鍊艰繘琛?URL 缂栫爜銆?
## JSON POST 绀轰緥

濡傛灉浣犵殑鏈嶅姟鎺ユ敹 JSON锛屽彲浠ヨ繖鏍烽厤缃細

**Webhook URL**

```text
https://example.com/webhook
```

**Webhook Headers**

```json
{
  "X-Shishirinee-Event": "{{event}}"
}
```

**Webhook Body Template**

```json
{
  "event": "{{event}}",
  "message": "{{message}}",
  "title": "{{title}}",
  "url": "{{url}}",
  "username": "{{username}}",
  "content": "{{content}}",
  "description": "{{description}}"
}
```

## 璇存槑

- `GET` 鍜?`HEAD` 璇锋眰涓嶄細鍙戦€佽姹備綋銆?- webhook URL 涓殑妯℃澘鍙橀噺鍦ㄦ浛鎹㈠墠浼氬厛杩涜 URL 缂栫爜銆?- `Webhook Headers` 鍦ㄦā鏉挎覆鏌撳悗蹇呴』浠嶇劧鏄悎娉?JSON銆?- 濡傛灉 `Webhook Headers` 鎴?`Webhook Body Template` 鏈韩鏄悎娉?JSON锛孯in 浼氭寜 JSON 瀛楃涓茶鍒欒浆涔夋彃鍏ュ€硷紝閬垮厤鐮村潖 JSON 缁撴瀯銆?- 濡傛灉璇锋眰浣撴ā鏉夸笉鏄悎娉?JSON锛孯in 浼氫繚鎸佸師鏈夌殑绾枃鏈浛鎹㈣涓恒€?- 鍦ㄦ寮忎繚瀛樺墠锛屽缓璁厛鐢ㄢ€滃彂閫佹祴璇?Webhook鈥濋獙璇佷竴娆°€?
## 甯歌闂

### 娴嬭瘯 webhook 鏃舵姤 JSON 閿欒

璇存槑 `Webhook Headers` 鍦ㄦā鏉挎覆鏌撳悗涓嶆槸鍚堟硶 JSON銆傝妫€鏌ラ€楀彿銆佸紩鍙峰拰鎷彿鏄惁姝ｇ‘銆?
### 璇锋眰鍙戝嚭鍘讳簡锛屼絾鏈嶅姟绔嫆缁濅簡

璇烽噸鐐规鏌ワ細

- HTTP Method
- `Content-Type`
- 璁よ瘉璇锋眰澶?- JSON 瀛楁鍚嶆槸鍚︾鍚堝鏂硅姹?- 瀵规柟鎺ュ彛鏄帴鏀?GET query 鍙傛暟锛岃繕鏄彧鎺ユ敹 POST body

### 鎴戝彧鎯虫敹鍒颁竴鏉＄畝鍗曟秷鎭?
淇濇寔榛樿閰嶇疆锛屽彧濉啓 `Webhook URL` 鍗冲彲銆俁in 浼氬彂閫侊細

```json
{"content":"<message>"}
```

