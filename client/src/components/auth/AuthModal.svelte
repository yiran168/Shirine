<script lang="ts">
  import { onMount } from "svelte";
  import { authStore } from "../../stores/auth";
  import { authApi, configApi, setToken } from "../../services/api";

  let username = $state("");
  let password = $state("");
  let nickname = $state("");
  let loading = $state(false);
  let errorMsg = $state("");

  let turnstileEnabled = $state(false);
  let turnstileSiteKey = $state("");
  let turnstileToken = $state("");
  let turnstileWidgetId: any = null;

  onMount(async () => {
    try {
      const res = await configApi.getSystem();
      if (res.success && res.config?.turnstileEnabled && res.config?.turnstileSiteKey) {
        turnstileEnabled = true;
        turnstileSiteKey = res.config.turnstileSiteKey;
        loadTurnstile();
      }
    } catch {}
  });

  function loadTurnstile() {
    if (typeof window === "undefined" || !turnstileSiteKey) return;
    if (!(window as any).turnstile) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => renderTurnstile();
      document.head.appendChild(script);
    } else {
      renderTurnstile();
    }
  }

  function renderTurnstile() {
    const el = document.getElementById("shirine-turnstile-container");
    if (!el || !(window as any).turnstile) return;
    if (turnstileWidgetId) {
      (window as any).turnstile.reset(turnstileWidgetId);
      return;
    }
    turnstileWidgetId = (window as any).turnstile.render(el, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => {
        turnstileToken = token;
      },
    });
  }

  $effect(() => {
    if (authStore.authModalOpen && turnstileEnabled) {
      setTimeout(renderTurnstile, 200);
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    loading = true;
    errorMsg = "";

    try {
      if (authStore.authModalTab === "login") {
        const res = await authApi.login({
          username,
          password,
          turnstileToken: turnstileEnabled ? turnstileToken : undefined,
        });

        if (res.success && res.token && res.user) {
          setToken(res.token);
          authStore.setUser(res.user);
          authStore.closeAuthModal();
          resetForm();
        } else {
          errorMsg = res.error || "登录失败，请检查账号密码";
        }
      } else {
        const res = await authApi.register({
          username,
          password,
          nickname,
          turnstileToken: turnstileEnabled ? turnstileToken : undefined,
        });

        if (res.success && res.token && res.user) {
          setToken(res.token);
          authStore.setUser(res.user);
          authStore.closeAuthModal();
          resetForm();
        } else {
          errorMsg = res.error || "注册失败，请更换用户名重试";
        }
      }
    } catch (err: any) {
      errorMsg = err.message || "网络请求异常";
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    username = "";
    password = "";
    nickname = "";
    errorMsg = "";
    turnstileToken = "";
    if (turnstileWidgetId && (window as any).turnstile) {
      (window as any).turnstile.reset(turnstileWidgetId);
    }
  }
</script>

{#if authStore.authModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all animate-fade-in">
    <!-- Modal Card -->
    <div class="relative w-full max-w-md bg-surface border border-outline/20 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
      <!-- Close button -->
      <button
        onclick={() => authStore.closeAuthModal()}
        class="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all"
        aria-label="关闭"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Brand Logo / Header -->
      <div class="text-center mb-6">
        <h2 class="text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Shirine</h2>
        <p class="text-xs text-on-surface-variant mt-1">
          {authStore.authModalTab === "login" ? "欢迎回来，请登录您的账号" : "创建账号，开启您的探索之旅"}
        </p>
      </div>

      <!-- Tab Switcher -->
      <div class="flex rounded-2xl bg-surface-container-low p-1 mb-6 border border-outline/10">
        <button
          onclick={() => { authStore.authModalTab = "login"; errorMsg = ""; }}
          class="flex-1 py-2 text-xs font-semibold rounded-xl transition-all {authStore.authModalTab === 'login' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
        >
          登录
        </button>
        <button
          onclick={() => { authStore.authModalTab = "register"; errorMsg = ""; }}
          class="flex-1 py-2 text-xs font-semibold rounded-xl transition-all {authStore.authModalTab === 'register' ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}"
        >
          注册
        </button>
      </div>

      {#if errorMsg}
        <div class="mb-4 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-xs">
          {errorMsg}
        </div>
      {/if}

      <!-- Form -->
      <form onsubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-on-surface-variant mb-1.5">用户名</label>
          <input
            type="text"
            required
            bind:value={username}
            placeholder="请输入您的账号用户名"
            class="w-full px-4 py-2.5 rounded-xl border border-outline/30 bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {#if authStore.authModalTab === "register"}
          <div>
            <label class="block text-xs font-medium text-on-surface-variant mb-1.5">用户昵称（可选）</label>
            <input
              type="text"
              bind:value={nickname}
              placeholder="请输入您的昵称"
              class="w-full px-4 py-2.5 rounded-xl border border-outline/30 bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        {/if}

        <div>
          <label class="block text-xs font-medium text-on-surface-variant mb-1.5">密码</label>
          <input
            type="password"
            required
            bind:value={password}
            placeholder="请输入密码（不少于 6 位）"
            class="w-full px-4 py-2.5 rounded-xl border border-outline/30 bg-surface-container-lowest text-on-surface text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <!-- Turnstile container if enabled -->
        {#if turnstileEnabled}
          <div class="pt-2 flex justify-center">
            <div id="shirine-turnstile-container"></div>
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading}
          class="w-full mt-4 py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:shadow-lg hover:brightness-105 active:scale-98 transition-all disabled:opacity-50"
        >
          {loading ? "提交处理中..." : (authStore.authModalTab === "login" ? "立即登录" : "注册新账号")}
        </button>
      </form>
    </div>
  </div>
{/if}
