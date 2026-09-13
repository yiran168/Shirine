# 娴嬭瘯鎸囧崡

鏈枃妗ｆ彁渚?Shishirinee 椤圭洰涓祴璇曠殑鍏ㄩ潰鎸囧崡銆?
## 姒傝堪

Shishirinee 鍦ㄦ暣涓粨搴撶粺涓€浣跨敤涓€濂楁祴璇曡繍琛屽櫒锛?
- **杩愯鍣?*锛歔Bun 鍘熺敓娴嬭瘯杩愯鍣╙(https://bun.sh/docs/cli/test) 涓?`bun:test` API
- **瀹㈡埛绔幆澧?*锛歊eact 缁勪欢娴嬭瘯瀵煎叆缁熶竴鐨?jsdom 鍒濆鍖栨枃浠?- **鏈嶅姟绔幆澧?*锛歐orker 鍏煎鍏ㄥ眬瀵硅薄涓庡唴瀛?SQLite 鏁版嵁搴?
## 杩愯娴嬭瘯

### 鎵€鏈夋祴璇?
```bash
# 浣跨敤鏍圭洰褰曟爣鍑嗗懡浠よ繍琛屽叏閮ㄦ祴璇?bun run test
```

### 瀹㈡埛绔祴璇?
```bash
# 杩愯涓€娆℃祴璇?bun run test:client

# 鐩戣妯″紡杩愯娴嬭瘯
bun run test:client:watch

# 杩愯娴嬭瘯骞剁敓鎴愯鐩栫巼鎶ュ憡
bun run test:client:coverage
```

### 鏈嶅姟绔祴璇?
```bash
# 杩愯涓€娆℃祴璇?bun run test:server

# 杩愯娴嬭瘯骞剁敓鎴愯鐩栫巼鎶ュ憡
bun run test:server:coverage
```

## 娴嬭瘯缁撴瀯

### 瀹㈡埛绔祴璇?
浣嶇疆锛歚client/src/**/__tests__/*.test.ts`

```typescript
// 瀹㈡埛绔祴璇曠ず渚?import '../../test/setup';
import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../components/MyComponent';

describe('MyComponent', () => {
  it('搴旇姝ｇ‘娓叉煋', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### 鏈嶅姟绔祴璇?
浣嶇疆锛?- 鍗曞厓娴嬭瘯锛歚server/src/**/__tests__/*.test.ts`
- 闆嗘垚娴嬭瘯锛歚server/tests/integration/*.test.ts`
- 瀹夊叏娴嬭瘯锛歚server/tests/security/*.test.ts`

```typescript
// 鏈嶅姟绔祴璇曠ず渚?import { describe, it, expect } from 'bun:test';
import { myFunction } from '../utils/myFunction';

describe('myFunction', () => {
  it('搴旇杩斿洖姝ｇ‘缁撴灉', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

## 缂栧啓娴嬭瘯

### 瀹㈡埛绔祴璇?
1. **缁勪欢娴嬭瘯**锛氬崟鐙祴璇?React 缁勪欢
2. **API 瀹㈡埛绔祴璇?*锛氭祴璇?HTTP 瀹㈡埛绔拰 API 璋冪敤
3. **宸ュ叿鍑芥暟娴嬭瘯**锛氭祴璇曡緟鍔╁嚱鏁?
绀轰緥锛?```typescript
import { describe, expect, it } from 'bun:test';
import { apiClient } from '../api/client';

describe('API Client', () => {
  it('搴旇澶勭悊 API 閿欒', async () => {
    const result = await apiClient.get('/nonexistent');
    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(404);
  });
});
```

### 鏈嶅姟绔祴璇?
1. **鏈嶅姟娴嬭瘯**锛氭祴璇曟湇鍔′腑鐨勪笟鍔￠€昏緫
2. **璺敱娴嬭瘯**锛氭祴璇?API 绔偣
3. **宸ュ叿鍑芥暟娴嬭瘯**锛氭祴璇曡緟鍔╁嚱鏁?
浣跨敤鏁版嵁搴撶殑绀轰緥锛?```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { createMockDB } from '../../tests/fixtures';

describe('FeedService', () => {
  let db: any;

  beforeEach(() => {
    const mockDB = createMockDB();
    db = mockDB.db;
  });

  it('搴旇鍒涘缓 feed', async () => {
    // 浣跨敤妯℃嫙鏁版嵁搴撹繘琛屾祴璇?  });
});
```

## 娴嬭瘯澶瑰叿

鏈嶅姟绔祴璇曚娇鐢ㄥす鍏锋潵璁剧疆妯℃嫙鏁版嵁锛?
- `server/tests/fixtures/index.ts` - 妯℃嫙鏁版嵁搴撳拰鐜璁剧疆
- `server/tests/test-api-client.ts` - 鐢ㄤ簬娴嬭瘯鐨勭被鍨嬪畨鍏?API 瀹㈡埛绔?
## 瑕嗙洊鐜?
鏍圭洰褰曞懡浠や細鐢熸垚涓€浠藉悎骞惰鐩栫巼鎶ュ憡锛?
```bash
# 鍏ㄤ粨娴嬭瘯瑕嗙洊鐜?bun run test:coverage
```

鍚堝苟鎶ュ憡鐢熸垚鍦?`coverage/`銆傝嫢浠庡鎴风鎴栨湇鍔＄鐩綍鍗曠嫭杩愯瑕嗙洊鐜囧懡浠わ紝鎶ュ憡浠嶅垎鍒啓鍏?`client/coverage/` 鎴?`server/coverage/`銆?
## CI/CD 闆嗘垚

娴嬭瘯鍦ㄤ互涓嬫儏鍐佃嚜鍔ㄨ繍琛岋細
- 姣忔鎺ㄩ€佸埌 `main` 鎴?`trunk` 鍒嗘敮
- 姣忎釜 Pull Request
- 閮ㄧ讲鍓嶏紙闃诲鎬э級

璇︾粏淇℃伅璇峰弬闃?[GitHub Actions 宸ヤ綔娴乚(./deploy.mdx#github-actions-宸ヤ綔娴?銆?
## 鏈€浣冲疄璺?
1. **涓烘柊鍔熻兘缂栧啓娴嬭瘯**锛氭瘡涓柊鍔熻兘閮藉簲璇ュ寘鍚祴璇?2. **娴嬭瘯杈圭晫鎯呭喌**锛氬寘鎷敊璇潯浠跺拰杈圭晫鎯呭喌鐨勬祴璇?3. **浣跨敤鎻忚堪鎬у悕绉?*锛氭祴璇曟弿杩板簲璇ユ竻妤氳鏄庢鍦ㄦ祴璇曚粈涔?4. **淇濇寔娴嬭瘯鐙珛**锛氭瘡涓祴璇曢兘搴旇鑳藉鐙珛杩愯
5. **妯℃嫙澶栭儴渚濊禆**锛氫负澶栭儴 API 鍜屾湇鍔′娇鐢ㄦā鎷?6. **缁熶竴杩愯鍣?*锛氭祴璇?API 鍙粠 `bun:test` 瀵煎叆锛屼笉瑕佸啀娣诲姞 Vitest 鎴栧叾浠栬繍琛屽櫒

## 鏁呴殰鎺掗櫎

### 瀹㈡埛绔祴璇曞け璐?
```bash
# 閫氳繃鏍囧噯瀹㈡埛绔叆鍙ｈ繍琛?bun run test:client
```

### 鏈嶅姟绔祴璇曞け璐?
```bash
# 纭繚浣犲湪 server 鐩綍涓?cd server
bun test
```

### 瑕嗙洊鐜囨湭鐢熸垚

纭繚浣犲湪娴嬭瘯閰嶇疆涓厤缃簡瑕嗙洊鐜囨姤鍛婂櫒銆?
## 鍏朵粬璧勬簮

- [Bun 娴嬭瘯杩愯鍣╙(https://bun.sh/docs/cli/test)
- [Testing Library](https://testing-library.com/docs/)

