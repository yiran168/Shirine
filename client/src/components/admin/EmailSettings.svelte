<script lang="ts">
  import { onMount } from "svelte";
  import { emailApi,type EmailSettings } from "../../services/email";
  let settings=$state<EmailSettings|null>(null),saving=$state(false),error=$state(""),message=$state("");
  const active=$derived(settings?.providers.find(p=>p.id===settings?.provider));
  let savedProvider="";
  const presets=[{name:"手动填写",host:""},{name:"QQ 邮箱",host:"smtp.qq.com"},{name:"163 邮箱",host:"smtp.163.com"},{name:"126 邮箱",host:"smtp.126.com"},{name:"网易企业邮箱",host:"smtp.qiye.163.com"},{name:"腾讯企业邮箱",host:"smtp.exmail.qq.com"},{name:"阿里企业邮箱",host:"smtp.qiye.aliyun.com"}];
  async function load(){try{settings=await emailApi.settings();savedProvider=settings.provider;settings.smtpPort??=465;settings.smtpHost??="";settings.smtpUser??="";settings.accessKeyId??="";settings.cloudRegion??=settings.provider==="tencent"?"ap-guangzhou":"cn-hangzhou";settings.templateId??="";settings.templateParams??='{"code":"{{code}}"}';}catch(err){error=err instanceof Error?err.message:"加载失败";}}
  onMount(()=>{void load();});
  function providerChanged(){if(!settings)return;settings.apiKey="";settings.clearSecret=false;if(settings.provider==="tencent")settings.cloudRegion="ap-guangzhou";if(settings.provider==="aliyun")settings.cloudRegion="cn-hangzhou";message="";}
  async function save(){if(!settings)return;saving=true;error="";message="";try{await emailApi.save(settings);await load();if(!error)message="邮箱注册验证码设置已保存";}catch(err){error=err instanceof Error?err.message:"保存失败";}finally{saving=false;}}
</script>
<section class="email-settings p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm" aria-labelledby="email-settings-title">
  <h2 id="email-settings-title" class="text-lg font-bold mb-2">邮箱注册 · 邮箱验证码</h2>
  <p>邮箱是默认注册方式。本开关决定注册时是否必须验证邮箱；手机号注册在下面单独开启。第三方账号注册不需要本站邮箱或短信验证码。</p>
  <p>邮件服务商、SMTP 凭据均加密保存。换服务商时需填写新密钥；同一服务商留空保留。本项独立保存。</p>
  <p><a href="https://yiran168.github.io/Shirine/guide/email.html" target="_blank" rel="noopener noreferrer" data-no-swup>查看邮箱验证码和 SMTP 接入教程 ↗</a></p>
  {#if error}<p role="alert" class="error">{error}</p>{/if}{#if message}<p role="status">{message}</p>{/if}
  {#if settings}
    <fieldset disabled={saving}>
      <label class="check"><input type="checkbox" bind:checked={settings.enabled} />开启邮箱注册验证码</label>
      <label>邮件发送服务商<select bind:value={settings.provider} onchange={providerChanged}>{#each settings.providers as provider}<option value={provider.id}>{provider.name}</option>{/each}</select></label>
      {#if active}<p><a href={active.docs} target="_blank" rel="noopener noreferrer" data-no-swup>{active.name} 官方文档 ↗</a></p>{/if}
      <div class="columns"><label>发件邮箱<input type="email" bind:value={settings.sender} placeholder="noreply@你的域名" /></label><label>发件人名称<input type="text" bind:value={settings.senderName} maxlength="64" /></label></div>
      {#if settings.provider==="smtp"}
        <label>常用 SMTP 配置<select onchange={(e)=>{if(settings && e.currentTarget.value){settings.smtpHost=e.currentTarget.value;settings.smtpPort=465;}}}>{#each presets as preset}<option value={preset.host}>{preset.name}</option>{/each}</select></label>
        <p>请在邮箱服务商处开启 SMTP，并使用其要求的授权码或应用密码。企业邮箱可能使用专属服务器，以控制台设置为准。</p>
        <div class="columns"><label>SMTP 服务器域名<input type="text" bind:value={settings.smtpHost} placeholder="smtp.qq.com" /></label><label>加密方式<select bind:value={settings.smtpPort}><option value={465}>465 · TLS</option><option value={587}>587 · STARTTLS</option><option value={994}>994 · TLS（部分企业邮箱）</option></select></label></div>
        <label>SMTP 登录账号<input type="text" bind:value={settings.smtpUser} autocomplete="off" placeholder="通常为完整邮箱地址" /></label>
      {/if}
      {#if ["aliyun","tencent","sendcloud"].includes(settings.provider)}<label>{settings.provider==="aliyun"?"AccessKey ID":settings.provider==="tencent"?"SecretId":"API_USER"}<input type="text" bind:value={settings.accessKeyId} autocomplete="off" /></label>{/if}
      <label>{settings.provider==="smtp"?"SMTP 授权码 / 应用密码":settings.provider==="aliyun"?"AccessKey Secret":settings.provider==="tencent"?"SecretKey":settings.provider==="postmark"?"Server API Token":"API Key"}<input type="password" bind:value={settings.apiKey} autocomplete="new-password" placeholder={settings.hasSecret&&settings.provider===savedProvider?"已保存，留空保留":"请输入凭据"} /></label>
      {#if settings.hasSecret&&settings.provider===savedProvider}<label class="check"><input type="checkbox" bind:checked={settings.clearSecret} />清除已保存密钥（需同时关闭邮箱验证码）</label>{/if}
      {#if settings.provider==="aliyun" || settings.provider==="tencent"}<label>服务地区<select bind:value={settings.cloudRegion}>{#if settings.provider==="aliyun"}{#each ["cn-hangzhou","ap-southeast-1","ap-southeast-2","us-east-1","eu-central-1"] as region}<option value={region}>{region}</option>{/each}{:else}<option value="ap-guangzhou">ap-guangzhou</option><option value="ap-hongkong">ap-hongkong</option>{/if}</select></label>{/if}
      {#if settings.provider==="tencent"}<label>已审核邮件模板 ID<input type="text" bind:value={settings.templateId} inputmode="numeric" /></label><label>模板变量 JSON<textarea rows="3" bind:value={settings.templateParams}></textarea></label><p>腾讯云默认要求模板发送。模板必须包含验证码变量，后台用 {'{{code}}'} 替换验证码、{'{{minutes}}'} 替换有效分钟数。</p>{/if}
      {#if settings.provider==="mailgun"}<label>Mailgun 发信域名<input type="text" bind:value={settings.domain} /></label><label>区域<select bind:value={settings.region}><option value="us">US</option><option value="eu">EU</option></select></label>{/if}
      <div class="limits"><label>每邮箱每天最多<input type="number" min="1" max="20" bind:value={settings.recipientDaily} /></label><label>每 IP 每小时最多<input type="number" min="1" max="100" bind:value={settings.ipHourly} /></label><label>全站每天最多<input type="number" min="1" max="10000" bind:value={settings.totalDaily} /></label></div>
      <p>重发间隔 60 秒；验证码 5 分钟有效，最多尝试 5 次。UTC 自然日 / 小时计数，失败请求也计入额度。Turnstile 开启时，发送及提交注册分别验证。</p>
      <button type="button" onclick={save}>{saving?"正在保存…":"保存邮箱注册设置"}</button>
    </fieldset>
  {:else if error}<button type="button" onclick={load}>重新加载</button>{:else}<p role="status">正在加载邮件设置…</p>{/if}
</section>
<style>
  p{font-size:12px;color:var(--on-surface-variant);line-height:1.8;margin:8px 0 12px}a{color:var(--primary)}.error{color:var(--error)}fieldset{display:grid;gap:12px;min-width:0}label{display:block;font-size:12px;font-weight:600;min-width:0}input:not([type=checkbox]),select,textarea{display:block;width:100%;min-width:0;padding:10px 12px;margin-top:6px;border:1px solid var(--outline-variant);border-radius:10px;background:var(--surface-container-low);font-size:13px}input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}.check{display:flex;align-items:center;gap:8px;min-height:44px}input[type=checkbox]{accent-color:var(--primary)}.columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.limits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}button{min-height:44px;padding:10px 18px;border-radius:12px;background:var(--primary);color:var(--on-primary);justify-self:start;font-size:13px}@media(max-width:640px){.columns,.limits{grid-template-columns:1fr}}
</style>
