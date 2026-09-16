<script lang="ts">
  import PermissionBadge from "../permissions/PermissionBadge.svelte";

  interface Props {
    permissionType?: string;
    type?: string;
    requiredPoints?: number;
    points?: number;
    isUnlocked?: boolean;
    class?: string;
    lang?: string;
  }

  let props: Props = $props();
</script>

<PermissionBadge {...props} />
