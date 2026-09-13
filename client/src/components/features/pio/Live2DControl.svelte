<script lang="ts">
  import { onMount } from "svelte";

  let visible = $state(true);

  onMount(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("shirine_live2d_visible");
      if (saved !== null) {
        visible = saved === "true";
      }
      applyVisibility(visible);
    }
  });

  function toggle() {
    visible = !visible;
    if (typeof window !== "undefined") {
      localStorage.setItem("shirine_live2d_visible", String(visible));
      applyVisibility(visible);
    }
  }

  function applyVisibility(show: boolean) {
    if (typeof document === "undefined") return;
    const iframe = document.getElementById("l2d-iframe");
    if (iframe) {
      iframe.style.display = show ? "" : "none";
    }
  }
</script>

<div class="fixed bottom-5 right-5 z-40">
  <button
    onclick={toggle}
    class="w-10 h-10 rounded-full bg-surface/80 hover:bg-surface border border-outline/20 text-on-surface shadow-lg backdrop-blur-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
    title={visible ? "隐藏看板娘" : "呼唤看板娘"}
    aria-label={visible ? "隐藏看板娘" : "呼唤看板娘"}
  >
    {#if visible}
      <span class="text-sm group-hover:rotate-12 transition-transform">🌸</span>
    {:else}
      <span class="text-sm opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all">✨</span>
    {/if}
  </button>
</div>
