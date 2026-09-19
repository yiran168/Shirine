<script lang="ts">
/**
 * M3E SearchBar — 导航栏折叠式胶囊搜索条分子。
 * 折叠时为 40px 图标按钮，点击后展开为
 * w-48 胶囊输入条，失焦延迟自动折叠。value / expanded 可双向绑定，
 * 展开折叠交互细节全部内聚在此，Search 有机体只负责搜索与结果面板。
 */
import Icon from "@iconify/svelte";

let {
	value = $bindable(""),
	expanded = $bindable(false),
	id = "search-input",
	name = "search",
	placeholder = "",
	onfocus = () => {},
	oncollapse = () => {},
}: {
	value?: string;
	expanded?: boolean;
	id?: string;
	name?: string;
	placeholder?: string;
	onfocus?: () => void;
	oncollapse?: () => void;
} = $props();

let blurTimer: ReturnType<typeof setTimeout>;

const expand = (): void => {
	expanded = true;
	setTimeout(() => {
		const input = document.getElementById(id) as HTMLInputElement;
		input?.focus();
	}, 0);
};

// 失焦后延迟折叠，允许搜索结果点击先执行
const handleBlur = (): void => {
	blurTimer = setTimeout(() => {
		expanded = false;
		oncollapse();
	}, 200);
};

const handleFocus = (): void => {
	clearTimeout(blurTimer);
	onfocus();
};
</script>

<div
    class="hidden lg:flex items-center h-10 rounded-full transition-all duration-300 top-app-bar__search-shell overflow-hidden relative z-20
           {expanded ? 'top-app-bar__search-shell--expanded w-48 bg-[var(--surface-container-high)] border border-[var(--outline-variant)]/40 shadow-sm' : 'w-10 bg-transparent hover:bg-[var(--surface-container)]'}"
    onclick={() => {
        if (!expanded) expand();
    }}
>
    <div class="w-10 h-10 flex items-center justify-center shrink-0">
        <Icon
            icon="material-symbols:search"
            class="pointer-events-none text-[1.25rem] transition-all text-[var(--on-surface)]"
        ></Icon>
    </div>
    <input
        {id}
        {name}
        {placeholder}
        bind:value
        tabindex={expanded ? 0 : -1}
        onfocus={handleFocus}
        onblur={handleBlur}
        class="h-full bg-transparent outline-0 text-[var(--on-surface)] caret-[var(--primary)] text-sm transition-all
               {expanded ? 'flex-1 pr-3 opacity-100' : 'w-0 opacity-0 pointer-events-none'}"
    />
</div>
