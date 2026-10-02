<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@components/atoms/display/Icon.svelte";
  import { oauthApi, type OAuthSetting } from "../../services/oauth";
  let origin = $state("");
  let providers = $state<OAuthSetting[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let message = $state("");
  let error = $state("");
  let dirty = $state(false);
  async function load() {
    loading = true; error = "";
    try {
      const result = await oauthApi.settings();
      origin = result.origin || window.location.origin;
      providers = result.providers.map(p => ({ ...p, secret: "", clearSecret: false }));
      dirty = false;
    } catch (err) { error = err instanceof Error ? err.message : "加载失败"; }
    finally { loading = false; }
  }
  onMount(() => { void load(); });
  async function save() {
    saving = true; error = ""; message = "";
    try {
      await oauthApi.save(origin, providers);
      await load();
      if (!error) message = "第三方登录设置已保存，登录与注册入口将按新配置显示。";
    } catch (err) { error = err instanceof Error ? err.message : "保存失败"; }
    finally { saving = false; }
  }
  function changed() { dirty = true; message = ""; }
  function callback(id: string) { return `${origin.trim().replace(/\/+$/, "")}/api/auth/oauth/${id}/callback`; }
  async function copy(id: string) {
    try { await navigator.clipboard.writeText(callback(id)); message = "回调地址已复制"; }
    catch { message = "请选中回调地址后手动复制"; }
  }
</script>

<section class="oauth-settings p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm" aria-labelledby="oauth-settings-title">
  <h2 id="oauth-settings-title" class="text-lg font-bold mb-2">第三方登录 · OAuth</h2>
  <p class="hint">按需启用平台。开启 Turnstile 后，第三方登录、注册也必须先通过人机验证。首次授权会创建普通用户；再次授权回到同一账号，不会按邮箱自动合并已有账号。</p>
  <p class="hint">本项使用下方「保存第三方登录设置」独立保存。应用密钥加密保存在服务端，保存后不回显；留空保留原密钥。</p>
  <p class="hint"><a href="https://yiran168.github.io/Shirine/guide/oauth.html" target="_blank" rel="noopener noreferrer" data-no-swup>查看 Shirine 第三方登录接入教程 ↗</a></p>
  {#if loading}<p role="status">正在加载平台设置…</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if !loading && providers.length}
    <fieldset disabled={saving} oninput={changed} onchange={changed}>
      <label class="origin">网站地址（统一回调域名）
        <input type="url" bind:value={origin} placeholder="https://你的域名" autocomplete="off" />
      </label>
      <p class="hint">填写正在使用的 Shirine 前台根地址。应与平台登记的回调地址完全一致；自定义域名启用后请一并更新。</p>
      <div class="providers">
        {#each providers as provider (provider.id)}
          <details>
            <summary>
              <Icon icon={provider.icon} width="20" height="20" aria-hidden="true" />
              <span>{provider.name}</span>
              <small>{provider.enabled ? "已选择启用" : "未启用"}</small>
            </summary>
            <div class="provider-fields">
              <label class="switch"><input type="checkbox" bind:checked={provider.enabled} />启用 {provider.name} 登录与注册</label>
              <p class="hint">{provider.help} <a href={provider.docs} target="_blank" rel="noopener noreferrer" data-no-swup>官方接入文档 ↗</a></p>
              <label>{provider.id === "apple" ? "Services ID（Client ID）" : "Client ID / App ID"}
                <input type="text" bind:value={provider.clientId} autocomplete="off" spellcheck="false" />
              </label>
              {#if provider.id === "microsoft"}
                <label>账号范围 / 租户
                  <input type="text" bind:value={provider.tenant} placeholder="common" list="microsoft-tenants" autocomplete="off" />
                  <datalist id="microsoft-tenants"><option value="common">个人及组织账号</option><option value="consumers">仅个人账号</option><option value="organizations">仅组织账号</option></datalist>
                </label>
              {/if}
              {#if provider.id === "apple"}
                <div class="apple-ids">
                  <label>Team ID<input type="text" bind:value={provider.teamId} autocomplete="off" /></label>
                  <label>Key ID<input type="text" bind:value={provider.keyId} autocomplete="off" /></label>
                </div>
                <label>.p8 私钥（完整 PEM 内容）
                  <textarea bind:value={provider.secret} rows="4" placeholder={provider.hasSecret ? "已保存私钥，留空保留" : "-----BEGIN PRIVATE KEY-----"} autocomplete="off" spellcheck="false"></textarea>
                </label>
              {:else}
                <label>Client Secret / App Secret
                  <input type="password" bind:value={provider.secret} placeholder={provider.hasSecret ? "已保存密钥，留空保留" : "请输入应用密钥"} autocomplete="new-password" />
                </label>
              {/if}
              {#if provider.hasSecret}<label class="switch"><input type="checkbox" bind:checked={provider.clearSecret} />清除已保存密钥（需同时关闭此平台）</label>{/if}
              <label>授权回调地址
                <div class="callback"><input type="text" readonly value={callback(provider.id)} onclick={(e) => e.currentTarget.select()} /><button type="button" onclick={() => copy(provider.id)}>复制</button></div>
              </label>
            </div>
          </details>
        {/each}
      </div>
      <div class="actions"><button type="button" class="save" onclick={save}>{saving ? "正在保存…" : "保存第三方登录设置"}</button>{#if dirty}<span>有未保存的更改</span>{/if}</div>
    </fieldset>
  {:else if !loading}
    <button type="button" onclick={load}>重新加载</button>
  {/if}
</section>

<style>
  .hint { font-size: 12px; color: var(--on-surface-variant); line-height: 1.8; margin: 8px 0 12px; }
  .error { color: var(--error); }
  [role="status"], [role="alert"] { font-size: 13px; margin: 12px 0; }
  fieldset { min-width: 0; }
  label { display: block; font-size: 12px; font-weight: 600; }
  input:not([type="checkbox"]), textarea { display: block; width: 100%; min-width: 0; padding: 10px 12px; margin-top: 6px; border: 1px solid color-mix(in srgb, var(--outline-variant) 50%, transparent); border-radius: 10px; background: var(--surface-container-low); font: 13px ui-monospace, monospace; }
  input:focus-visible, textarea:focus-visible { outline: 2px solid var(--primary); }
  .providers { display: grid; gap: 10px; margin: 16px 0; }
  details { border: 1px solid color-mix(in srgb, var(--outline-variant) 40%, transparent); border-radius: 14px; overflow: hidden; }
  summary { display: flex; align-items: center; gap: 10px; padding: 14px; min-height: 48px; cursor: pointer; }
  summary small { margin-left: auto; color: var(--on-surface-variant); font-size: 11px; }
  summary::after { content: "+"; margin-left: 6px; }
  details[open] summary::after { content: "−"; }
  .provider-fields { padding: 0 14px 16px; display: grid; gap: 12px; }
  .switch { display: flex; align-items: center; gap: 8px; min-height: 32px; }
  input[type="checkbox"] { accent-color: var(--primary); width: 17px; height: 17px; }
  .apple-ids { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .callback { display: flex; align-items: center; gap: 8px; }
  .callback input { flex: 1; }
  a { color: var(--primary); text-decoration: underline; }
  button { min-height: 44px; padding: 10px 16px; border-radius: 12px; background: var(--surface-container-high); white-space: nowrap; font-size: 13px; }
  .save { background: var(--primary); color: var(--on-primary); font-weight: 600; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .actions span { font-size: 12px; color: var(--on-surface-variant); }
</style>
