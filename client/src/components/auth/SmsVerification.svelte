<script lang="ts">
  import { onMount } from "svelte";
  import { smsApi } from "../../services/sms";
  let { phone=$bindable(""), code=$bindable(""), challengeId=$bindable(""), ready=$bindable(false), busy=$bindable(false), turnstileReady, turnstileToken, disabled=false, onverifiedrequest }: {
    phone?:string; code?:string; challengeId?:string; ready?:boolean; busy?:boolean; turnstileReady:boolean; turnstileToken:string; disabled?:boolean; onverifiedrequest:()=>void;
  }=$props();
  let enabled=$state(false);
  let loaded=$state(false);
  let countries=$state<string[]>([]);
  let error=$state("");
  let notice=$state("");
  let remaining=$state(0);
  let deadline=0;
  let alive=true;
  $effect(()=>{ ready=loaded && (!enabled || (!!challengeId && /^\d{6}$/.test(code))); });
  async function load() {
    error="";
    try { const config=await smsApi.config(); if(!alive) return; enabled=config.enabled; countries=config.countries; loaded=true; }
    catch(err) { if(alive) error=err instanceof Error ? err.message : "无法加载验证设置"; }
  }
  onMount(()=>{
    alive=true; phone=""; code=""; challengeId=""; ready=false; busy=false; void load();
    const timer=setInterval(()=>{ remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000)); },500);
    return ()=>{ alive=false; busy=false; ready=false; clearInterval(timer); };
  });
  function phoneChanged() { challengeId=""; code=""; notice=""; }
  async function send() {
    if(busy || disabled || !turnstileReady || remaining || !phone.trim()) return;
    busy=true; error=""; notice=""; challengeId=""; code="";
    const requestedPhone=phone;
    try {
      const result=await smsApi.send(phone,turnstileToken);
      if(!alive) return;
      if(phone===requestedPhone) { challengeId=result.challengeId; notice=`验证码已发送至 ${result.maskedPhone}，5 分钟内有效。`; }
      deadline=Date.now()+result.retryAfter*1000; remaining=result.retryAfter;
    } catch(err) { if(alive) error=err instanceof Error ? err.message : "发送失败"; }
    finally { if(alive) { busy=false; onverifiedrequest(); } }
  }
</script>
{#if !loaded}
  <div class="sms-verification"><p role="status">{error || "正在读取注册验证设置…"}</p>{#if error}<button type="button" onclick={load}>重新加载</button>{/if}</div>
{:else if enabled}
  <div class="sms-verification">
    <p>手机号注册需要短信验证；邮箱及第三方账号注册无需短信。</p>
    <label>手机号<input type="tel" autocomplete="tel" required bind:value={phone} oninput={phoneChanged} disabled={busy || disabled} placeholder={countries.includes("86") ? "中国大陆手机号可直接填写" : "例如 +14155552671"} maxlength="32" /></label>
    <p>支持区号：{countries.map(c=>`+${c}`).join("、")}。国际号码请包含 + 和区号。</p>
    <div class="code-row"><label>短信验证码<input type="text" inputmode="numeric" autocomplete="one-time-code" required pattern={"[0-9]{6}"} maxlength="6" bind:value={code} placeholder="六位验证码" disabled={busy || disabled} /></label>
      <button type="button" onclick={send} disabled={!turnstileReady || busy || disabled || remaining>0 || !phone.trim()}>{busy ? "发送中…" : remaining ? `${remaining} 秒后重发` : "发送验证码"}</button>
    </div>
    {#if !turnstileReady}<p>请先完成上方人机验证，再发送验证码。</p>{/if}
    {#if notice}<p role="status">{notice}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
{/if}
<style>
  .sms-verification { display:grid; gap:10px; } label { display:block; font-size:12px; font-weight:700; min-width:0; }
  input { display:block; width:100%; min-width:0; margin-top:6px; padding:10px 12px; border:1px solid var(--outline-variant); border-radius:12px; background:var(--surface-container-low); font-size:14px; }
  .code-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; align-items:end; }
  button { min-height:44px; border-radius:12px; padding:8px 12px; background:var(--primary-container); color:var(--on-primary-container); font-size:12px; white-space:nowrap; }
  button:disabled { opacity:.45; cursor:not-allowed; } input:focus-visible,button:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
  p { font-size:12px; line-height:1.6; color:var(--on-surface-variant); } .error { color:var(--error); }
</style>
