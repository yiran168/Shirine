<script lang="ts">
  import CoverLockOverlay from "../permissions/CoverLockOverlay.svelte";

  interface Props {
    permissionType?: string;
    type?: string;
    requiredPoints?: number;
    points?: number;
    isUnlocked?: boolean;
    lang?: string;
    class?: string;
  }

  let props: Props = $props();
</script>

<CoverLockOverlay {...props} />
