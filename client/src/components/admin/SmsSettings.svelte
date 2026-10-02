<script lang="ts">
  import { onMount } from "svelte";
  import { smsApi, type SmsSettings } from "../../services/sms";
  let settings=$state<SmsSettings | null>(null);
  let countries=$state("86");
  let saving=$state(false);
  let error=$state("");
  let message=$state("");
  const active=$derived(settings?.providers.find(p=>p.id===settings?.provider));
  async function load() {
    try { settings=await smsApi.settings(); countries=settings.countries.join(", "); }
    catch(err) { error=err instanceof Error ? err.message : "加载失败"; }
  }
  onMount(()=>{ void load(); });
  async function save() {
    if(!settings) return;
    saving=true; error=""; message="";
    try {
      settings.countries=countries.split(/[,，\s]+/).filter(Boolean).map(v=>v.replace(/^\+/,""));
      await smsApi.save(settings); await load();
      if(!error) message="短信注册设置已保存";
    } catch(err) { error=err instanceof Error ? err.message : "保存失败"; }
    finally { saving=false; }
  }
</script>

<section class="sms-settings p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm" aria-labelledby="sms-settings-title">
  <h2 id="sms-settings-title" class="text-lg font-bold mb-2">手机号注册 · 短信验证码</h2>
  <p>开启后前台增加手机号注册选项，使用短信验证代替邮箱验证。邮箱注册始终保留，第三方账号注册无需短信。开启 Turnstile 后，发送验证码与提交注册均需先完成人机验证。</p>
  <p>选择一个服务商发送。签名、模板及发送权限需在服务商控制台开通。密钥加密保存，留空保留原值。</p>
  <p><a href="https://yiran168.github.io/Shirine/guide/sms.html" target="_blank" rel="noopener noreferrer" data-no-swup>查看短信接入教程 ↗</a></p>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if settings}
    <fieldset disabled={saving}>
      <label class="check"><input type="checkbox" bind:checked={settings.enabled} />允许手机号注册（必须验证短信）</label>
      <label>短信服务商<select bind:value={settings.provider}>{#each settings.providers as provider}<option value={provider.id}>{provider.name}</option>{/each}</select></label>
      {#if active}
        <p><a href={active.docs} target="_blank" rel="noopener noreferrer" data-no-swup>{active.name} 官方文档 ↗</a>{active.domesticOnly ? " · 当前接入仅支持中国大陆号码" : ""}</p>
        <div class="fields">
          {#each active.fields as field (`${active.id}:${field.key}`)}
            <label>{field.label}
              {#if field.multiline}<textarea rows="3" bind:value={active.values[field.key]} spellcheck="false"></textarea>
              {:else}<input type={field.secret ? "password" : "text"} bind:value={active.values[field.key]} autocomplete={field.secret ? "new-password" : "off"} placeholder={active.savedSecrets.includes(field.key) ? "已保存，留空保留" : field.default || ""} />{/if}
            </label>
            {#if field.secret && active.savedSecrets.includes(field.key)}<label class="check"><input type="checkbox" checked={active.clearSecrets?.includes(field.key) || false} onchange={(e)=>{ active.clearSecrets=e.currentTarget.checked ? [...(active.clearSecrets || []),field.key] : active.clearSecrets?.filter(k=>k!==field.key); }} />清除已保存的 {field.label}</label>{/if}
          {/each}
        </div>
      {/if}
      <label>允许发送的国家/地区区号（逗号分隔）<input type="text" bind:value={countries} placeholder="86, 1, 81" /></label>
      <div class="limits">
        <label>每号码每天最多<input type="number" min="1" max="20" bind:value={settings.phoneDaily} /></label>
        <label>每 IP 每小时最多<input type="number" min="1" max="100" bind:value={settings.ipHourly} /></label>
        <label>全站每天最多<input type="number" min="1" max="10000" bind:value={settings.totalDaily} /></label>
      </div>
      <p>每次间隔 60 秒；验证码 5 分钟有效，最多尝试 5 次。每日、每小时额度按 UTC 自然日、自然小时计算。发送失败也计入限额，避免超时重复计费。</p>
      <button type="button" onclick={save}>{saving ? "正在保存…" : "保存短信注册设置"}</button>
    </fieldset>
  {:else if error}<button type="button" onclick={load}>重新加载</button>{:else}<p role="status">正在加载短信设置…</p>{/if}
</section>
<style>
  p { font-size:12px; color:var(--on-surface-variant); line-height:1.8; margin:8px 0 12px; }
  a { color:var(--primary); } .error { color:var(--error); }
  fieldset,.fields { display:grid; gap:12px; min-width:0; }
  label { display:block; font-size:12px; font-weight:600; min-width:0; }
  input:not([type="checkbox"]),select,textarea { display:block; width:100%; min-width:0; padding:10px 12px; margin-top:6px; border:1px solid var(--outline-variant); border-radius:10px; background:var(--surface-container-low); font-size:13px; }
  input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
  .check { display:flex; align-items:center; gap:8px; min-height:44px; } input[type="checkbox"] { accent-color:var(--primary); }
  .limits { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  button { min-height:44px; padding:10px 18px; border-radius:12px; background:var(--primary); color:var(--on-primary); justify-self:start; font-size:13px; }
  @media(max-width:640px) { .limits { grid-template-columns:1fr; } }
</style>
