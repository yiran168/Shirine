<script lang="ts">
  interface Props {
    size?: number | string;
    text?: string;
    class?: string;
    fullScreen?: boolean;
    ariaLabel?: string;
  }

  let {
    size = 256,
    text = "加载中…",
    class: className = "",
    fullScreen = false,
    ariaLabel = "正在加载链接预览...",
  }: Props = $props();

  const formattedSize = $derived(
    typeof size === "number" ? `${size}px` : size
  );
</script>

{#if fullScreen}
  <div
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface/80 backdrop-blur-md transition-all duration-300 select-none {className}"
    role="status"
    aria-label={ariaLabel}
  >
    <div
      class="relative flex flex-col items-center justify-center"
      style="width: {formattedSize}; height: {formattedSize}; max-width: 90vw; max-height: 90vh;"
    >
      <img
        src="/assets/images/link-preview-loading.svg"
        alt={text}
        class="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        loading="eager"
      />
    </div>
  </div>
{:else}
  <div
    class="relative flex flex-col items-center justify-center overflow-hidden transition-all duration-300 select-none {className}"
    style="width: {formattedSize}; height: {formattedSize};"
    role="status"
    aria-label={ariaLabel}
  >
    <img
      src="/assets/images/link-preview-loading.svg"
      alt={text}
      class="w-full h-full object-contain drop-shadow-sm select-none pointer-events-none"
      loading="eager"
    />
  </div>
{/if}
