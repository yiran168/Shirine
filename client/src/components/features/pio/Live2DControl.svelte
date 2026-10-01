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
  let bounds = $state({ x: 60, y: 150, width: 160, height: 210 });
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
        menus: { items: [] },
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
  function savePosition() {
    try { localStorage.setItem("shirine_live2d_pos", JSON.stringify({ x, y })); } catch {}
  }
  function drag(event: PointerEvent) {
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const startX = event.clientX, startY = event.clientY;
    const originX = x, originY = y;
    let moved = false;
    target.onpointermove = e => {
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > 4) moved = true;
      if (moved) { x = originX + dx; y = originY - dy; clampPosition(); }
    };
    target.onpointerup = e => {
      target.onpointermove = null;
      target.releasePointerCapture(e.pointerId);
      if (moved) savePosition(); else send("l2d-talk");
    };
    target.onpointercancel = () => { target.onpointermove = null; savePosition(); };
  }
  function moveWithKeyboard(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); send("l2d-talk"); }
    const moves: Record<string, number[]> = { ArrowLeft: [-10,0], ArrowRight: [10,0], ArrowUp: [0,10], ArrowDown: [0,-10] };
    if (moves[event.key]) { event.preventDefault(); x += moves[event.key][0]; y += moves[event.key][1]; clampPosition(); savePosition(); }
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
      if (e.data?.type === "l2d-bounds") {
        const b = e.data.bounds;
        if ([b?.x, b?.y, b?.width, b?.height].every(Number.isFinite)) bounds = b;
      }
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
  <button type="button" class="mascot-toggle" onclick={toggle}
    aria-expanded={visible} aria-controls="shirine-mascot" aria-label={failed ? labels.retry : visible ? labels.hide : labels.show}
    title={failed ? labels.retry : visible ? labels.hide : labels.show}>
    <span aria-hidden="true">✦</span>
  </button>
  {#if started}
    <div id="shirine-mascot" class="mascot" class:mascot-hidden={!visible} style:left={x + "px"} style:bottom={y + "px"} aria-hidden={!visible}>
      <iframe bind:this={frame} src="/pio/live2d-host.html" onload={() => init()} title="Shirine Live2D" tabindex="-1"
        style:width={width + "px"} style:height={height + "px"} style:opacity={loaded ? 1 : 0}></iframe>
      {#if !loaded}<p role="status">{failed ? labels.retry : labels.loading}</p>{/if}
      {#if loaded}
        <div class="mascot-body" role="img" aria-label={labels.move} title={labels.move}
          tabindex={visible ? 0 : -1} onpointerdown={drag} onkeydown={moveWithKeyboard}
          style:left={bounds.x + "px"} style:top={bounds.y + "px"} style:width={bounds.width + "px"} style:height={bounds.height + "px"}></div>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .mascot-toggle { position: fixed; left: 0; bottom: env(safe-area-inset-bottom, 0px); z-index: 90; width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--on-surface, #444); opacity: .18; cursor: pointer; transition: opacity 450ms ease, background-color 450ms ease, transform 220ms ease; }
  .mascot-toggle span { font-size: 21px; }
  .mascot-toggle:hover, .mascot-toggle:focus-visible { opacity: .85; background: color-mix(in oklab, var(--surface-container, #eee) 80%, transparent); }
  .mascot-toggle:active { transform: scale(.92); }
  .mascot { position: fixed; z-index: 89; pointer-events: none; opacity: 1; visibility: visible; transition: opacity 350ms ease, visibility 0s; }
  .mascot-hidden { opacity: 0; visibility: hidden; transition: opacity 350ms ease, visibility 0s 350ms; }
  iframe { border: 0; display: block; pointer-events: none; }
  p { position: absolute; bottom: 10px; padding: 8px; border-radius: 12px; background: var(--surface-container-high); color: var(--on-surface); font-size: 12px; }
  .mascot-body { position: absolute; pointer-events: auto; touch-action: none; cursor: grab; border-radius: 40% 40% 8% 8%; }
  .mascot-body:active { cursor: grabbing; }
  .mascot-hidden .mascot-body { pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { .mascot, .mascot-toggle { transition-duration: .01ms; } }
</style>
