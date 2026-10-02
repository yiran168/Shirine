<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@components/atoms/display/Icon.svelte";
  import { oauthApi, type OAuthProviderInfo } from "../../services/oauth";
  let { ready = false, token = "", busy = $bindable(false), onfailure = () => {}, mode = "login" }:
    { ready?: boolean; token?: string; busy?: boolean; onfailure?: () => void; mode?: "login" | "register" } = $props();
  let providers = $state<OAuthProviderInfo[]>([]);
  let error = $state("");
  let pending = $state("");
  let alive = false;
  let language = $state("zh");
  const text = $derived(language.startsWith("en") ? { title: "Continue with", login: "Sign in with", register: "Sign up with", progress: "Redirecting…" }
    : language.startsWith("ja") ? { title: "外部アカウント", login: "でログイン", register: "で新規登録", progress: "移動中…" }
    : /TW|HK|Hant/i.test(language) ? { title: "其他帳號", login: "登入", register: "註冊", progress: "正在跳轉…" }
    : { title: "其他账号", login: "登录", register: "注册", progress: "正在跳转…" });
  onMount(() => {
    alive = true;
    language = document.documentElement.lang;
    const observer = new MutationObserver(() => { language = document.documentElement.lang; });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    oauthApi.providers().then(result => { if (alive) providers = result.providers; }).catch(() => {});
    const restore = () => { if (busy) { busy = false; pending = ""; onfailure(); } };
    window.addEventListener("pageshow", restore);
    return () => { alive = false; busy = false; observer.disconnect(); window.removeEventListener("pageshow", restore); };
  });
  async function login(id: string) {
    if (!ready || busy) return;
    busy = true; pending = id; error = "";
    try {
      const { url } = await oauthApi.start(id, token);
      if (!alive) return;
      window.location.assign(url);
    } catch (err) {
      if (!alive) return;
      error = err instanceof Error ? err.message : "第三方登录失败，请重试";
      busy = false; pending = ""; onfailure();
    }
  }
</script>

{#if providers.length}
  <div class="oauth-buttons" aria-label={text.title}>
    <div class="oauth-divider"><span>{text.title}</span></div>
    <div class="oauth-grid">
      {#each providers as provider (provider.id)}
        <button type="button" class="m3-state-layer" disabled={!ready || busy} onclick={() => login(provider.id)}>
          <Icon icon={provider.icon} width="18" height="18" aria-hidden="true" />
          <span>{pending === provider.id ? text.progress : language.startsWith("en") ? `${mode === "register" ? text.register : text.login} ${provider.name}` : `${provider.name} ${mode === "register" ? text.register : text.login}`}</span>
        </button>
      {/each}
    </div>
    {#if error}<p role="alert">{error}</p>{/if}
  </div>
{/if}

<style>
  .oauth-divider { display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--on-surface-variant); margin: 12px 0; }
  .oauth-divider::before, .oauth-divider::after { content: ""; height: 1px; flex: 1; background: color-mix(in srgb, var(--outline-variant) 50%, transparent); }
  .oauth-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  button { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; padding: 8px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--outline-variant) 50%, transparent); color: var(--on-surface); background: var(--surface-container-low); font-size: 12px; transition: background 160ms, opacity 160ms; }
  button:hover:not(:disabled) { background: var(--surface-container-high); }
  button:disabled { opacity: .45; cursor: not-allowed; }
  button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  p { color: var(--error); font-size: 12px; margin-top: 8px; }
  @media (max-width: 350px) { .oauth-grid { grid-template-columns: 1fr; } }
</style>
