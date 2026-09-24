<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    size?: number;
    text?: string;
    overlay?: boolean;
  }

  let { size = 320, text = "加载中…", overlay = false }: Props = $props();
</script>

<div
  class="flex flex-col items-center justify-center select-none {overlay ? 'fixed inset-0 z-[99999] bg-[var(--surface-container-lowest,#f8fafc)]/90 backdrop-blur-xl transition-all duration-400' : 'p-4'}"
  aria-label={text}
  role="status"
>
  <div class="relative flex flex-col items-center justify-center" style="max-width: {size}px; width: 100%;">
    <img
      src="/assets/images/furina-loading.svg"
      alt={text}
      width={size}
      height={size}
      class="w-full h-auto drop-shadow-xl"
    />
  </div>
</div>
