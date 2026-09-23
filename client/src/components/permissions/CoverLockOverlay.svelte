<script lang="ts">
  import { onMount } from "svelte";
  import { authStore } from "../../stores/auth";
  import { getPermissionText } from "../../i18n/permission";
  import { siteConfig } from "../../config/siteConfig";

  interface Props {
    permissionType?: string;
    type?: string;
    requiredPoints?: number;
    points?: number;
    isUnlocked?: boolean;
    lang?: string;
    class?: string;
  }

  let {
    permissionType: pType,
    type,
    requiredPoints: rPoints,
    points,
    isUnlocked = false,
    lang: propLang,
    class: className = "",
  }: Props = $props();

  const permissionType = $derived(pType || type || "public");
  const requiredPoints = $derived(rPoints ?? points ?? 0);
  const isAdmin = $derived(authStore.user?.role === "admin" || authStore.user?.role === "superadmin");

  let currentLang = $state(propLang || siteConfig.lang || "zh_CN");

  onMount(() => {
    if (propLang) return;
    if (typeof window !== "undefined") {
      currentLang = localStorage.getItem("shirine_lang") || document.documentElement.lang?.replace("-", "_") || siteConfig.lang || "zh_CN";
      const onStorage = (e: StorageEvent) => {
        if (e.key === "shirine_lang" && e.newValue) {
          currentLang = e.newValue;
        }
      };
      const onLangChange = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.lang) {
          currentLang = detail.lang;
        }
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener("shirine-lang-change", onLangChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener("shirine-lang-change", onLangChange);
      };
    }
  });

  const t = $derived(getPermissionText(propLang || currentLang));
  const pointsText = $derived(t.overlayPointsRequired.replace("{points}", String(requiredPoints)));
</script>

{#if !isUnlocked && !isAdmin}
  <div class="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 bg-black/45 backdrop-blur-md rounded-2xl transition-all duration-300 group-hover:bg-black/55 select-none {className}">
    {#if permissionType === "login_required"}
      <div class="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mb-2 shadow-lg ring-1 ring-amber-400/30">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <span class="text-white text-xs md:text-sm font-medium tracking-wide drop-shadow">{t.overlayLoginRequired}</span>
    {:else if permissionType === "points_required"}
      <div class="w-12 h-12 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center mb-2 shadow-lg ring-1 ring-purple-400/30">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <span class="text-white text-xs md:text-sm font-medium tracking-wide drop-shadow">{pointsText}</span>
    {:else}
      <div class="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mb-2 shadow-lg ring-1 ring-amber-400/30">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <span class="text-white text-xs md:text-sm font-medium tracking-wide drop-shadow">{t.overlayPasswordRequired || "密码保护"}</span>
    {/if}
  </div>
{/if}
