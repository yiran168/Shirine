<script lang="ts">
  import { onMount } from "svelte";
  import { authStore } from "../../stores/auth";
  import { userApi } from "../../services/api";
  import { getUserMenuText } from "../../i18n/userMenu";

  interface Props {
    open: boolean;
    onClose: () => void;
  }

  let { open = $bindable(false), onClose }: Props = $props();

  let avatars: Array<{ id: number; code: string; name: string; prompt: string; url: string; thumbUrl: string }> = $state([]);
  let selectedUrl = $state("");
  let saving = $state(false);
  let currentLang = $state("zh_CN");

  onMount(async () => {
    if (typeof window !== "undefined") {
      currentLang = localStorage.getItem("shirine_lang") || "zh_CN";
    }
    try {
      const res = await fetch("/assets/avatars/avatars.json");
      if (res.ok) {
        avatars = await res.json();
      }
    } catch (e) {
      // Fallback 20 list if json fetch fails
      avatars = Array.from({ length: 20 }, (_, i) => {
        const num = String(i + 1).padStart(2, "0");
        return {
          id: i + 1,
          code: `avatar_${num}`,
          name: `二次元形象 ${num}`,
          prompt: "anime portrait",
          url: `/assets/avatars/avatar_${num}.webp`,
          thumbUrl: `/assets/avatars/avatar_${num}_thumb.webp`,
        };
      });
    }
  });

  $effect(() => {
    if (open && authStore.user) {
      selectedUrl = authStore.user.avatar || (avatars[0]?.url ?? "");
    }
  });

  const t = $derived(getUserMenuText(currentLang));

  async function handleSelect(url: string) {
    selectedUrl = url;
    saving = true;
    try {
      const res = await userApi.updateProfile({ avatar: url });
      if (res.success && authStore.user) {
        authStore.user.avatar = url;
        authStore.notify();
      }
    } catch (err) {
      console.error("Failed to update avatar:", err);
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in">
    <!-- Click backdrop to close -->
    <button
      type="button"
      class="fixed inset-0 w-full h-full cursor-default"
      onclick={onClose}
      aria-label="关闭窗口"
    ></button>

    <!-- Modal Box -->
    <div class="relative w-full max-w-2xl max-h-[85vh] bg-surface border border-outline/20 rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col z-10 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between pb-4 border-b border-outline/10">
        <div>
          <h3 class="text-lg font-bold text-on-surface">{t.selectAvatar}</h3>
          <p class="text-xs text-on-surface-variant mt-0.5">内置 20 款精美二次元预设头像，点击直接切换实时生效</p>
        </div>
        <button
          onclick={onClose}
          class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-all"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Avatar Grid -->
      <div class="flex-1 overflow-y-auto py-5 pr-1 grid grid-cols-4 sm:grid-cols-5 gap-3.5 custom-scrollbar">
        {#each avatars as av}
          {@const isSelected = selectedUrl === av.url}
          <button
            type="button"
            onclick={() => handleSelect(av.url)}
            class="group relative flex flex-col items-center p-2 rounded-2xl border transition-all duration-200 {isSelected ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/30' : 'border-outline/15 hover:border-outline/40 hover:bg-surface-container'}"
          >
            <div class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shadow-sm bg-surface-container-high transition-transform duration-200 group-hover:scale-105">
              <img
                src={av.thumbUrl || av.url}
                alt={av.name}
                class="w-full h-full object-cover"
                loading="lazy"
              />
              {#if isSelected}
                <div class="absolute inset-0 bg-primary/25 flex items-center justify-center backdrop-blur-[1px]">
                  <div class="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              {/if}
            </div>
            <span class="text-[11px] font-medium text-on-surface mt-2 text-center line-clamp-1 group-hover:text-primary transition-colors">
              {av.name}
            </span>
          </button>
        {/each}
      </div>

      <!-- Footer -->
      <div class="pt-4 border-t border-outline/10 flex items-center justify-between">
        <span class="text-xs text-on-surface-variant">
          {#if saving}
            <span class="inline-flex items-center gap-1.5 text-primary">
              <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在保存切换...
            </span>
          {:else}
            已选用二次元专属头像
          {/if}
        </span>
        <button
          onclick={onClose}
          class="px-5 py-2 rounded-xl bg-primary text-on-primary font-semibold text-xs shadow hover:brightness-105 active:scale-95 transition-all"
        >
          {t.confirm}
        </button>
      </div>
    </div>
  </div>
{/if}
