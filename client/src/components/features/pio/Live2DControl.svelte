<script lang="ts">
  import { onMount, tick } from "svelte";
  import { configApi } from "../../../services/api";

  let { mode = "guest" }: { mode?: "guest" | "admin" } = $props();
  let enabled = $state(false);
  let visible = $state(false);
  let started = $state(false);
  let loaded = $state(false);
  let failed = $state(false);
  let frame: HTMLIFrameElement | undefined = $state();
  let model = $state("/pio/models/NOIR/noir.model3.json");
  let lang = $state("zh_CN");
  let quotes: string[] = [];
  let height = $state(400);
  let x = $state(0);
  let y = $state(44);
  const width = 280;
  const labels = $derived(lang === "en"
    ? { show: "Show mascot", hide: "Hide mascot", loading: "Loading mascot…", retry: "Retry mascot", move: "Drag mascot", talk: "Talk", top: "Back to top" }
    : lang === "ja"
    ? { show: "看板娘を表示", hide: "看板娘を隠す", loading: "読み込み中…", retry: "再読み込み", move: "看板娘を移動", talk: "話す", top: "トップへ" }
    : lang === "zh_TW"
    ? { show: "顯示看板娘", hide: "收起看板娘", loading: "看板娘載入中…", retry: "重試載入看板娘", move: "拖曳看板娘", talk: "互動", top: "回到頂部" }
    : { show: "显示看板娘", hide: "收起看板娘", loading: "看板娘加载中…", retry: "重试加载看板娘", move: "拖动看板娘", talk: "互动", top: "返回顶部" });

  function send(type: string, extra: Record<string, unknown> = {}) {
    frame?.contentWindow?.postMessage({ type, ...extra }, window.location.origin);
  }
  function init(force = false) {
    send("l2d-init", {
      force, lang, quotes,
      config: {
        model: { path: model }, position: "bottom-left", size: { width, height: 360 },
        transitionDuration: 180, transitionType: "fade", _hideAbout: true,
        menus: { items: [
          { icon: "talk", label: labels.talk, action: "talk" },
          { icon: "scrollToTop", label: labels.top, action: "scrollToTop" },
          { icon: "sleep", label: labels.hide, action: "sleep" },
        ] },
      },
    });
  }
  function clampPosition() {
    x = Math.max(0, Math.min(window.innerWidth - width, x));
    y = Math.max(44, Math.min(Math.max(44, window.innerHeight - height), y));
  }
  function persist() {
    try { localStorage.setItem("shirine_live2d_visible", String(visible)); } catch {}
  }
  async function toggle() {
    if (failed) {
      failed = false; loaded = false; visible = true; started = true;
      await tick(); init(true);
    } else {
      visible = !visible;
      if (visible) {
        started = true; await tick();
        if (loaded) send("l2d-wake"); else init();
      }
    }
    persist();
  }
  function drag(event: PointerEvent) {
    const button = event.currentTarget as HTMLElement;
    button.setPointerCapture(event.pointerId);
    let lastX = event.clientX, lastY = event.clientY;
    button.onpointermove = (e) => {
      x += e.clientX - lastX; y -= e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY; clampPosition();
    };
    button.onpointerup = button.onpointercancel = () => {
      button.onpointermove = null;
      try { localStorage.setItem("shirine_live2d_pos", JSON.stringify({ x, y })); } catch {}
    };
  }
  onMount(() => {
    let alive = true;
    try {
      visible = localStorage.getItem("shirine_live2d_visible") === "true" ||
        (localStorage.getItem("shirine_live2d_visible") === null && window.innerWidth >= 768);
      const pos = JSON.parse(localStorage.getItem("shirine_live2d_pos") || "null");
      if (Number.isFinite(pos?.x) && Number.isFinite(pos?.y)) { x = pos.x; y = pos.y; }
    } catch {}
    lang = document.documentElement.lang.replace("-", "_");
    clampPosition();
    const refresh = async () => {
      const res = await (mode === "admin" ? configApi.getAdminSystem() : configApi.getSystem());
      if (!alive) return;
      const conf = res.data || res.config || {};
      enabled = mode === "admin"
        ? Boolean(conf.live2dAdminEnable ?? conf.live2dAdminEnabled ?? conf.live2d?.adminEnabled ?? true)
        : Boolean(conf.live2dGuestEnable ?? conf.live2dGuestEnabled ?? conf.live2d?.guestEnabled ?? true);
      model = conf.live2dModel || conf.live2d?.model || model;
      const configuredQuotes = conf.live2dQuotes ?? conf.live2d?.quotes;
      quotes = Array.isArray(configuredQuotes) ? configuredQuotes : typeof configuredQuotes === "string" ? configuredQuotes.split("\n").filter(Boolean) : [];
      started = started || (enabled && visible);
      await tick(); if (started) init();
    };
    const message = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame?.contentWindow) return;
      if (e.data?.type === "l2d-ready") init();
      if (e.data?.type === "l2d-loaded") { loaded = true; failed = false; height = Math.min(600, Number(e.data.contentHeight) || 400); }
      if (e.data?.type === "l2d-error") { failed = true; loaded = false; }
      if (e.data?.type === "l2d-sleep") { visible = false; persist(); }
      if (e.data?.type === "l2d-drag") { x += Number(e.data.dx) || 0; y -= Number(e.data.dy) || 0; clampPosition(); }
      if (e.data?.type === "l2d-action" && e.data.action === "scrollToTop") window.scrollTo({ top: 0, behavior: "smooth" });
    };
    const language = (e: Event) => { lang = (e as CustomEvent).detail?.lang || lang; init(); };
    window.addEventListener("message", message);
    window.addEventListener("resize", clampPosition);
    window.addEventListener("shirine-lang-change", language);
    window.addEventListener("shirine-config-updated", refresh);
    void refresh();
    return () => {
      alive = false;
      window.removeEventListener("message", message);
      window.removeEventListener("resize", clampPosition);
      window.removeEventListener("shirine-lang-change", language);
      window.removeEventListener("shirine-config-updated", refresh);
    };
  });
</script>

{#if enabled}
  <button type="button" class="mascot-toggle m3-state-layer" onclick={toggle}
    aria-expanded={visible} aria-controls="shirine-mascot" title={failed ? labels.retry : visible ? labels.hide : labels.show}>
    <span aria-hidden="true">✦</span><span>{failed ? labels.retry : visible ? labels.hide : labels.show}</span>
  </button>
  {#if started}
    <div id="shirine-mascot" class="mascot" style:left={`${x}px`} style:bottom={`${y}px`} hidden={!visible}>
      <iframe bind:this={frame} src="/pio/live2d-host.html" onload={() => init()} title="Shirine Live2D"
        style:width={`${width}px`} style:height={`${height}px`} style:opacity={loaded ? 1 : 0}></iframe>
      {#if !loaded}<p role="status">{failed ? labels.retry : labels.loading}</p>{/if}
      {#if loaded}<button type="button" class="mascot-drag" onpointerdown={drag} title={labels.move} aria-label={labels.move}>⠿</button>{/if}
    </div>
  {/if}
{/if}

<style>
  .mascot-toggle { position: fixed; left: 0; bottom: env(safe-area-inset-bottom, 0px); z-index: 90; min-height: 44px; display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid var(--outline-variant); border-radius: 0 16px 0 0; background: var(--surface-container-high, #e9e7ef); color: var(--on-surface, #222); cursor: pointer; }
  .mascot-toggle:active { transform: scale(.97); }
  .mascot { position: fixed; z-index: 89; pointer-events: none; }
  .mascot[hidden] { display: none; }
  iframe { border: 0; display: block; pointer-events: auto; }
  p { position: absolute; bottom: 10px; padding: 8px; border-radius: 12px; background: var(--surface-container-high); color: var(--on-surface); font-size: 12px; }
  .mascot-drag { position: absolute; bottom: 0; left: 0; width: 44px; height: 44px; border-radius: 50%; background: var(--surface-container); color: var(--on-surface); pointer-events: auto; touch-action: none; cursor: grab; }
</style>
