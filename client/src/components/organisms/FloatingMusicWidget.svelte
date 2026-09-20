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

	void import("@utils/music").then(({ getMusicRuntime }) => {
		if (!active) return;
		const rt = getMusicRuntime(options);
		runtime = rt;
		unsubscribe = rt.subscribe((next) => {
			snapshot = next;
		});

		// 自动播放处理：先尝试直接播放，若被浏览器策略拦截则在用户首次交互时静默开启
		if (options.autoplay !== false) {
			rt.play().catch(() => {
				const onFirstGesture = () => {
					rt.play().catch(() => {});
					window.removeEventListener("click", onFirstGesture);
					window.removeEventListener("touchstart", onFirstGesture);
					window.removeEventListener("keydown", onFirstGesture);
					window.removeEventListener("scroll", onFirstGesture);
				};
				window.addEventListener("click", onFirstGesture, { once: true, passive: true });
				window.addEventListener("touchstart", onFirstGesture, { once: true, passive: true });
				window.addEventListener("keydown", onFirstGesture, { once: true, passive: true });
				window.addEventListener("scroll", onFirstGesture, { once: true, passive: true });
			});
		}
	});

	return () => {
		active = false;
		unsubscribe();
	};
});
</script>

<div
	class="floating-music-wrapper relative flex items-center gap-1.5"
	onmouseenter={() => (showControls = true)}
	onmouseleave={() => (showControls = false)}
>
	<!-- 悬浮曲目信息与扩展控制按钮（展开时显示） -->
	{#if showControls}
		<div
			class="music-info-pill flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-container-high)] text-[var(--on-surface)] shadow-lg border border-[var(--outline-variant)]/30 backdrop-blur-md animate-fade-in text-xs"
		>
			<button
				type="button"
				onclick={prevTrack}
				class="p-1 rounded-full hover:bg-[var(--surface-container-highest)] active:scale-95 transition-all text-[var(--on-surface-variant)] hover:text-primary"
				title="上一首"
				aria-label="上一首"
			>
				<Icon icon="material-symbols:skip-previous-rounded" class="text-base" />
			</button>

			<div class="max-w-[130px] truncate select-none text-[11px] font-medium leading-tight">
				<span class="block truncate text-primary font-bold">{currentTitle}</span>
				{#if currentArtist}
					<span class="block truncate text-[10px] text-[var(--on-surface-variant)]">{currentArtist}</span>
				{/if}
			</div>

			<button
				type="button"
				onclick={nextTrack}
				class="p-1 rounded-full hover:bg-[var(--surface-container-highest)] active:scale-95 transition-all text-[var(--on-surface-variant)] hover:text-primary"
				title="切换下一首"
				aria-label="切换下一首"
			>
				<Icon icon="material-symbols:skip-next-rounded" class="text-base" />
			</button>
		</div>
	{:else}
		<!-- 紧凑模式下的快捷切换下一首按钮 -->
		<button
			type="button"
			onclick={nextTrack}
			class="switch-track-btn w-8 h-8 rounded-full bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:text-primary hover:bg-[var(--surface-container-highest)] border border-[var(--outline-variant)]/20 shadow-md flex items-center justify-center active:scale-95 transition-all"
			title="切换下一首音乐"
			aria-label="切换下一首音乐"
		>
			<Icon icon="material-symbols:skip-next-rounded" class="text-lg" />
		</button>
	{/if}

	<!-- 主悬浮音乐控制按钮（含播放状态、跳动动效） -->
	<button
		type="button"
		onclick={togglePlay}
		class="floating-music-btn w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-lg border border-[var(--outline-variant)]/30 flex items-center justify-center transition-all duration-300 relative overflow-hidden group active:scale-95 {playing ? 'bg-primary text-on-primary shadow-primary/30' : 'bg-[var(--surface-container-high)] text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)]'}"
		title={playing ? `正在播放: ${currentTitle} (点击停止播放)` : `音乐播放器 (点击播放)`}
		aria-label={playing ? "停止音乐播放" : "播放音乐"}
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
</div>

<style>
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

	@keyframes fadeIn {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}

	.animate-fade-in {
		animation: fadeIn 0.2s cubic-bezier(0.2, 0, 0, 1) forwards;
	}
</style>
