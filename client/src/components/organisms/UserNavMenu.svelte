<script lang="ts">
  import { onMount } from "svelte";
  import { authStore } from "../../stores/auth";
  import { userApi } from "../../services/api";
  import { getUserMenuText } from "../../i18n/userMenu";
  import AvatarModal from "../auth/AvatarModal.svelte";

  let menuOpen = $state(false);
  let avatarModalOpen = $state(false);
  let checkinLoading = $state(false);
  let checkinToast = $state<{ show: boolean; msg: string }>({ show: false, msg: "" });
  let currentLang = $state("zh_CN");

  onMount(() => {
    if (typeof window !== "undefined") {
      currentLang = localStorage.getItem("shirine_lang") || "zh_CN";
      const onDocClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest("#shirine-user-nav-container")) {
          menuOpen = false;
        }
      };
      const onLangChange = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.lang) {
          currentLang = detail.lang;
        }
      };
      document.addEventListener("click", onDocClick);
      window.addEventListener("shirine-lang-change", onLangChange);
      return () => {
        document.removeEventListener("click", onDocClick);
        window.removeEventListener("shirine-lang-change", onLangChange);
      };
    }
  });

  const t = $derived(getUserMenuText(currentLang));

  // Determine user identity
  // 1: guest (not logged in), 2: normal user, 3: admin
  const isGuest = $derived(!authStore.user);
  const isAdmin = $derived(authStore.user && (authStore.user.role === "superadmin" || authStore.user.role === "admin"));
  const isNormalUser = $derived(authStore.user && authStore.user.role !== "superadmin" && authStore.user.role !== "admin");

  function toggleMenu(e: MouseEvent) {
    e.stopPropagation();
    menuOpen = !menuOpen;
  }

  function handleLogin() {
    menuOpen = false;
    authStore.openAuthModal("login");
  }

  function handleRegister() {
    menuOpen = false;
    authStore.openAuthModal("register");
  }

  function handleChangeAvatar() {
    menuOpen = false;
    avatarModalOpen = true;
  }

  async function handleCheckin() {
    if (!authStore.user || authStore.user.checkedInToday || checkinLoading) return;
    checkinLoading = true;

    try {
      const res = await userApi.checkin();
      if (res.success) {
        authStore.user.points = res.currentPoints;
        authStore.user.checkinStreak = res.checkinStreak;
        authStore.user.checkedInToday = true;
        authStore.notify();

        showToast(t.checkinSuccess.replace("{points}", String(res.pointsAwarded)));

        if (typeof window !== "undefined") {
          try {
            const confetti = (await import("canvas-confetti")).default;
            confetti({ particleCount: 70, spread: 60, origin: { y: 0.2 } });
          } catch {}
        }
      } else {
        showToast(res.error || "签到失败");
      }
    } catch (err: any) {
      showToast(err.message || "打卡异常");
    } finally {
      checkinLoading = false;
    }
  }

  function showToast(msg: string) {
    checkinToast = { show: true, msg };
    setTimeout(() => {
      checkinToast = { show: false, msg: "" };
    }, 3500);
  }

  async function handleLogout() {
    menuOpen = false;
    await authStore.logout();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }
</script>

<div id="shirine-user-nav-container" class="relative inline-flex items-center select-none">
  <!-- Avatar Button -->
  <button
    type="button"
    onclick={toggleMenu}
    class="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center border border-[var(--outline-variant)]/40 hover:border-primary/60 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 group bg-[var(--surface-container-high)]/80 backdrop-blur-md"
    aria-label="用户菜单"
    aria-expanded={menuOpen}
  >
    {#if isGuest}
      <!-- Guest default icon -->
      <div class="w-full h-full flex items-center justify-center text-[var(--on-surface)] group-hover:text-primary transition-colors bg-[var(--surface-container-high)]/60">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
    {:else}
      <!-- Logged in Avatar -->
      {#if authStore.user?.avatar}
        <img
          src={authStore.user.avatar}
          alt={authStore.user.username}
          class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
      {:else}
        <div class="w-full h-full flex items-center justify-center bg-primary/20 text-primary text-sm font-bold">
          {authStore.user?.username.slice(0, 1).toUpperCase()}
        </div>
      {/if}
    {/if}
  </button>

  <!-- Dropdown Menu -->
  {#if menuOpen}
    <div
      class="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-[var(--surface-container-low)] border border-outline/15 shadow-[var(--m3e-elevation-2)] backdrop-blur-xl p-1.5 z-50 transition-all duration-150 animate-fade-in text-sm font-medium"
      role="menu"
    >
      <!-- STATE 1: GUEST / NOT LOGGED IN -->
      {#if isGuest}
        <button
          type="button"
          onclick={handleLogin}
          class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-on-surface hover:bg-[var(--surface-container-high)] hover:text-primary transition-all text-left group"
          role="menuitem"
        >
          <svg class="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          {t.signIn}
        </button>

        <button
          type="button"
          onclick={handleRegister}
          class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-on-surface hover:bg-[var(--surface-container-high)] hover:text-primary transition-all text-left group"
          role="menuitem"
        >
          <svg class="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          {t.signUp}
        </button>
      {/if}

      <!-- STATE 2: NORMAL LOGGED-IN USER -->
      {#if isNormalUser}
        <!-- User summary header -->
        <div class="px-3.5 py-2 border-b border-outline/10 mb-1">
          <div class="text-xs font-bold text-on-surface truncate">{authStore.user?.nickname || authStore.user?.username}</div>
          <div class="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">{authStore.user?.points ?? 0} Points</div>
        </div>

        <!-- ① Daily checkin -->
        <button
          type="button"
          disabled={authStore.user?.checkedInToday || checkinLoading}
          onclick={handleCheckin}
          class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all group {authStore.user?.checkedInToday ? 'opacity-50 text-on-surface-variant cursor-not-allowed bg-transparent' : 'text-on-surface hover:bg-[var(--surface-container-high)] hover:text-amber-500'}"
          role="menuitem"
        >
          <span class="flex items-center gap-2.5">
            <svg class="w-4 h-4 {authStore.user?.checkedInToday ? 'text-emerald-500' : 'text-amber-500'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {#if authStore.user?.checkedInToday}
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              {:else}
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              {/if}
            </svg>
            {authStore.user?.checkedInToday ? t.checkedInToday : t.dailyCheckin}
          </span>
          {#if !authStore.user?.checkedInToday}
            <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          {/if}
        </button>

        <!-- ② Change avatar -->
        <button
          type="button"
          onclick={handleChangeAvatar}
          class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-on-surface hover:bg-[var(--surface-container-high)] hover:text-primary transition-all text-left group"
          role="menuitem"
        >
          <svg class="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {t.changeAvatar}
        </button>

        <div class="h-px bg-outline/10 my-1"></div>

        <!-- ③ Sign out -->
        <button
          type="button"
          onclick={handleLogout}
          class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-error/90 hover:bg-error/10 hover:text-error transition-all text-left group"
          role="menuitem"
        >
          <svg class="w-4 h-4 text-error/80 group-hover:text-error transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t.signOut}
        </button>
      {/if}

      <!-- STATE 3: ADMIN LOGGED-IN -->
      {#if isAdmin}
        <!-- Admin summary header -->
        <div class="px-3.5 py-2 border-b border-outline/10 mb-1">
          <div class="text-xs font-bold text-on-surface truncate">{authStore.user?.nickname || authStore.user?.username}</div>
          <div class="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Super Admin</div>
        </div>

        <!-- ① Admin panel -->
        <a
          href="/admin"
          class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-on-surface hover:bg-[var(--surface-container-high)] hover:text-purple-600 dark:hover:text-purple-400 transition-all text-left group"
          role="menuitem"
        >
          <svg class="w-4 h-4 text-on-surface-variant group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {t.adminPanel}
        </a>

        <!-- ② Change avatar -->
        <button
          type="button"
          onclick={handleChangeAvatar}
          class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-on-surface hover:bg-[var(--surface-container-high)] hover:text-primary transition-all text-left group"
          role="menuitem"
        >
          <svg class="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {t.changeAvatar}
        </button>

        <div class="h-px bg-outline/10 my-1"></div>

        <!-- ③ Sign out -->
        <button
          type="button"
          onclick={handleLogout}
          class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-error/90 hover:bg-error/10 hover:text-error transition-all text-left group"
          role="menuitem"
        >
          <svg class="w-4 h-4 text-error/80 group-hover:text-error transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t.signOut}
        </button>
      {/if}
    </div>
  {/if}
</div>

<!-- Avatar Selector Modal -->
<AvatarModal open={avatarModalOpen} onClose={() => (avatarModalOpen = false)} />

<!-- Toast popup for checkin -->
{#if checkinToast.show}
  <div class="fixed top-20 right-5 z-50 px-4 py-2.5 rounded-2xl bg-surface border border-primary/30 shadow-xl text-xs font-semibold text-primary flex items-center gap-2 backdrop-blur-md animate-fade-in">
    <span>✨</span>
    <span>{checkinToast.msg}</span>
  </div>
{/if}
