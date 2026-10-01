<script lang="ts">
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import type { ResolvedMusicOptions } from "@/config/musicConfig";
import type { MusicRuntime, MusicSnapshot } from "@/types/musicConfig";

interface Props {
	options: ResolvedMusicOptions;
}

let { options }: Props = $props();

let runtime = $state<MusicRuntime | null>(null);
let snapshot = $state<MusicSnapshot>({
	playlist: options.playlist,
	currentIndex: options.playlist.length > 0 ? 0 : -1,
	currentTrack: options.playlist[0] ?? null,
	status: "idle",
	currentTime: 0,
	duration: options.playlist[0]?.duration ?? 0,
	volume: options.defaultVolume,
	muted: false,
	mode: options.defaultMode,
	error: null,
});

let showControls = $state(false);
let playButton: HTMLButtonElement;
const controlsId = $props.id();

const playing = $derived(snapshot.status === "playing");
const currentTitle = $derived(snapshot.currentTrack?.title || "Shirine 音乐");
const currentArtist = $derived(snapshot.currentTrack?.artist || "");

function togglePlay() {
	if (!runtime) return;
	if (playing) {
		runtime.pause();
	} else {
		void runtime.play();
	}
}

function nextTrack(e?: MouseEvent) {
	if (e) e.stopPropagation();
	runtime?.next();
}

function prevTrack(e?: MouseEvent) {
	if (e) e.stopPropagation();
	runtime?.previous();
}

onMount(() => {
	let unsubscribe = () => {};
	let active = true;
	const dismiss = (event: PointerEvent) => {
		if (!(event.target instanceof Node) || !playButton?.parentElement?.contains(event.target)) showControls = false;
	};
	document.addEventListener("pointerdown", dismiss);


	void import("@utils/music").then(({ getMusicRuntime }) => {
		if (!active) return;
		const rt = getMusicRuntime(options);
		runtime = rt;
		unsubscribe = rt.subscribe((next) => {
			snapshot = next;
		});

		// Only the initial idle player attempts autoplay. Navigating must preserve a deliberate pause.
		if (options.autoplay !== false && ["idle", "loading"].includes(rt.getSnapshot().status)) void rt.play();

	});

	return () => {
		active = false;
		unsubscribe();
		document.removeEventListener("pointerdown", dismiss);
	};
});
</script>

<div
	class="floating-music-wrapper relative pointer-events-auto select-none"
	onmouseenter={() => (showControls = true)}
	onmouseleave={() => (showControls = false)}
	onfocusin={() => (showControls = true)}
	onfocusout={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) showControls = false; }}
	onkeydown={(event) => { if (event.key === "Escape") { playButton?.focus(); showControls = false; } }}
>
	<!-- 主悬浮音乐控制按钮（含播放状态、跳动动效） -->
	<button
		type="button"
		bind:this={playButton}
		onclick={togglePlay}
		class="floating-music-btn w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-lg border border-[var(--outline-variant)]/30 flex items-center justify-center transition-all duration-300 relative overflow-hidden group active:scale-95 {playing ? 'bg-primary text-on-primary shadow-primary/30' : 'bg-[var(--surface-container-high)] text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]'}"
		title={playing ? `正在播放: ${currentTitle} (点击暂停)` : `音乐播放器 (点击播放)`}
		aria-label={playing ? "暂停音乐" : "播放音乐"}
		aria-expanded={showControls}
		aria-controls={controlsId}
	>
		{#if playing}
			<!-- 音乐播放中的跳动动效：4 条声波跳跃波柱 -->
			<div class="music-wave-bars flex items-center justify-center gap-[2.5px] h-5 w-5">
				<span class="wave-bar wave-1"></span>
				<span class="wave-bar wave-2"></span>
				<span class="wave-bar wave-3"></span>
				<span class="wave-bar wave-4"></span>
			</div>
		{:else}
			<Icon icon="material-symbols:music-note-rounded" class="text-2xl transition-transform group-hover:scale-110" />
		{/if}
	</button>
	<div id={controlsId} class="music-expanded" class:music-expanded--open={showControls} inert={!showControls}>
		<div class="music-info-pill" role="group" aria-label="歌曲信息和切歌控制">
			<button type="button" class="music-skip m3-state-layer" onclick={prevTrack} aria-label="上一首" title="上一首">
				<Icon icon="material-symbols:skip-previous-rounded" class="text-xl" />
			</button>
			<div class="music-track-info" title={currentArtist ? `${currentTitle} · ${currentArtist}` : currentTitle}>
				<span class="block truncate text-primary font-bold">{currentTitle}</span>
				{#if currentArtist}<span class="block truncate text-[var(--on-surface-variant)]">{currentArtist}</span>{/if}
			</div>
			<button type="button" class="music-skip m3-state-layer" onclick={nextTrack} aria-label="下一首" title="下一首">
				<Icon icon="material-symbols:skip-next-rounded" class="text-xl" />
			</button>
		</div>
	</div>
</div>

<style>
	.floating-music-wrapper {
		pointer-events: auto;
	}
	.floating-music-btn { min-width: 44px; min-height: 44px; }
	.music-expanded { position: absolute; right: 100%; top: 50%; width: min(208px, calc(100vw - 6.5rem)); padding-right: 8px; box-sizing: border-box; opacity: 0; visibility: hidden; pointer-events: none; transform: translate(10px, -50%); transition: opacity 220ms ease, transform 220ms ease, visibility 0s 220ms; }
	.music-expanded--open { opacity: 1; visibility: visible; pointer-events: auto; transform: translate(0, -50%); transition-delay: 0s; }
	.music-info-pill { display: flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px; background: var(--surface-container-high); color: var(--on-surface); border: 1px solid var(--outline-variant); box-shadow: var(--m3e-elevation-2); }
	.music-skip { flex: 0 0 44px; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; color: var(--on-surface-variant); cursor: pointer; }
	.music-track-info { flex: 1; min-width: 0; font-size: 11px; line-height: 1.5; }
	.wave-bar {
		display: inline-block;
		width: 2.5px;
		background-color: currentColor;
		border-radius: 9999px;
		animation-duration: 0.8s;
		animation-iteration-count: infinite;
		animation-direction: alternate;
		animation-timing-function: ease-in-out;
	}

	.wave-1 {
		height: 6px;
		animation-name: wave-anim-1;
		animation-delay: 0.1s;
	}

	.wave-2 {
		height: 16px;
		animation-name: wave-anim-2;
		animation-delay: 0.25s;
	}

	.wave-3 {
		height: 10px;
		animation-name: wave-anim-3;
		animation-delay: 0.4s;
	}

	.wave-4 {
		height: 14px;
		animation-name: wave-anim-4;
		animation-delay: 0.2s;
	}

	@keyframes wave-anim-1 {
		0% { height: 4px; }
		100% { height: 14px; }
	}

	@keyframes wave-anim-2 {
		0% { height: 16px; }
		100% { height: 6px; }
	}

	@keyframes wave-anim-3 {
		0% { height: 6px; }
		100% { height: 18px; }
	}

	@keyframes wave-anim-4 {
		0% { height: 14px; }
		100% { height: 5px; }
	}

</style>
