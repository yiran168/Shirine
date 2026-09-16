<script lang="ts">
  import { onMount } from "svelte";
  import { getPermissionText } from "../../i18n/permission";
  import { siteConfig } from "../../config/siteConfig";

  interface Props {
    permissionType?: string;
    type?: string;
    requiredPoints?: number;
    points?: number;
    isUnlocked?: boolean;
    class?: string;
    lang?: string;
  }

  let {
    permissionType: pType,
    type,
    requiredPoints: rPoints,
    points,
    isUnlocked = false,
    class: className = "",
    lang: propLang
  }: Props = $props();

  const permissionType = $derived(pType || type || "public");
  const requiredPoints = $derived(rPoints ?? points ?? 0);

  let currentLang = $state(propLang || siteConfig.lang || "zh_CN");

  onMount(() => {
    if (propLang) return;
    if (typeof window !== "undefined") {
      currentLang = localStorage.getItem("shirine_lang") || document.documentElement.lang || siteConfig.lang || "zh_CN";
      const onStorage = (e: StorageEvent) => {
        if (e.key === "shirine_lang" && e.newValue) {
          currentLang = e.newValue;
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
  });

  const t = $derived(getPermissionText(propLang || currentLang));
  const pointsBadgeText = $derived(t.badgePointsRequired.replace("{points}", String(requiredPoints)));
</script>

{#if permissionType === "login_required"}
  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 {className}">
    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
    {t.badgeLoginRequired}
  </span>
{:else if permissionType === "points_required"}
  {#if isUnlocked}
    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 {className}">
      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      {t.badgeUnlocked}
    </span>
  {:else}
    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 {className}">
      <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      {pointsBadgeText}
    </span>
  {/if}
{/if}
