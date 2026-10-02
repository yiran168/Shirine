<script lang="ts">
  import { onMount, tick } from "svelte";
  import { configApi } from "../../services/api";
  import { loadTurnstile, type TurnstileClient } from "../../utils/turnstile-client";
  let { token = $bindable(""), ready = $bindable(false), resetKey = 0 }:
    { token?: string; ready?: boolean; resetKey?: number } = $props();
  let enabled = $state(false);
  let busy = $state(true);
  let error = $state("");
  let container: HTMLDivElement;
  let client: TurnstileClient | undefined;
  let widget: string | undefined;
  let alive = false;
  let generation = 0;
  let sizeObserver: ResizeObserver | undefined;
  function remove() { sizeObserver?.disconnect(); sizeObserver = undefined; if (widget !== undefined) { client?.remove(widget); widget = undefined; } }
  async function initialize() {
    const attempt = ++generation;
    ready = false; token = ""; error = ""; busy = true;
    remove();
    try {
      const result = await configApi.getSystem();
      if (!alive || attempt !== generation) return;
      if (!result.success) throw new Error("无法读取人机验证设置，请重试");
      const config = result.data || result.config || {};
      enabled = Boolean(config.turnstileEnabled);
      if (!enabled) { ready = true; return; }
      if (!config.turnstileSiteKey) throw new Error("人机验证站点密钥未配置，请联系站长");
      await tick();
      client = await loadTurnstile();
      if (!alive || attempt !== generation) return;
      const compact = container.clientWidth < 300;
      widget = client.render(container, {
        sitekey: config.turnstileSiteKey, theme: "auto", size: compact ? "compact" : "flexible",
        callback: (value: string) => { if (alive && attempt === generation) { token = value; ready = true; error = ""; } },
        "expired-callback": () => { if (alive && attempt === generation) { token = ""; ready = false; } },
        "error-callback": () => { if (alive && attempt === generation) { token = ""; ready = false; error = "人机验证未完成，请重试；如持续失败，请核对站点域名配置"; } },
      });
      sizeObserver = new ResizeObserver(() => {
        if (alive && attempt === generation && (container.clientWidth < 300) !== compact) void initialize();
      });
      sizeObserver.observe(container);
    } catch (err) { if (alive && attempt === generation) error = err instanceof Error ? err.message : "人机验证加载失败"; }
    finally { if (alive && attempt === generation) busy = false; }
  }
  $effect(() => {
    void resetKey;
    if (widget !== undefined) { token = ""; ready = false; error = ""; client?.reset(widget); }
  });
  onMount(() => { alive = true; void initialize(); return () => { alive = false; generation++; remove(); token = ""; ready = false; }; });
</script>

<div class="turnstile-gate">
  {#if enabled}<div bind:this={container} class="turnstile-container"></div>{/if}
  {#if busy}<p role="status">正在加载安全验证…</p>{/if}
  {#if error}<p role="alert">{error}</p><button type="button" onclick={initialize}>重新加载验证</button>{/if}
</div>
<style>
  .turnstile-gate { width: 100%; text-align: center; font-size: 12px; color: var(--on-surface-variant); }
  .turnstile-container { min-height: 65px; width: 100%; }
  p { margin-block: 8px; }
  [role="alert"] { color: var(--error); }
  button { padding: 8px 12px; border-radius: 10px; color: var(--primary); cursor: pointer; }
</style>
