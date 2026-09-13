<script lang="ts">
import OfflineIcon from "@shirine/iconify-offline";
import { addCollection } from "@shirine/iconify-offline-functions";
import type { ComponentProps } from "svelte";
import { localIconCollections } from "@/generated/local-icon-collections";

for (const collection of localIconCollections) addCollection(collection);

let { icon, ...props }: ComponentProps<typeof OfflineIcon> = $props();
</script>

<OfflineIcon {icon} {...props} />
