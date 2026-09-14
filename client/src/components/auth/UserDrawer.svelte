<script lang="ts">
  import { authStore } from "../../stores/auth";
  import { userApi } from "../../services/api";

  let checkinLoading = $state(false);
  let checkinMsg = $state("");

  async function handleCheckin() {
    if (!authStore.user || checkinLoading) return;
    checkinLoading = true;
    checkinMsg = "";

    try {
      const res = await userApi.checkin();
      if (res.success) {
        checkinMsg = `打卡成功！获得 +${res.pointsAwarded} 积分`;
        authStore.user.points = res.currentPoints;
        authStore.user.checkinStreak = res.checkinStreak;
        authStore.user.checkedInToday = true;
        authStore.notify();

        if (typeof window !== "undefined") {
          try {
            const confetti = (await import("canvas-confetti")).default;
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
          } catch {}
        }
      } else {
        checkinMsg = res.error || "打卡失败，请稍后重试";
      }
    } catch (err: any) {
      checkinMsg = err.message || "打卡异常";
    } finally {
      checkinLoading = false;
    }
  }
</script>

{#if authStore.userDrawerOpen && authStore.user}
  <div class="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in">
    <!-- Click backdrop to close -->
    <button
      type="button"
      class="fixed inset-0 w-full h-full cursor-default"
      onclick={() => authStore.closeUserDrawer()}
      aria-label="关闭面板"
    ></button>

    <!-- Slide Drawer -->
    <div class="relative w-full max-w-sm h-full bg-surface border-l border-outline/15 shadow-2xl p-6 flex flex-col z-10 transition-transform">
      <!-- Top header with close -->
      <div class="flex items-center justify-between pb-4 border-b border-outline/10">
        <h3 class="text-base font-bold text-on-surface">个人中心</h3>
        <button
          onclick={() => authStore.closeUserDrawer()}
          class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- User Profile Card -->
      <div class="my-6 flex items-center gap-4">
        <div class="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary text-xl font-bold overflow-hidden shadow-md">
          {#if authStore.user.avatar}
            <img src={authStore.user.avatar} alt={authStore.user.username} class="w-full h-full object-cover" />
          {:else}
            {authStore.user.username.slice(0, 1).toUpperCase()}
          {/if}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h4 class="text-lg font-bold text-on-surface">{authStore.user.nickname || authStore.user.username}</h4>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider {authStore.user.role === 'superadmin' ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30' : authStore.user.role === 'admin' ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30' : 'bg-surface-container-high text-on-surface-variant'}">
              {authStore.user.role === 'superadmin' ? '超级管理员' : authStore.user.role === 'admin' ? '管理员' : '普通用户'}
            </span>
          </div>
          <p class="text-xs text-on-surface-variant/80 mt-0.5">@{authStore.user.username}</p>
        </div>
      </div>

      <!-- Points & Assets Card -->
      <div class="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-primary/10 border border-primary/20 shadow-inner mb-6">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-on-surface-variant font-medium">当前积分资产</span>
          <span class="text-xs text-purple-600 dark:text-purple-400 font-semibold">连续打卡 {authStore.user.checkinStreak} 天</span>
        </div>
        <div class="flex items-baseline gap-1">
          <span class="text-3xl font-black text-on-surface tracking-tight">{authStore.user.points}</span>
          <span class="text-xs font-semibold text-on-surface-variant">Points</span>
        </div>
      </div>

      <!-- Daily Checkin Action -->
      <div class="mb-6">
        {#if checkinMsg}
          <div class="mb-3 text-xs text-center font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 py-2 rounded-xl border border-emerald-500/20">
            {checkinMsg}
          </div>
        {/if}

        {#if authStore.user.checkedInToday}
          <button
            disabled
            class="w-full py-3 rounded-2xl bg-surface-container text-on-surface-variant font-medium text-sm border border-outline/10 flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
          >
            <svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            今日已打卡（明天继续）
          </button>
        {:else}
          <button
            disabled={checkinLoading}
            onclick={handleCheckin}
            class="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg hover:shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            {checkinLoading ? "正在签到中..." : "每日签到打卡赚积分"}
          </button>
        {/if}
      </div>

      <!-- Quick Navigations -->
      <div class="space-y-2 flex-1">
        {#if authStore.user.role === "superadmin" || authStore.user.role === "admin"}
          <a
            href="/admin"
            class="w-full flex items-center justify-between p-3.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-sm border border-purple-500/20 hover:bg-purple-500/15 transition-all"
          >
            <span class="flex items-center gap-2.5">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              进入全量管理后台
            </span>
            <span class="text-xs">→</span>
          </a>
        {/if}
      </div>

      <!-- Logout button -->
      <div class="pt-4 border-t border-outline/10">
        <button
          onclick={() => authStore.logout()}
          class="w-full py-2.5 rounded-xl border border-error/20 text-error hover:bg-error/10 font-medium text-sm transition-all flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          退出当前登录
        </button>
      </div>
    </div>
  </div>
{/if}
