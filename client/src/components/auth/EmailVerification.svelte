<script lang="ts">
  import { onMount } from "svelte";
  import { emailApi } from "../../services/email";
  let {email,code=$bindable(""),challengeId=$bindable(""),ready=$bindable(false),busy=$bindable(false),turnstileReady,turnstileToken,disabled=false,onverifiedrequest}:{email:string;code?:string;challengeId?:string;ready?:boolean;busy?:boolean;turnstileReady:boolean;turnstileToken:string;disabled?:boolean;onverifiedrequest:()=>void}=$props();
  let enabled=$state(false),loaded=$state(false),error=$state(""),notice=$state(""),remaining=$state(0);
  let alive=true,deadline=0;
  let recipient=$state("");
  $effect(()=>{ready=loaded && (!enabled || (!!challengeId && /^\d{6}$/.test(code) && email.trim().toLowerCase()===recipient));});
  $effect(()=>{if(email.trim().toLowerCase()!==recipient){challengeId="";code="";notice="";}});
  async function load(){error="";try{const result=await emailApi.config();if(alive){enabled=result.enabled;loaded=true;}}catch(err){if(alive)error=err instanceof Error?err.message:"设置加载失败";}}
  onMount(()=>{alive=true;code="";challengeId="";ready=false;busy=false;void load();const timer=setInterval(()=>remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000)),500);return()=>{alive=false;busy=false;ready=false;clearInterval(timer);};});
  async function send(){
    if(busy || disabled || !turnstileReady || remaining || !email.trim())return;
    busy=true;error="";notice="";code="";challengeId="";const requested=email.trim().toLowerCase();
    try{const result=await emailApi.send(requested,turnstileToken);if(!alive)return;if(requested===email.trim().toLowerCase()){recipient=requested;challengeId=result.challengeId;notice="验证码已发送，5 分钟内有效。未收到时请查看垃圾邮件。";}deadline=Date.now()+result.retryAfter*1000;remaining=result.retryAfter;}
    catch(err){if(alive)error=err instanceof Error?err.message:"发送失败";}
    finally{if(alive){busy=false;onverifiedrequest();}}
  }
</script>
{#if !loaded}<div><p role="status">{error||"正在读取邮箱验证设置…"}</p>{#if error}<button type="button" onclick={load}>重新加载</button>{/if}</div>
{:else if enabled}
  <div class="email-verification">
    <div class="code-row"><label>邮箱验证码<input type="text" inputmode="numeric" autocomplete="one-time-code" required pattern={"[0-9]{6}"} maxlength="6" bind:value={code} placeholder="六位验证码" disabled={busy||disabled} /></label><button type="button" onclick={send} disabled={!turnstileReady||busy||disabled||remaining>0||!email.trim()}>{busy?"发送中…":remaining?`${remaining} 秒后重发`:"发送验证码"}</button></div>
    {#if !turnstileReady}<p>请先完成上方人机验证，再发送验证码。</p>{/if}
    {#if notice}<p role="status">{notice}</p>{/if}{#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
{/if}
<style>
  .email-verification{display:grid;gap:10px}.code-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end}label{display:block;font-size:12px;font-weight:700;min-width:0}input{display:block;width:100%;min-width:0;margin-top:6px;padding:10px 12px;border:1px solid var(--outline-variant);border-radius:12px;background:var(--surface-container-low);font-size:14px}button{min-height:44px;border-radius:12px;padding:8px 12px;background:var(--primary-container);color:var(--on-primary-container);font-size:12px;white-space:nowrap}button:disabled{opacity:.45;cursor:not-allowed}input:focus-visible,button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}p{font-size:12px;line-height:1.6;color:var(--on-surface-variant)}.error{color:var(--error)}
</style>
