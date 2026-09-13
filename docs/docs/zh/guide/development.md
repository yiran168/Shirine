# ShiShishirineee 鏈湴寮€鍙戞寚鍗?
鏈枃妗ｄ粙缁嶅浣曞湪鏈湴寮€鍙戝拰璋冭瘯 ShiShishirineee 椤圭洰銆?
## 蹇€熷紑濮?
### 1. 鍏嬮殕椤圭洰

```bash
git clone https://github.com/yiran168/ShiShishirineee.git
cd ShiShishirineee
```

### 2. 椤圭洰鏋舵瀯

```
ShiShishirineee/
鈹溾攢鈹€ client/              # 鍓嶇鍗氬 (Astro 5 + Svelte 5 + Tailwind 4)
鈹溾攢鈹€ server/              # 鍚庣鏈嶅姟 (Cloudflare Workers + Hono + Drizzle)
鈹斺攢鈹€ docs/                # 瀹樻柟鏂囨。绯荤粺 (Rspress / VitePress)
```

### 3. 鍚姩鍚庣寮€鍙戞湇鍔?(Server)

```bash
cd server
npm install
# 鎵ц鏈湴 D1 鏁版嵁搴撹縼绉诲垵濮嬪寲
npx wrangler d1 execute DB --local --file=./src/db/schema.sql
# 鍚姩 Workers 鏈湴 API 鏈嶅姟锛堥粯璁ょ鍙?11498锛?npm run dev
```

### 4. 鍚姩鍓嶇鍗氬寮€鍙戞湇鍔?(Client)

```bash
cd client
npm install
# 鍚姩 Astro 鏈湴鏈嶅姟锛堥粯璁ょ鍙?4321锛?npm run dev
```

鎵撳紑娴忚鍣ㄨ闂?`http://localhost:4321`锛屽嵆鍙紑濮嬩綋楠屽拰寮€鍙?ShiShishirineee锛侀浣嶆敞鍐岀敤鎴峰皢鑷姩鎴愪负绯荤粺瓒呯骇绠＄悊鍛橈紝璁块棶 `http://localhost:4321/admin` 鍗冲彲杩涘叆绠＄悊鎺у埗鍙般€?
