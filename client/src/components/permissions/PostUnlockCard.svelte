<script lang="ts">
  import { authStore } from "../../stores/auth";
  import { postsApi, albumsApi } from "../../services/api";

  interface Props {
    postId: number | string;
    permissionType: string;
    requiredPoints?: number;
    userPoints?: number;
    itemType?: "post" | "album";
    lockReason?: string;
    passwordHint?: string;
    onUnlocked?: (newContent: string) => void;
  }

  let {
    postId,
    permissionType,
    requiredPoints = 0,
    userPoints = 0,
    itemType = "post",
    lockReason,
    passwordHint,
    onUnlocked
  }: Props = $props();

  let loading = $state(false);
  let errorMsg = $state("");
  let inputPassword = $state("");

  const effectiveReason = $derived(
    lockReason ||
    (permissionType === "password"
      ? "password_required"
      : permissionType === "login_required"
      ? "login_required"
      : permissionType === "points_required"
      ? "points_required"
      : "password_required")
  );

  async function handleVerifyPassword(e?: Event) {
    if (e) e.preventDefault();
    if (!inputPassword.trim()) {
      errorMsg = "请输入访问密码";
      return;
    }

    loading = true;
    errorMsg = "";

    try {
      const res =
        itemType === "album"
          ? await albumsApi.verifyPassword(postId, inputPassword.trim())
          : await postsApi.verifyPassword(postId, inputPassword.trim());
      if (res.success) {
        if (typeof window !== "undefined") {
          try {
            const confetti = (await import("canvas-confetti")).default;
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          } catch {}
        }
        if (onUnlocked && (res.content || res.data?.content)) {
          onUnlocked(res.content || res.data?.content);
        } else {
          window.location.reload();
        }
      } else {
        errorMsg = res.error || "访问密码错误，请重试";
      }
    } catch (err: any) {
      errorMsg = err.message || "网络请求异常";
    } finally {
      loading = false;
    }
  }

  async function handleUnlockPoints() {
    if (!authStore.user) {
      authStore.openAuthModal("login");
      return;
    }

    loading = true;
    errorMsg = "";

    try {
      const res = itemType === "album" ? await albumsApi.unlock(postId) : await postsApi.unlock(postId);
      if (res.success) {
        if (typeof window !== "undefined") {
          try {
            const confetti = (await import("canvas-confetti")).default;
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          } catch {}
        }
        if (authStore.user && res.remainingPoints !== undefined) {
          authStore.user.points = res.remainingPoints;
          authStore.notify();
        }
        if (onUnlocked && (res.content || res.data?.content)) {
          onUnlocked(res.content || res.data?.content);
        } else {
          window.location.reload();
        }
      } else {
        errorMsg = res.error || "解锁失败，请稍后重试";
      }
    } catch (err: any) {
      errorMsg = err.message || "网络请求异常";
    } finally {
      loading = false;
    }
  }
</script>

<div class="my-8 p-8 rounded-3xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 via-surface/40 to-surface/80 backdrop-blur-xl shadow-xl flex flex-col items-center text-center max-w-xl mx-auto transition-all">
  {#if effectiveReason === "password_required"}
    <div class="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-4 ring-1 ring-amber-500/30 shadow-inner">
      <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    </div>
    <h3 class="text-xl font-bold text-on-surface mb-2">受密码保护的内容</h3>
    <p class="text-sm text-on-surface-variant max-w-md mb-4 leading-relaxed">
      本篇内容设有独立访问密码保护。请输入密码完成验证后继续阅读。
    </p>

    {#if passwordHint}
      <div class="mb-4 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 w-full max-w-md">
        <span class="font-semibold">密码提示：</span>{passwordHint}
      </div>
    {/if}

    <form onsubmit={handleVerifyPassword} class="w-full max-w-md flex flex-col gap-3">
      <div class="flex gap-2">
        <input
          type="password"
          bind:value={inputPassword}
          placeholder="请输入访问密码..."
          class="flex-1 px-4 py-2.5 rounded-full border border-outline/30 bg-surface-container-low text-on-surface text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          class="px-6 py-2.5 rounded-full bg-primary text-on-primary font-medium text-sm shadow-md hover:shadow-lg hover:brightness-105 active:scale-95 transition-all disabled:opacity-50 shrink-0"
        >
          {loading ? "验证中..." : "验证密码"}
        </button>
      </div>

      {#if errorMsg}
        <div class="text-xs text-error bg-error/10 border border-error/20 rounded-xl px-4 py-2 w-full">
          {errorMsg}
        </div>
      {/if}
    </form>

  {:else if effectiveReason === "login_required"}
    <div class="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-4 ring-1 ring-amber-500/30 shadow-inner">
      <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    </div>
    <h3 class="text-xl font-bold text-on-surface mb-2">专属会员内容</h3>
    <p class="text-sm text-on-surface-variant max-w-md mb-6 leading-relaxed">
      本篇内容为注册会员专属阅读。只需登录账号，即可畅享完整文章！还没有账号？首位注册立享超级管理员特权。
    </p>
    <div class="flex items-center gap-3">
      <button
        onclick={() => authStore.openAuthModal("login")}
        class="px-6 py-2.5 rounded-full bg-primary text-on-primary font-medium text-sm shadow-md hover:shadow-lg hover:brightness-105 active:scale-95 transition-all"
      >
        立即登录
      </button>
      <button
        onclick={() => authStore.openAuthModal("register")}
        class="px-6 py-2.5 rounded-full border border-outline/30 text-on-surface hover:bg-surface-container font-medium text-sm transition-all"
      >
        免费注册
      </button>
    </div>
  {:else if effectiveReason === "points_required"}
    <div class="w-16 h-16 rounded-2xl bg-purple-500/15 text-purple-500 flex items-center justify-center mb-4 ring-1 ring-purple-500/30 shadow-inner">
      <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
    <h3 class="text-xl font-bold text-on-surface mb-2">积分专享内容</h3>
    <p class="text-sm text-on-surface-variant max-w-md mb-4 leading-relaxed">
      本篇内容需要消耗积分永久解锁。解锁后随时随地无限次畅读！
    </p>

    <!-- Point balance bar -->
    <div class="w-full bg-surface-container-low/70 border border-outline/10 rounded-2xl p-4 mb-6 flex items-center justify-around text-xs md:text-sm">
      <div class="flex flex-col items-center">
        <span class="text-on-surface-variant">解锁所需积分</span>
        <span class="font-bold text-purple-600 dark:text-purple-400 text-lg mt-0.5">{requiredPoints}</span>
      </div>
      <div class="h-8 w-px bg-outline/20"></div>
      <div class="flex flex-col items-center">
        <span class="text-on-surface-variant">您的当前积分</span>
        <span class="font-bold text-on-surface text-lg mt-0.5">{authStore.user?.points ?? userPoints}</span>
      </div>
    </div>

    {#if errorMsg}
      <div class="mb-4 text-xs text-error bg-error/10 border border-error/20 rounded-xl px-4 py-2 w-full">
        {errorMsg}
      </div>
    {/if}

    {#if !authStore.user}
      <button
        onclick={() => authStore.openAuthModal("login")}
        class="px-8 py-3 rounded-full bg-primary text-on-primary font-medium text-sm shadow-md hover:shadow-lg hover:brightness-105 active:scale-95 transition-all"
      >
        登录后解锁阅读
      </button>
    {:else if (authStore.user.points ?? 0) >= requiredPoints}
      <button
        disabled={loading}
        onclick={handleUnlockPoints}
        class="px-8 py-3 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-sm shadow-md hover:shadow-purple-500/25 hover:brightness-105 active:scale-95 transition-all disabled:opacity-50"
      >
        {loading ? "正在解锁中..." : `立即使用 ${requiredPoints} 积分解锁`}
      </button>
    {:else}
      <div class="flex flex-col sm:flex-row items-center gap-3">
        <button
          onclick={() => authStore.openUserDrawer()}
          class="px-6 py-2.5 rounded-full bg-amber-500 text-on-primary font-medium text-sm shadow-md hover:shadow-amber-500/20 active:scale-95 transition-all"
        >
          积分不足？立即每日签到赚积分
        </button>
      </div>
    {/if}
  {/if}
</div>
