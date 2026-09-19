<script lang="ts">
  import { onMount } from "svelte";
  import { SUPPORTED_LANGUAGES, type LanguageOption } from "../../i18n/adminI18n";
  import { setSiteLang } from "../../i18n/translation";

  let open = $state(false);
  let currentLang = $state("zh_CN");

  onMount(() => {
    if (typeof window !== "undefined") {
      const urlLang = new URL(window.location.href).searchParams.get("lang");
      const stored = urlLang || localStorage.getItem("shirine_lang");
      if (stored) {
        currentLang = stored;
      } else {
        const docLang = document.documentElement.lang.replace("-", "_");
        const found = SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase() === docLang.toLowerCase());
        if (found) currentLang = found.code;
      }
      setSiteLang(currentLang);

      const onDocClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest("#shirine-lang-switch-container")) {
          open = false;
        }
      };
      const onLangChange = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.lang && detail.lang !== currentLang) {
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

  const currentOption = $derived(
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0]
  );

  function toggleDropdown(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function selectLanguage(option: LanguageOption) {
    currentLang = option.code;
    open = false;

    if (typeof window !== "undefined") {
      // 1. LocalStorage persistence
      localStorage.setItem("shirine_lang", option.code);

      // 2. Cookie persistence for SSR
      document.cookie = `shirine_lang=${option.code}; path=/; max-age=31536000; SameSite=Lax`;

      // 3. Document attribute
      document.documentElement.lang = option.code.replace("_", "-");

      // 4. Update memory runtime
      setSiteLang(option.code);

      // 5. Custom event for client-side components
      window.dispatchEvent(
        new CustomEvent("shirine-lang-change", { detail: { lang: option.code } })
      );

      // 6. Reload to update SSR and static components smoothly
      const url = new URL(window.location.href);
      url.searchParams.set("lang", option.code);
      window.location.href = url.toString();
    }
  }
</script>

<div id="shirine-lang-switch-container" class="relative inline-block text-left shrink-0">
  <button
    type="button"
    onclick={toggleDropdown}
    class="flex items-center gap-1.5 h-10 px-2.5 rounded-full text-xs font-semibold text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container)] transition-all border border-transparent hover:border-[var(--outline-variant)]/40 active:scale-95"
    title="Switch Language / 切换语言"
    aria-expanded={open}
    aria-haspopup="true"
  >
    <!-- Language / Translate Icon -->
    <svg class="w-4 h-4 text-[var(--primary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
    <span class="font-medium tracking-wide">{currentOption.label}</span>
    <svg class="w-3.5 h-3.5 opacity-60 transition-transform duration-200 {open ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if open}
    <div
      class="absolute right-0 mt-2 w-36 rounded-2xl bg-[var(--surface-container)] border border-[var(--outline-variant)]/30 shadow-xl py-1.5 z-50 animate-fade-in backdrop-blur-lg"
      role="menu"
    >
      <div class="px-3 py-1 text-[11px] font-semibold text-[var(--outline)] border-b border-[var(--outline-variant)]/20 mb-1">
        Language / 语言
      </div>
      {#each SUPPORTED_LANGUAGES as lang}
        <button
          type="button"
          role="menuitem"
          onclick={() => selectLanguage(lang)}
          class="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors {currentLang === lang.code ? 'bg-primary/10 text-primary font-bold' : 'text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'}"
        >
          <span>{lang.name}</span>
          {#if currentLang === lang.code}
            <svg class="w-3.5 h-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  .animate-fade-in {
    animation: fadeIn 0.15s ease-out forwards;
  }
</style>
