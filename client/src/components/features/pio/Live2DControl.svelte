<script lang="ts">
  import { onMount } from "svelte";
  import { configApi } from "../../../services/api";

  interface Props {
    mode?: "guest" | "admin";
  }

  let { mode = "guest" }: Props = $props();

  let enabledByBackend = $state(true);
  let userVisible = $state(true);
  let modelPath = $state("/pio/models/NOIR/noir.model3.json");
  let iframeEl: HTMLIFrameElement | null = $state(null);
  let isLoaded = $state(false);
  let iframeHeight = $state(500);

  const WIDGET_WIDTH = 280;

  let posX = $state(0);
  let posY = $state(0);
  let isDragging = $state(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let initialPosX = 0;
  let initialPosY = 0;
  let live2dLang = $state("zh_CN");
  let live2dQuotes = $state<string[]>([]);

  onMount(async () => {
    if (typeof window === "undefined") return;

    // 1. Check user local preference
    const saved = localStorage.getItem("shirine_live2d_visible");
    if (saved !== null) {
      userVisible = saved === "true";
    } else if (window.innerWidth < 768) {
      userVisible = false; // Collapse by default on narrow mobile screens to avoid screen blockage
    }

    const defaultRightX = Math.max(0, window.innerWidth - WIDGET_WIDTH - 24);
    const defaultY = 24;
    posX = defaultRightX;
    posY = defaultY;

    const savedPos = localStorage.getItem("shirine_live2d_pos");
    if (savedPos) {
      try {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed.x === "number" && !isNaN(parsed.x)) posX = Math.max(0, Math.min(window.innerWidth - WIDGET_WIDTH, parsed.x));
        if (typeof parsed.y === "number" && !isNaN(parsed.y)) posY = Math.max(0, Math.min(window.innerHeight - 100, parsed.y));
      } catch {
        posX = defaultRightX;
        posY = defaultY;
      }
    }

    // 2. Fetch backend configuration
    try {
      if (mode === "admin") {
        const res = await configApi.getAdminSystem();
        const conf = res.data || res.config;
        enabledByBackend = Boolean(conf?.live2dAdminEnable ?? conf?.live2dAdminEnabled ?? conf?.live2d?.adminEnabled ?? true);
        if (conf?.live2dModel || conf?.live2d?.model) {
          modelPath = conf.live2dModel || conf.live2d?.model;
        }
        if (conf?.live2dLang) {
          live2dLang = conf.live2dLang;
        }
        if (conf?.live2dQuotes) {
          live2dQuotes = Array.isArray(conf.live2dQuotes) ? conf.live2dQuotes : [conf.live2dQuotes];
        }
      } else {
        const res = await configApi.getSystem();
        const conf = res.data || res.config;
        enabledByBackend = Boolean(conf?.live2dGuestEnable ?? conf?.live2dGuestEnabled ?? conf?.live2d?.guestEnabled ?? true);
        if (conf?.live2dModel || conf?.live2d?.model) {
          modelPath = conf.live2dModel || conf.live2d?.model;
        }
        if (conf?.live2dLang) {
          live2dLang = conf.live2dLang;
        }
        if (conf?.live2dQuotes) {
          live2dQuotes = Array.isArray(conf.live2dQuotes) ? conf.live2dQuotes : [conf.live2dQuotes];
        }
      }
    } catch {
      enabledByBackend = true;
    }
    initWidget();

    // 3. Setup message listener for live2d-host.html
    const handleMessage = (e: MessageEvent) => {
      if (!iframeEl || e.source !== iframeEl.contentWindow) return;

      if (e.data?.type === "l2d-loaded") {
        isLoaded = true;
        iframeHeight = e.data.contentHeight || 500;
      } else if (e.data?.type === "l2d-sleep") {
        userVisible = false;
        if (typeof window !== "undefined") {
          localStorage.setItem("shirine_live2d_visible", "false");
        }
      } else if (e.data?.type === "l2d-action") {
        if (e.data.action === "home") {
          window.location.href = "/";
        } else if (e.data.action === "scrollToTop") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else if (e.data?.type === "l2d-drag") {
        posX = Math.max(0, Math.min(window.innerWidth - WIDGET_WIDTH, posX + (e.data.dx || 0)));
        posY = Math.max(0, Math.min(window.innerHeight - 100, posY - (e.data.dy || 0)));
        localStorage.setItem("shirine_live2d_pos", JSON.stringify({ x: posX, y: posY }));
      }
    };

    window.addEventListener("message", handleMessage);

    // 4. Setup window resize listener
    const handleResize = () => {
      const maxX = Math.max(0, window.innerWidth - WIDGET_WIDTH - 24);
      if (posX > maxX) {
        posX = maxX;
      }
    };
    window.addEventListener("resize", handleResize);

    // 5. Setup Swup listener if present
    const onVisitEnd = () => {
      initWidget();
    };
    if ((window as any).swup?.hooks) {
      (window as any).swup.hooks.on("visit:end", onVisitEnd);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("resize", handleResize);
      if ((window as any).swup?.hooks) {
        try {
          (window as any).swup.hooks.off("visit:end", onVisitEnd);
        } catch {}
      }
    };
  });

  function startDrag(e: MouseEvent | TouchEvent) {
    isDragging = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartX = clientX;
    dragStartY = clientY;
    initialPosX = posX;
    initialPosY = posY;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const curX = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
      const curY = "touches" in ev ? ev.touches[0].clientY : ev.clientY;
      const deltaX = curX - dragStartX;
      const deltaY = dragStartY - curY;
      posX = Math.max(0, Math.min(window.innerWidth - WIDGET_WIDTH, initialPosX + deltaX));
      posY = Math.max(0, Math.min(window.innerHeight - 100, initialPosY + deltaY));
    };

    const onEnd = () => {
      isDragging = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      localStorage.setItem("shirine_live2d_pos", JSON.stringify({ x: posX, y: posY }));
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onEnd);
  }

  function initWidget(force = false) {
    if (!iframeEl || !iframeEl.contentWindow) return;
    const widgetConfig = {
      model: { path: modelPath },
      position: "bottom-left",
      size: WIDGET_WIDTH,
      transitionDuration: 1500,
      transitionType: "slide",
      _hideAbout: true,
      menus: {
        items: [
          { icon: "talk", label: "互动", action: "talk" },
          { icon: "scrollToTop", label: "返回顶部", action: "scrollToTop" },
          { icon: "sleep", label: "收起", action: "sleep" },
        ],
      },
    };

    iframeEl.contentWindow.postMessage({ type: "l2d-init", config: widgetConfig, lang: live2dLang, quotes: live2dQuotes, force }, "*");
  }

  function handleIframeLoad() {
    initWidget();
  }

  function toggleVisible() {
    userVisible = !userVisible;
    if (typeof window !== "undefined") {
      localStorage.setItem("shirine_live2d_visible", String(userVisible));
    }
    if (userVisible) {
      if (iframeEl?.contentWindow) {
        iframeEl.contentWindow.postMessage({ type: "l2d-wake" }, "*");
      }
      initWidget(true);
    }
  }

  const shouldShow = $derived(enabledByBackend && userVisible);
</script>

{#if enabledByBackend}
  <!-- Draggable Live2D Container with supreme stacking priority -->
  <div
    class="fixed select-none pointer-events-none"
    style="z-index: 99999 !important; left: {posX}px; bottom: {posY}px;"
  >
    <!-- Live2D Host Iframe (Sandboxed) -->
    <iframe
      bind:this={iframeEl}
      id="l2d-iframe"
      src="/pio/live2d-host.html"
      onload={handleIframeLoad}
      title="Shirine Live2D 看板娘"
      allowtransparency="true"
      class="border-none transition-opacity duration-300 block"
      style="width: {WIDGET_WIDTH}px; height: {iframeHeight}px; opacity: {shouldShow && isLoaded ? '1' : '0'}; pointer-events: {shouldShow && isLoaded ? 'auto' : 'none'}; visibility: {shouldShow ? 'visible' : 'hidden'};"
    ></iframe>

    <!-- Drag Handle and Toggle Button Bar with supreme z-index -->
    <div
      class="absolute bottom-4 left-4 flex items-center gap-1.5 pointer-events-auto"
      style="z-index: 99999 !important;"
    >
      <!-- Toggle Visibility Button -->
      <button
        type="button"
        onclick={toggleVisible}
        class="w-9 h-9 rounded-full bg-[var(--surface-container-high)]/90 hover:bg-[var(--surface-container)] border border-[var(--outline-variant)]/40 text-[var(--on-surface)] shadow-md hover:shadow-lg backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 group focus:outline-none"
        title={userVisible ? "收起看板娘" : "呼唤看板娘"}
        aria-label={userVisible ? "收起看板娘" : "呼唤看板娘"}
      >
        {#if userVisible}
          <span class="text-sm group-hover:rotate-12 transition-transform select-none">🌸</span>
        {:else}
          <span class="text-sm opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all select-none">✨</span>
        {/if}
      </button>

      <!-- Move / Drag Handle Button -->
      {#if shouldShow && isLoaded}
        <button
          type="button"
          onmousedown={startDrag}
          ontouchstart={startDrag}
          class="w-8 h-8 rounded-full bg-[var(--surface-container-high)]/80 hover:bg-[var(--surface-container)] border border-[var(--outline-variant)]/40 text-[var(--on-surface-variant)] hover:text-[var(--primary)] shadow-sm backdrop-blur-md flex items-center justify-center cursor-move transition-all active:scale-90"
          title="按住拖拽看板娘位置"
          aria-label="按住拖拽看板娘位置"
        >
          <svg class="w-4 h-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
          </svg>
        </button>
      {/if}
    </div>
  </div>
{/if}
