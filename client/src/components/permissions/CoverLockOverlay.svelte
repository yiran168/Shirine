<script lang="ts">
  interface Props {
    permissionType?: string;
    requiredPoints?: number;
    isUnlocked?: boolean;
  }

  let { permissionType = "public", requiredPoints = 0, isUnlocked = true }: Props = $props();
</script>

{#if !isUnlocked}
  <div class="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 bg-black/45 backdrop-blur-md rounded-2xl transition-all duration-300 group-hover:bg-black/55 select-none">
    {#if permissionType === "login_required"}
      <div class="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mb-2 shadow-lg ring-1 ring-amber-400/30">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <span class="text-white text-xs md:text-sm font-medium tracking-wide drop-shadow">登录后可见</span>
    {:else if permissionType === "points_required"}
      <div class="w-12 h-12 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center mb-2 shadow-lg ring-1 ring-purple-400/30">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <span class="text-white text-xs md:text-sm font-medium tracking-wide drop-shadow">需 {requiredPoints} 积分解锁</span>
    {/if}
  </div>
{/if}
