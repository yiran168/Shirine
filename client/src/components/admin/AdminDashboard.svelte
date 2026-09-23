<script lang="ts">
  import { onMount } from "svelte";
  import { authStore } from "../../stores/auth";
  import {
    adminApi,
    authApi,
    postsApi,
    albumsApi,
    momentsApi,
    pagesApi,
    friendsApi,
    configApi,
    mediaApi,
    aiApi,
    uploadFile,
    setToken,
  } from "../../services/api";
  import { SUPPORTED_LANGUAGES, getAdminText, type AdminLang, type LanguageOption } from "../../i18n/adminI18n";
  import { renderDynamicMarkdown } from "../../utils/dynamic-markdown";
  import { compassData } from "../../data/compass";
  import { animeData } from "../../data/anime";
  import { projectsData } from "../../data/projects";
  import { devicesData } from "../../data/devices";
  import { skillsData } from "../../data/skills";
  import { timelineData } from "../../data/timeline";

  type TabType = "overview" | "posts" | "albums" | "moments" | "pages" | "friends" | "projects" | "devices" | "skills" | "compass" | "anime" | "timeline" | "media" | "guide" | "users" | "settings";

  let currentTab = $state<TabType>("overview");
  let loading = $state(true);
  let errorMsg = $state("");
  let successMsg = $state("");

  // Admin Language i18n State
  let adminLang = $state("zh_CN");
  let adminLangOpen = $state(false);
  const at = $derived(getAdminText(adminLang));
  const currentAdminLangOption = $derived(
    SUPPORTED_LANGUAGES.find((l) => l.code === adminLang) || SUPPORTED_LANGUAGES[0]
  );

  function setAdminLanguage(langCode: string) {
    adminLang = langCode;
    adminLangOpen = false;
    if (typeof window !== "undefined") {
      localStorage.setItem("shirine_admin_lang", langCode);
      localStorage.setItem("shirine_lang", langCode);
      document.cookie = `shirine_admin_lang=${langCode}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `shirine_lang=${langCode}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = langCode.replace("_", "-");
      const selected = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      showMessage(`${at.languageSwitched}: ${selected ? selected.name : langCode}`);
    }
  }

  // Auth & Permissions
  let isAdmin = $derived(
    authStore.user && (authStore.user.role === "superadmin" || authStore.user.role === "admin")
  );

  // Quick login state if visitor not admin
  let loginUsername = $state("");
  let loginPassword = $state("");
  let loginLoading = $state(false);

  // Initial Setup Wizard State
  let needsSetup = $state(false);
  let setupUsername = $state("");
  let setupPassword = $state("");
  let setupConfirmPassword = $state("");
  let setupNickname = $state("");
  let setupToken = $state("");
  let setupLoading = $state(false);

  async function handleSetupAdmin() {
    if (setupPassword !== setupConfirmPassword) {
      showMessage("两次输入的密码不一致", true);
      return;
    }
    setupLoading = true;
    errorMsg = "";
    try {
      const res = await authApi.setupAdmin({
        username: setupUsername,
        password: setupPassword,
        nickname: setupNickname,
        setupToken: setupToken ? setupToken : undefined,
      });
      if (res.success && res.user) {
        if (res.token) {
          setToken(res.token);
        }
        authStore.setUser(res.user);
        needsSetup = false;
        showMessage("首位超级管理员初始化成功！欢迎使用 Shirine！");
        loadDashboardData();
      } else {
        showMessage(res.error || "初始化失败", true);
      }
    } catch (err: any) {
      showMessage(err.message || "请求异常", true);
    } finally {
      setupLoading = false;
    }
  }

  // Overview Stats
  let stats = $state<{
    totalPosts: number;
    totalAlbums: number;
    totalMoments: number;
    totalUsers: number;
    totalPoints: number;
  }>({
    totalPosts: 0,
    totalAlbums: 0,
    totalMoments: 0,
    totalUsers: 0,
    totalPoints: 0,
  });

  // Posts State
  let posts = $state<any[]>([]);
  let postModalOpen = $state(false);
  let editingPost = $state<any>(null);
  let postForm = $state({
    id: 0,
    title: "",
    slug: "",
    content: "",
    description: "",
    category: "",
    tags: "",
    image: "",
    pinned: false,
    draft: false,
    encrypted: false,
    password: "",
    passwordHint: "",
    hideHomeContent: true,
    permissionType: "public",
    requiredPoints: 0,
  });

  // Albums State
  let albums = $state<any[]>([]);
  let albumModalOpen = $state(false);
  let editingAlbum = $state<any>(null);
  let albumForm = $state({
    id: 0,
    title: "",
    slug: "",
    description: "",
    cover: "",
    layout: "masonry",
    columns: 3,
    permissionType: "public",
    requiredPoints: 0,
    password: "",
    passwordHint: "",
    photosText: "", // JSON or newline separated URLs
  });
  let lastUploadedAlbumPhotoUrl = $state("");

  // Derived Categories and Tags for posts
  const DEFAULT_CATEGORIES = ["随笔", "生活", "技术", "设计"];
  const existingCategories = $derived.by(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    for (const p of posts) {
      if (p.category && String(p.category).trim()) {
        set.add(String(p.category).trim());
      }
    }
    return Array.from(set).sort();
  });

  let customTags = $state<string[]>([]);
  let newTagName = $state("");

  const existingTagsWithCount = $derived.by(() => {
    const map: Record<string, number> = {};
    for (const ct of customTags) {
      map[ct] = 0;
    }
    for (const p of posts) {
      let tList: string[] = [];
      if (Array.isArray(p.tags)) tList = p.tags;
      else if (typeof p.tags === "string") tList = p.tags.split(/[,，]/);
      for (const t of tList) {
        const trimmed = String(t).trim();
        if (trimmed) map[trimmed] = (map[trimmed] || 0) + 1;
      }
    }
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  });

  // Markdown live preview states
  let postEditorTab = $state<"edit" | "preview">("edit");
  let postPreviewHtml = $derived(postEditorTab === "preview" ? renderDynamicMarkdown(postForm.content) : "");

  let momentEditorTab = $state<"edit" | "preview">("edit");
  let momentPreviewHtml = $derived(momentEditorTab === "preview" ? renderDynamicMarkdown(momentContent) : "");

  let editMomentEditorTab = $state<"edit" | "preview">("edit");
  let editMomentPreviewHtml = $derived(editMomentEditorTab === "preview" ? renderDynamicMarkdown(editMomentForm.content) : "");

  // Tag Manager State
  let tagManagerModalOpen = $state(false);
  let renamingOldTag = $state("");
  let renamingNewTag = $state("");

  // Moments State
  let moments = $state<any[]>([]);
  let momentContent = $state("");
  let momentMood = $state("✨");
  let momentLocation = $state("");
  let momentPhotos = $state<string[]>([]);
  let momentModalOpen = $state(false);
  let editingMoment = $state<any>(null);
  let editMomentForm = $state({
    id: 0,
    content: "",
    mood: "✨",
    location: "",
    photos: [] as string[],
    pinned: false,
    draft: false,
  });

  // Pages State
  let pages = $state<any[]>([]);
  let pageModalOpen = $state(false);
  let editingPage = $state<any>(null);
  let pageForm = $state({
    id: 0,
    title: "",
    slug: "",
    icon: "",
    content: "",
    status: "published",
  });
  let pageEditorTab = $state<"edit" | "preview">("edit");

  const BUILTIN_PAGE_ICONS = [
    { name: "article", icon: "material-symbols:article-outline-rounded", label: "📄 文章" },
    { name: "info", icon: "material-symbols:info-outline-rounded", label: "ℹ️ 关于" },
    { name: "code", icon: "material-symbols:code-rounded", label: "💻 项目" },
    { name: "devices", icon: "material-symbols:devices-rounded", label: "📱 设备" },
    { name: "psychology", icon: "material-symbols:psychology-outline-rounded", label: "🧠 技能" },
    { name: "explore", icon: "material-symbols:explore-outline-rounded", label: "🧭 罗盘" },
    { name: "movie", icon: "material-symbols:movie-outline-rounded", label: "🎬 番剧" },
    { name: "photo", icon: "material-symbols:photo-library-outline-rounded", label: "🖼️ 相册" },
    { name: "chat", icon: "material-symbols:chat-bubble-outline-rounded", label: "💬 动态" },
    { name: "link", icon: "material-symbols:link-rounded", label: "🔗 友链" },
    { name: "history", icon: "material-symbols:history-rounded", label: "⏳ 时间线" },
    { name: "menu_book", icon: "material-symbols:menu-book-outline-rounded", label: "📖 手册" },
    { name: "folder", icon: "material-symbols:folder-outline-rounded", label: "📁 分类" },
    { name: "tag", icon: "material-symbols:tag-rounded", label: "🏷️ 标签" },
    { name: "music", icon: "material-symbols:music-note-rounded", label: "🎵 音乐" },
    { name: "star", icon: "material-symbols:star-outline-rounded", label: "⭐ 收藏" },
    { name: "mail", icon: "material-symbols:mail-outline-rounded", label: "✉️ 联系" },
    { name: "rss", icon: "material-symbols:rss-feed-rounded", label: "📡 订阅" },
    { name: "help", icon: "material-symbols:help-outline-rounded", label: "❓ 帮助" },
    { name: "settings", icon: "material-symbols:settings-outline-rounded", label: "⚙️ 设置" },
  ];

  // Friends State
  let friends = $state<any[]>([]);
  let friendModalOpen = $state(false);
  let friendForm = $state({
    id: 0,
    name: "",
    url: "",
    avatar: "",
    desc: "",
    status: "approved",
  });

  // Users State
  let users = $state<any[]>([]);
  let userPointsModalOpen = $state(false);
  let targetUser = $state<any>(null);
  let adjustPointsDelta = $state(0);

  // Settings State
  let siteConfigState = $state({
    title: "Shirine",
    subtitle: "A Material 3 anime blog",
    lang: "zh_CN",
    themeHue: 315,
    themeStyle: "tonalSpot",
    topAppBarAlign: "center",
    wallpaperMode: "banner",
    texturePreset: "starlight",
    textureOpacity: 0.12,
    bannerDesktop: "/assets/images/banner/desktop/1.webp",
    bannerMobile: "/assets/images/banner/mobile/1.webp",
    bannerSubtitles: "特別なことはないけど、君がいると十分です\n今でもあなたは私の光\n君ってさ、知らないうちに我的毎日になってたよ\n君と话すと、なんか毎日がちょっと楽しくなるんだ\n今日はなんでもない日。但是、ちょっとだけいい日",
    authorName: "Shirine",
    bio: "The rain remembers what the sky forgot to say.",
    avatar: "/assets/images/demo-avatar.webp",
    profileLinks: [
      { name: "Twitter", icon: "fa6-brands:twitter", url: "https://twitter.com" },
      { name: "Steam", icon: "fa6-brands:steam", url: "https://store.steampowered.com" },
      { name: "GitHub", icon: "fa6-brands:github", url: "https://github.com/yiran168/Shirine" },
    ] as Array<{ name: string; icon: string; url: string }>,
    announcementEnable: true,
    announcementTitle: "",
    announcementContent: "The only way to do great work is to love what you do",
    announcementLinkText: "GitHub",
    announcementLinkUrl: "https://github.com/yiran168/Shirine",
    announcementLinks: [
      { text: "GitHub", url: "https://github.com/yiran168/Shirine" },
      { text: "Steam", url: "https://store.steampowered.com" },
      { text: "Facebook", url: "https://www.facebook.com" },
    ] as Array<{ text: string; url: string }>,
    musicEnable: true,
    musicProvider: "mixed",
    musicVolume: 0.7,
    musicMetingServer: "netease",
    musicMetingId: "14164869977",
    musicTracks: [] as any[],
    compass: JSON.parse(JSON.stringify(compassData)) as any[],
    anime: JSON.parse(JSON.stringify(animeData)) as any[],
    timeline: JSON.parse(JSON.stringify(timelineData)) as any[],
    projects: JSON.parse(JSON.stringify(projectsData)) as any[],
    devices: JSON.parse(JSON.stringify(devicesData)) as any[],
    skills: JSON.parse(JSON.stringify(skillsData)) as any[],
    friendApplyInfo: {
      name: "Shirine",
      url: "https://github.com/yiran168/Shirine",
      avatar: "/assets/images/demo-avatar.webp",
      desc: "The rain remembers what the sky forgot to say.",
    },
  });

  let systemConfigState = $state({
    checkinMode: "random", // "fixed" | "random"
    checkinFixedPoints: 10,
    checkinRandomMin: 5,
    checkinRandomMax: 20,
    turnstileEnable: false,
    turnstileSiteKey: "",
    turnstileSecretKey: "",
    live2dGuestEnable: true,
    live2dAdminEnable: true,
    live2dModel: "/pio/models/NOIR/noir.model3.json",
    live2dLang: "zh_CN",
    live2dQuotes: "欢迎来到 Shirine！\n今天也是美好的一天～\n有什么想和我聊聊的吗？\n看文章累了就伸个懒腰吧！\n点击右下角按钮可以返回顶部哦～\n我会一直在这里陪着你的！",
    live2dModels: [
      { name: "NOIR (默认)", url: "/pio/models/NOIR/noir.model3.json" },
      { name: "Hiyori", url: "https://fastly.jsdelivr.net/gh/evpt/live2d-models/hiyori/hiyori.model3.json" },
    ] as Array<{ name: string; url: string }>,
    aiApiUrl: "https://api.openai.com/v1",
    aiApiKey: "",
    aiModel: "gpt-4o-mini",
  });

  // Distinct categories for instant click-and-reuse
  const distinctProjectCategories = $derived(
    Array.from(new Set(siteConfigState.projects.map((p: any) => p.category?.trim()).filter(Boolean))) as string[]
  );
  const distinctDeviceCategories = $derived(
    Array.from(new Set([
      "desk", "mobile", "audio", "peripheral", "other",
      ...siteConfigState.devices.map((d: any) => d.category?.trim()).filter(Boolean)
    ])) as string[]
  );
  const distinctSkillCategories = $derived(
    Array.from(new Set([
      "frontend", "backend", "tooling", "design", "other",
      ...siteConfigState.skills.map((s: any) => s.category?.trim()).filter(Boolean)
    ])) as string[]
  );

  const distinctTimelineCategories = $derived(
    Array.from(new Set([
      "milestone", "career", "project", "education", "life",
      ...siteConfigState.timeline.map((t: any) => t.category?.trim()).filter(Boolean)
    ])) as string[]
  );

  // Drag and Drop reordering states
  let draggedProjectIndex = $state<number | null>(null);
  let draggedDeviceIndex = $state<number | null>(null);
  let draggedSkillIndex = $state<number | null>(null);
  let draggedTimelineIndex = $state<number | null>(null);

  // Media Library state
  const R2_PUBLIC_BASE = "https://pub-a6d6803bf2bf426ca31d2f66fdba3ace.r2.dev";

  const PRESET_MEDIA: Array<{ key: string; size: number; uploaded: string; url: string; isPreset?: boolean }> = [
    // Audio Presets
    { key: "audio/dazbee.mp3", size: 4521000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/audio/dazbee.mp3`, isPreset: true },
    { key: "audio/hitori.mp3", size: 5120000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/audio/hitori.mp3`, isPreset: true },
    { key: "audio/xryx.mp3", size: 4890000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/audio/xryx.mp3`, isPreset: true },
    { key: "audio/cl.mp3", size: 4760000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/audio/cl.mp3`, isPreset: true },
    { key: "audio/Baka.wav", size: 245000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/audio/Baka.wav`, isPreset: true },
    { key: "audio/Ciallo.wav", size: 312000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/audio/Ciallo.wav`, isPreset: true },
    { key: "audio/Ehe.wav", size: 198000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/audio/Ehe.wav`, isPreset: true },
    { key: "audio/Imoi.wav", size: 220000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/audio/Imoi.wav`, isPreset: true },
    { key: "audio/Zako.wav", size: 280000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/audio/Zako.wav`, isPreset: true },
    // Image / Cover / Banner Presets
    { key: "images/banner/desktop/1.webp", size: 845000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/images/banner/desktop/1.webp`, isPreset: true },
    { key: "images/banner/mobile/1.webp", size: 412000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/images/banner/mobile/1.webp`, isPreset: true },
    { key: "images/demo-avatar.webp", size: 688000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/images/demo-avatar.webp`, isPreset: true },
    { key: "anime/lkls.webp", size: 320000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/anime/lkls.webp`, isPreset: true },
    { key: "anime/rynh.webp", size: 310000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/anime/rynh.webp`, isPreset: true },
    { key: "anime/laxxx.webp", size: 340000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/anime/laxxx.webp`, isPreset: true },
    { key: "anime/tz1.webp", size: 290000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/anime/tz1.webp`, isPreset: true },
    { key: "anime/cmmn.webp", size: 330000, uploaded: "2026-01-01T00:00:00.000Z", url: `${R2_PUBLIC_BASE}/anime/cmmn.webp`, isPreset: true },
  ];

  let mediaFiles = $state<Array<{ key: string; size: number; uploaded: string; url: string; isPreset?: boolean; httpMetadata?: any }>>([]);
  let mediaFilter = $state<"all" | "image" | "audio" | "preset" | "uploaded">("all");
  let mediaSearch = $state("");
  let mediaUploading = $state(false);

  const filteredMediaFiles = $derived.by(() => {
    let list = mediaFiles || [];
    if (mediaFilter === "image") {
      list = list.filter((f) => /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(f.key) || f.httpMetadata?.contentType?.startsWith("image/"));
    } else if (mediaFilter === "audio") {
      list = list.filter((f) => /\.(mp3|flac|wav|ogg|m4a|aac)$/i.test(f.key) || f.httpMetadata?.contentType?.startsWith("audio/"));
    } else if (mediaFilter === "preset") {
      list = list.filter((f) => f.isPreset);
    } else if (mediaFilter === "uploaded") {
      list = list.filter((f) => !f.isPreset);
    }
    if (mediaSearch.trim()) {
      const q = mediaSearch.trim().toLowerCase();
      list = list.filter((f) => f.key.toLowerCase().includes(q) || (f.url && f.url.toLowerCase().includes(q)));
    }
    return list;
  });

  const totalMediaStorageBytes = $derived(
    mediaFiles.reduce((acc, f) => acc + (f.size || 0), 0)
  );

  // AI Writing Assistant state
  let aiModalOpen = $state(false);
  let aiTarget = $state<"post" | "moment">("post");
  let aiPrompt = $state("");
  let aiInstruction = $state("");
  let aiGenerating = $state(false);
  let aiResult = $state("");
  let aiAvailableModels = $state<string[]>([]);
  let aiFetchingModels = $state(false);

  function showMessage(msg: string, isError = false) {
    if (isError) {
      errorMsg = msg;
      setTimeout(() => (errorMsg = ""), 5000);
    } else {
      successMsg = msg;
      setTimeout(() => (successMsg = ""), 4000);
    }
  }

  async function handleAdminLogin() {
    loginLoading = true;
    errorMsg = "";
    try {
      const res = await authApi.login({ username: loginUsername, password: loginPassword });
      if (res.success && res.user) {
        if (res.user.role !== "superadmin" && res.user.role !== "admin") {
          showMessage("该账户不是管理员角色，无法进入后台控制台", true);
        } else {
          if (res.token) {
            setToken(res.token);
          }
          authStore.setUser(res.user);
          loadDashboardData();
        }
      } else {
        const errorText = res.error || "登录失败";
        // If turnstile verification was required by server, prompt unified AuthModal (V8-P1-14)
        if (errorText.toLowerCase().includes("turnstile") || errorText.includes("verification") || errorText.includes("验证")) {
          authStore.openAuthModal("login");
          showMessage("系统已启用人机验证，请在弹出的登录窗口中完成验证并登录", false);
        } else {
          showMessage(errorText, true);
        }
      }
    } catch (err: any) {
      showMessage(err.message || "登录请求异常", true);
    } finally {
      loginLoading = false;
    }
  }

  async function loadDashboardData() {
    loading = true;
    try {
      // 1. Stats (V8-P0-30, V8-P1-17)
      const statsRes = await adminApi.getStats();
      if (statsRes.success && statsRes.data) {
        const d = statsRes.data as any;
        stats = {
          totalPosts: d.totalPosts ?? d.posts ?? 0,
          totalAlbums: d.totalAlbums ?? d.albums ?? 0,
          totalMoments: d.totalMoments ?? d.moments ?? 0,
          totalUsers: d.totalUsers ?? d.users ?? 0,
          totalPoints: d.totalPoints ?? 0,
        };
      }

      // 2. Load tab specific data
      await loadTabData(currentTab);
    } catch (err: any) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  async function loadTabData(tab: TabType) {
    if (!isAdmin) return;
    try {
      if (tab === "posts") {
        const res = await postsApi.list({ pageSize: 100 });
        if (res.success) posts = res.data || [];
      } else if (tab === "albums") {
        const res = await albumsApi.list();
        if (res.success) albums = res.data || [];
      } else if (tab === "moments") {
        const res = await momentsApi.list();
        if (res.success) moments = res.data || [];
      } else if (tab === "pages") {
        const res = await pagesApi.list();
        if (res.success) pages = res.data || [];
      } else if (tab === "friends") {
        const [friendsRes, siteRes] = await Promise.all([
          friendsApi.list(),
          configApi.getSite(),
        ]);
        if (friendsRes.success) friends = friendsRes.data || [];
        if (siteRes.success && siteRes.data?.friendApplyInfo) {
          siteConfigState = {
            ...siteConfigState,
            friendApplyInfo: {
              ...siteConfigState.friendApplyInfo,
              ...siteRes.data.friendApplyInfo,
            },
          };
        }
      } else if (tab === "users") {
        const res = await adminApi.getUsers({ pageSize: 100 });
        if (res.success) users = res.data || [];
      } else if (tab === "media") {
        await loadMediaLibrary();
      } else if (tab === "settings" || tab === "compass" || tab === "anime" || tab === "projects" || tab === "devices" || tab === "skills" || tab === "timeline") {
        const [siteRes, sysRes] = await Promise.all([
          configApi.getSite(),
          configApi.getAdminSystem(),
        ]);
        if (siteRes.success && siteRes.data) {
          const s = siteRes.data.site || {};
          const p = siteRes.data.profile || {};
          const m = siteRes.data.music || {};
          const a = siteRes.data.announcement || {};
          siteConfigState = {
            ...siteConfigState,
            title: s.title ?? siteConfigState.title,
            subtitle: s.subtitle ?? siteConfigState.subtitle,
            lang: s.lang ?? siteConfigState.lang,
            themeHue: s.themeColor?.hue ?? siteConfigState.themeHue,
            themeStyle: s.themeColor?.style ?? siteConfigState.themeStyle,
            topAppBarAlign: s.topAppBar?.contentAlign ?? siteConfigState.topAppBarAlign,
            wallpaperMode: s.wallpaperMode?.defaultMode ?? siteConfigState.wallpaperMode,
            texturePreset: s.texture?.defaultPreset ?? siteConfigState.texturePreset,
            textureOpacity: s.texture?.defaultOpacity ?? siteConfigState.textureOpacity,
            bannerDesktop: Array.isArray(s.banner?.src?.desktop)
              ? s.banner.src.desktop.join("\n")
              : (s.banner?.src?.desktop ?? siteConfigState.bannerDesktop),
            bannerMobile: Array.isArray(s.banner?.src?.mobile)
              ? s.banner.src.mobile.join("\n")
              : (s.banner?.src?.mobile ?? siteConfigState.bannerMobile),
            bannerSubtitles: Array.isArray(s.banner?.homeText?.subtitle)
              ? s.banner.homeText.subtitle.join("\n")
              : siteConfigState.bannerSubtitles,
            authorName: p.name ?? siteConfigState.authorName,
            bio: p.bio ?? siteConfigState.bio,
            avatar: p.avatar ?? siteConfigState.avatar,
            profileLinks: Array.isArray(p.links) && p.links.length > 0 ? p.links : siteConfigState.profileLinks,
            announcementEnable: a.enable ?? siteConfigState.announcementEnable,
            announcementTitle: a.title ?? siteConfigState.announcementTitle,
            announcementContent: a.content ?? siteConfigState.announcementContent,
            announcementLinkText: a.link?.text ?? siteConfigState.announcementLinkText,
            announcementLinkUrl: a.link?.url ?? siteConfigState.announcementLinkUrl,
            announcementLinks: Array.isArray(a.links) && a.links.length > 0
              ? a.links
              : (a.link && a.link.url ? [{ text: a.link.text || "GitHub", url: a.link.url }] : siteConfigState.announcementLinks),
            musicEnable: m.enable ?? siteConfigState.musicEnable,
            musicProvider: m.provider ?? siteConfigState.musicProvider,
            musicVolume: m.defaultVolume ?? siteConfigState.musicVolume,
            musicMetingServer: m.meting?.server ?? siteConfigState.musicMetingServer,
            musicMetingId: m.meting?.id ?? siteConfigState.musicMetingId,
            musicTracks: Array.isArray(m.tracks) ? m.tracks : siteConfigState.musicTracks,
            timeline: Array.isArray(siteRes.data.timeline) && siteRes.data.timeline.length > 0 ? siteRes.data.timeline : (siteConfigState.timeline?.length ? siteConfigState.timeline : JSON.parse(JSON.stringify(timelineData))),
            compass: Array.isArray(siteRes.data.compass) && siteRes.data.compass.length > 0 ? siteRes.data.compass : (siteConfigState.compass?.length ? siteConfigState.compass : JSON.parse(JSON.stringify(compassData))),
            anime: Array.isArray(siteRes.data.anime) && siteRes.data.anime.length > 0 ? siteRes.data.anime : (siteConfigState.anime?.length ? siteConfigState.anime : JSON.parse(JSON.stringify(animeData))),
            projects: Array.isArray(siteRes.data.projects) && siteRes.data.projects.length > 0 ? siteRes.data.projects : (siteConfigState.projects?.length ? siteConfigState.projects : JSON.parse(JSON.stringify(projectsData))),
            devices: Array.isArray(siteRes.data.devices) && siteRes.data.devices.length > 0 ? siteRes.data.devices : (siteConfigState.devices?.length ? siteConfigState.devices : JSON.parse(JSON.stringify(devicesData))),
            skills: Array.isArray(siteRes.data.skills) && siteRes.data.skills.length > 0 ? siteRes.data.skills : (siteConfigState.skills?.length ? siteConfigState.skills : JSON.parse(JSON.stringify(skillsData))),
            friendApplyInfo: siteRes.data.friendApplyInfo ?? siteConfigState.friendApplyInfo,
          };
        }
        if (sysRes.success && sysRes.data) {
          systemConfigState = { ...systemConfigState, ...sysRes.data };
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  function switchTab(tab: TabType) {
    currentTab = tab;
    loadTabData(tab);
  }

  // --- Posts Operations ---
  function openNewPostModal() {
    editingPost = null;
    postForm = {
      id: 0,
      title: "",
      slug: "",
      content: "",
      description: "",
      category: "Default",
      tags: "",
      image: "",
      pinned: false,
      draft: false,
      encrypted: false,
      password: "",
      passwordHint: "",
      hideHomeContent: true,
      permissionType: "public",
      requiredPoints: 0,
    };
    postModalOpen = true;
  }

  async function openEditPostModal(post: any) {
    editingPost = post;
    try {
      const res = await postsApi.get(post.id);
      const p = res.success && (res.data || res.post) ? res.data || res.post : post;
      postForm = {
        id: p.id,
        title: p.title || "",
        slug: p.slug || "",
        content: p.content || "",
        description: p.description || "",
        category: p.category || "Default",
        tags: Array.isArray(p.tags) ? p.tags.join(", ") : p.tags || "",
        image: p.image || "",
        pinned: Boolean(p.pinned),
        draft: Boolean(p.draft),
        encrypted: Boolean(p.encrypted || (p.password && p.password.length > 0)),
        password: p.password || "",
        passwordHint: p.passwordHint || "",
        hideHomeContent: p.hideHomeContent !== undefined ? Boolean(p.hideHomeContent) : true,
        permissionType: p.permissionType || "public",
        requiredPoints: p.requiredPoints || 0,
      };
      postModalOpen = true;
    } catch (e: any) {
      showMessage("加载文章内容失败: " + e.message, true);
    }
  }

  async function savePost() {
    if (!postForm.title.trim()) return showMessage("请输入文章标题", true);
    const tagsArr = postForm.tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const hasPassword = Boolean(postForm.password && postForm.password.trim().length > 0);

    const payload = {
      ...postForm,
      tags: tagsArr,
      pinned: postForm.pinned ? 1 : 0,
      draft: postForm.draft ? 1 : 0,
      encrypted: (postForm.encrypted || hasPassword) ? 1 : 0,
      password: postForm.password.trim(),
      passwordHint: postForm.passwordHint.trim(),
      hideHomeContent: postForm.hideHomeContent ? 1 : 0,
      requiredPoints: Number(postForm.requiredPoints) || 0,
    };

    try {
      let res;
      if (editingPost) {
        res = await postsApi.update(editingPost.id, payload);
      } else {
        res = await postsApi.create(payload);
      }
      if (res.success) {
        showMessage("文章保存成功！刷新前台即可看到最新内容");
        postModalOpen = false;
        loadTabData("posts");
      } else {
        showMessage(res.error || "保存失败", true);
      }
    } catch (err: any) {
      showMessage(err.message || "请求异常", true);
    }
  }

  async function deletePost(id: number) {
    if (!confirm("确定要删除这篇博文吗？删除后无法恢复。")) return;
    try {
      const res = await postsApi.delete(id);
      if (res.success) {
        showMessage("文章已删除");
        loadTabData("posts");
      } else {
        showMessage(res.error || "删除失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Albums Operations ---
  function openNewAlbumModal() {
    editingAlbum = null;
    albumForm = {
      id: 0,
      title: "",
      slug: "",
      description: "",
      cover: "",
      layout: "masonry",
      columns: 3,
      permissionType: "public",
      requiredPoints: 0,
      password: "",
      passwordHint: "",
      photosText: "",
    };
    lastUploadedAlbumPhotoUrl = "";
    albumModalOpen = true;
  }

  async function openEditAlbumModal(album: any) {
    editingAlbum = album;
    lastUploadedAlbumPhotoUrl = "";
    try {
      const res = await albumsApi.get(album.id);
      const a = res.success && (res.data || res.album) ? res.data || res.album : album;
      albumForm = {
        id: a.id,
        title: a.title || "",
        slug: a.slug || "",
        description: a.description || "",
        cover: a.cover || "",
        layout: a.layout || "masonry",
        columns: a.columns || 3,
        permissionType: a.permissionType || "public",
        requiredPoints: a.requiredPoints || 0,
        password: a.password || "",
        passwordHint: a.passwordHint || "",
        photosText: Array.isArray(a.photos)
          ? a.photos.map((p: any) => p.src || p.url || p).join("\n")
          : "",
      };
      albumModalOpen = true;
    } catch (e: any) {
      showMessage("加载相册详情失败: " + e.message, true);
    }
  }

  async function saveAlbum() {
    if (!albumForm.title.trim()) return showMessage("请输入相册标题", true);
    const photos = albumForm.photosText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url }));

    const payload = {
      ...albumForm,
      photos,
      requiredPoints: Number(albumForm.requiredPoints) || 0,
      password: albumForm.password ? albumForm.password.trim() : undefined,
      passwordHint: albumForm.passwordHint ? albumForm.passwordHint.trim() : undefined,
    };

    try {
      let res;
      if (editingAlbum) {
        res = await albumsApi.update(editingAlbum.id, payload);
      } else {
        res = await albumsApi.create(payload);
      }
      if (res.success) {
        showMessage("相册保存成功！");
        albumModalOpen = false;
        loadTabData("albums");
      } else {
        showMessage(res.error || "保存失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Tags Management Operations ---
  function handleAddNewTag() {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    const existsInPosts = existingTagsWithCount.some((t) => t.name === trimmed);
    if (existsInPosts || customTags.includes(trimmed)) {
      showMessage(`标签 "${trimmed}" 已存在`, true);
      return;
    }
    customTags = [...customTags, trimmed];
    newTagName = "";
    showMessage(`成功添加标签 "${trimmed}"`);
  }

  async function handleRenameTag(oldName: string) {
    if (!renamingNewTag.trim() || renamingNewTag.trim() === oldName) {
      renamingOldTag = "";
      return;
    }
    const newName = renamingNewTag.trim();
    loading = true;
    try {
      let updatedCount = 0;
      for (const p of posts) {
        let tList: string[] = Array.isArray(p.tags) ? [...p.tags] : (typeof p.tags === "string" ? p.tags.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) : []);
        if (tList.includes(oldName)) {
          const newTags = tList.map((t: string) => (t === oldName ? newName : t));
          await postsApi.update(p.id, { ...p, tags: newTags });
          updatedCount++;
        }
      }
      customTags = customTags.map((t) => (t === oldName ? newName : t));
      showMessage(`成功将标签 "${oldName}" 重命名为 "${newName}"，已同步 ${updatedCount} 篇文章`);
      renamingOldTag = "";
      renamingNewTag = "";
      await loadTabData("posts");
    } catch (err: any) {
      showMessage(err.message, true);
    } finally {
      loading = false;
    }
  }

  async function handleDeleteTag(tagName: string) {
    if (!confirm(`确定要删除标签 "${tagName}" 吗？该操作将从所有关联文章中移除此标签。`)) return;
    loading = true;
    try {
      let updatedCount = 0;
      for (const p of posts) {
        let tList: string[] = Array.isArray(p.tags) ? [...p.tags] : (typeof p.tags === "string" ? p.tags.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) : []);
        if (tList.includes(tagName)) {
          const newTags = tList.filter((t: string) => t !== tagName);
          await postsApi.update(p.id, { ...p, tags: newTags });
          updatedCount++;
        }
      }
      customTags = customTags.filter((t) => t !== tagName);
      showMessage(`已删除标签 "${tagName}"，已从 ${updatedCount} 篇文章中移除`);
      await loadTabData("posts");
    } catch (err: any) {
      showMessage(err.message, true);
    } finally {
      loading = false;
    }
  }

  async function deleteAlbum(id: number) {
    if (!confirm("确定要删除此相册吗？")) return;
    try {
      const res = await albumsApi.delete(id);
      if (res.success) {
        showMessage("相册已删除");
        loadTabData("albums");
      } else {
        showMessage(res.error || "删除失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Moments Operations ---
  async function publishMoment() {
    if (!momentContent.trim()) return showMessage("请输入动态内容", true);
    try {
      const res = await momentsApi.create({
        content: momentContent,
        mood: momentMood,
        location: momentLocation,
        photos: momentPhotos,
        images: momentPhotos.map((url) => ({ src: url, alt: "" })),
      });
      if (res.success) {
        showMessage("动态日记发布成功！");
        momentContent = "";
        momentLocation = "";
        momentPhotos = [];
        loadTabData("moments");
      } else {
        showMessage(res.error || "发布失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  async function deleteMoment(id: number) {
    if (!confirm("确定要删除这条动态吗？")) return;
    try {
      const res = await momentsApi.delete(id);
      if (res.success) {
        showMessage("动态已删除");
        loadTabData("moments");
      } else {
        showMessage(res.error || "删除失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  function openEditMomentModal(moment: any) {
    editingMoment = moment;
    let photos: string[] = [];
    if (Array.isArray(moment.images)) {
      photos = moment.images.map((img: any) => (typeof img === "string" ? img : img?.src || "")).filter(Boolean);
    } else if (Array.isArray(moment.photos)) {
      photos = moment.photos.filter(Boolean);
    }
    editMomentForm = {
      id: moment.id,
      content: moment.content || "",
      mood: moment.mood || "✨",
      location: moment.location || "",
      photos,
      pinned: Boolean(moment.pinned),
      draft: Boolean(moment.draft),
    };
    momentModalOpen = true;
  }

  function removeEditMomentPhoto(index: number) {
    editMomentForm.photos = editMomentForm.photos.filter((_, i) => i !== index);
  }

  async function saveMomentEdit() {
    if (!editMomentForm.content.trim()) return showMessage("请输入动态内容", true);
    try {
      const payload = {
        content: editMomentForm.content.trim(),
        mood: editMomentForm.mood.trim(),
        location: editMomentForm.location.trim(),
        photos: editMomentForm.photos,
        images: editMomentForm.photos.map((url) => ({ src: url, alt: "" })),
        pinned: editMomentForm.pinned ? 1 : 0,
        draft: editMomentForm.draft ? 1 : 0,
      };
      const res = await momentsApi.update(editMomentForm.id, payload);
      if (res.success) {
        showMessage("动态日记更新成功！");
        momentModalOpen = false;
        editingMoment = null;
        loadTabData("moments");
      } else {
        showMessage(res.error || "更新失败", true);
      }
    } catch (err: any) {
      showMessage(err.message || "请求异常", true);
    }
  }

  // --- Pages Operations ---
  function openNewPageModal() {
    editingPage = null;
    pageForm = {
      id: 0,
      title: "",
      slug: "",
      icon: "",
      content: "",
      status: "published",
    };
    pageEditorTab = "edit";
    pageModalOpen = true;
  }

  function openEditPageModal(page: any) {
    editingPage = page;
    pageForm = {
      id: page.id,
      title: page.title || "",
      slug: page.slug || "",
      icon: page.icon || "",
      content: page.content || "",
      status: page.draft ? "draft" : (page.status || "published"),
    };
    pageEditorTab = "edit";
    pageModalOpen = true;
  }

  async function savePage() {
    if (!pageForm.title.trim()) return showMessage("请输入页面标题", true);
    if (!pageForm.slug.trim()) return showMessage("请输入页面路径 slug (例如: about)", true);
    const isDraft = pageForm.status === "draft";
    const payload = {
      title: pageForm.title.trim(),
      slug: pageForm.slug.trim().toLowerCase(),
      icon: pageForm.icon?.trim() || undefined,
      content: pageForm.content,
      draft: isDraft,
      status: pageForm.status,
    };
    try {
      let res;
      if (editingPage) {
        res = await pagesApi.update(editingPage.slug, payload);
      } else {
        res = await pagesApi.create(payload);
      }
      if (res.success) {
        showMessage("页面保存成功！可在 /pages/" + payload.slug + " 预览");
        pageModalOpen = false;
        loadTabData("pages");
      } else {
        showMessage(res.error || "保存失败", true);
      }
    } catch (err: any) {
      showMessage(err.message || "请求异常", true);
    }
  }

  async function deletePage(id: number) {
    if (!confirm("确定要删除此自定义独立页面吗？")) return;
    try {
      const res = await pagesApi.delete(id);
      if (res.success) {
        showMessage("页面已删除");
        loadTabData("pages");
      } else {
        showMessage(res.error || "删除失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Friends Operations ---
  let editingFriend = $state<any>(null);

  function openNewFriendModal() {
    editingFriend = null;
    friendForm = {
      id: 0,
      name: "",
      url: "",
      avatar: "",
      desc: "",
      status: "approved",
    };
    friendModalOpen = true;
  }

  function openEditFriendModal(friend: any) {
    editingFriend = friend;
    friendForm = {
      id: friend.id,
      name: friend.name,
      url: friend.url,
      avatar: friend.avatar,
      desc: friend.desc || "",
      status: friend.status || (friend.accepted === 1 ? "approved" : "pending"),
    };
    friendModalOpen = true;
  }

  async function saveFriend() {
    if (!friendForm.name.trim() || !friendForm.url.trim() || !friendForm.avatar.trim()) {
      showMessage("请填写友链站点名称、网址与头像链接", true);
      return;
    }
    const payload = {
      name: friendForm.name.trim(),
      url: friendForm.url.trim(),
      avatar: friendForm.avatar.trim(),
      desc: friendForm.desc.trim(),
      status: friendForm.status,
      accepted: friendForm.status === "approved" ? 1 : 0,
    };
    try {
      if (editingFriend) {
        const res = await friendsApi.update(editingFriend.id, payload);
        if (res.success) {
          showMessage("友链信息更新成功！");
          friendModalOpen = false;
          loadTabData("friends");
        } else {
          showMessage(res.error || "更新失败", true);
        }
      } else {
        const res = await friendsApi.create(payload);
        if (res.success) {
          showMessage("添加友链成功！");
          friendModalOpen = false;
          loadTabData("friends");
        } else {
          showMessage(res.error || "添加失败", true);
        }
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  async function approveFriend(id: number) {
    try {
      const res = await friendsApi.update(id, { status: "approved", accepted: 1 });
      if (res.success) {
        showMessage("已批准该友链申请");
        loadTabData("friends");
      } else {
        showMessage(res.error || "操作失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  async function deleteFriend(id: number) {
    if (!confirm("确定要删除该友链吗？")) return;
    try {
      const res = await friendsApi.delete(id);
      if (res.success) {
        showMessage("友链已删除");
        loadTabData("friends");
      } else {
        showMessage(res.error || "删除失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Users Operations ---
  function openAdjustPoints(user: any) {
    targetUser = user;
    adjustPointsDelta = 0;
    userPointsModalOpen = true;
  }

  async function saveAdjustPoints() {
    if (!targetUser) return;
    try {
      const res = await adminApi.updateUserPoints(targetUser.id, { delta: adjustPointsDelta });
      if (res.success) {
        showMessage(`已成功为用户 ${targetUser.username} 调整积分`);
        userPointsModalOpen = false;
        loadTabData("users");
      } else {
        showMessage(res.error || "调整失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  async function toggleUserRole(user: any) {
    const newRole = user.role === "admin" ? "user" : "admin";
    if (!confirm(`确定要将用户 ${user.username} 的身份变更为 ${newRole} 吗？`)) return;
    try {
      const res = await adminApi.updateUserRole(user.id, newRole);
      if (res.success) {
        showMessage("用户角色变更成功");
        loadTabData("users");
      } else {
        showMessage(res.error || "变更失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  async function toggleUserStatus(user: any) {
    const newStatus = user.status === "banned" ? "active" : "banned";
    const actionText = newStatus === "banned" ? "封禁" : "解封";
    if (!confirm(`确定要${actionText}用户 ${user.username} 吗？`)) return;
    try {
      const res = await adminApi.updateUserStatus(user.id, newStatus);
      if (res.success) {
        showMessage(`用户已${actionText}`);
        loadTabData("users");
      } else {
        showMessage(res.error || "操作失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Music Operations ---
  function addMusicTrack() {
    siteConfigState.musicTracks = [
      ...siteConfigState.musicTracks,
      {
        id: "track-" + Date.now(),
        title: "新音乐曲目",
        artist: "未知歌手",
        cover: "/assets/images/music/dazbee.webp",
        source: "/assets/music/url/dazbee.mp3",
        duration: 240,
      },
    ];
  }

  function removeMusicTrack(index: number) {
    siteConfigState.musicTracks = siteConfigState.musicTracks.filter((_, i) => i !== index);
  }

  // --- Profile Links Operations ---
  function addProfileLink(preset?: { name: string; icon: string; url: string }) {
    siteConfigState.profileLinks = [
      ...siteConfigState.profileLinks,
      preset ? { ...preset } : { name: "GitHub", icon: "fa6-brands:github", url: "https://github.com" },
    ];
  }

  function removeProfileLink(index: number) {
    siteConfigState.profileLinks = siteConfigState.profileLinks.filter((_, i) => i !== index);
  }

  // --- Announcement Multi-Links Operations ---
  function addAnnouncementLinkPreset(name: "github" | "steam" | "facebook") {
    let preset = { text: "GitHub", url: "https://github.com/yiran168/Shirine" };
    if (name === "steam") {
      preset = { text: "Steam", url: "https://store.steampowered.com" };
    } else if (name === "facebook") {
      preset = { text: "Facebook", url: "https://www.facebook.com" };
    }
    const current = siteConfigState.announcementLinks || [];
    if (!current.some((l) => l.text.toLowerCase() === preset.text.toLowerCase())) {
      siteConfigState.announcementLinks = [...current, preset];
    }
    if (siteConfigState.announcementLinks.length > 0) {
      siteConfigState.announcementLinkText = siteConfigState.announcementLinks[0].text;
      siteConfigState.announcementLinkUrl = siteConfigState.announcementLinks[0].url;
    }
  }

  function addCustomAnnouncementLink() {
    siteConfigState.announcementLinks = [
      ...(siteConfigState.announcementLinks || []),
      { text: "自定义链接", url: "https://" },
    ];
  }

  function removeAnnouncementLink(index: number) {
    siteConfigState.announcementLinks = (siteConfigState.announcementLinks || []).filter((_, i) => i !== index);
    if (siteConfigState.announcementLinks.length > 0) {
      siteConfigState.announcementLinkText = siteConfigState.announcementLinks[0].text;
      siteConfigState.announcementLinkUrl = siteConfigState.announcementLinks[0].url;
    } else {
      siteConfigState.announcementLinkText = "";
      siteConfigState.announcementLinkUrl = "";
    }
  }

  function setAnnouncementLinkPreset(name: "github" | "steam" | "facebook") {
    addAnnouncementLinkPreset(name);
  }

  async function saveCompassSettings() {
    try {
      const res = await configApi.updateSite({ compass: siteConfigState.compass });
      if (res.success) {
        showMessage("站点罗盘导航分类与网址已保存成功！刷新前台 /compass/ 即可查看最新内容");
      } else {
        showMessage(res.error || "保存站点罗盘失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  async function saveAnimeSettings() {
    try {
      const res = await configApi.updateSite({ anime: siteConfigState.anime });
      if (res.success) {
        showMessage("追番列表与进度已保存成功！刷新前台 /anime/ 即可查看最新内容");
      } else {
        showMessage(res.error || "保存番剧列表失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Compass Operations ---
  function addCompassShelf() {
    siteConfigState.compass = [
      ...siteConfigState.compass,
      {
        key: "shelf_" + Date.now().toString(36),
        name: "新建导航分组",
        icon: "material-symbols:folder-outline-rounded",
        blurb: "分组说明描述",
        entries: [
          { label: "示例站点", href: "https://example.com", note: "站点描述", icon: "material-symbols:link-rounded" },
        ],
      },
    ];
  }

  function removeCompassShelf(shelfIndex: number) {
    siteConfigState.compass = siteConfigState.compass.filter((_, i) => i !== shelfIndex);
  }

  function addCompassEntry(shelfIndex: number) {
    const shelf = siteConfigState.compass[shelfIndex];
    if (!shelf) return;
    shelf.entries = [
      ...(shelf.entries || []),
      {
        label: "新站点",
        href: "https://",
        note: "一句话说明",
        icon: "material-symbols:link-rounded",
      },
    ];
    siteConfigState.compass = [...siteConfigState.compass];
  }

  function removeCompassEntry(shelfIndex: number, entryIndex: number) {
    const shelf = siteConfigState.compass[shelfIndex];
    if (!shelf || !shelf.entries) return;
    shelf.entries = shelf.entries.filter((_: any, i: number) => i !== entryIndex);
    siteConfigState.compass = [...siteConfigState.compass];
  }

  // --- Anime Operations ---
  function addAnimeItem() {
    siteConfigState.anime = [
      ...siteConfigState.anime,
      {
        title: "新番剧",
        cover: "/assets/images/demo-avatar.webp",
        link: "https://",
        status: "watching",
        rating: 9.0,
        progress: { watched: 1, total: 12 },
        description: "番剧感想...",
        year: String(new Date().getFullYear()),
        studio: "动画公司",
        genres: ["动画", "日常"],
      },
    ];
  }

  function removeAnimeItem(index: number) {
    siteConfigState.anime = siteConfigState.anime.filter((_, i) => i !== index);
  }

  function moveAnimeItem(index: number, direction: "up" | "down") {
    const list = [...siteConfigState.anime];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    siteConfigState.anime = list;
  }

  function moveCompassShelf(index: number, direction: "up" | "down") {
    const list = [...siteConfigState.compass];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    siteConfigState.compass = list;
  }

  function moveCompassEntry(shelfIndex: number, entryIndex: number, direction: "up" | "down") {
    const shelf = siteConfigState.compass[shelfIndex];
    if (!shelf || !shelf.entries) return;
    const list = [...shelf.entries];
    const targetIdx = direction === "up" ? entryIndex - 1 : entryIndex + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[entryIndex];
    list[entryIndex] = list[targetIdx];
    list[targetIdx] = temp;
    shelf.entries = list;
    siteConfigState.compass = [...siteConfigState.compass];
  }

  // --- Projects Operations ---
  function addProjectItem() {
    siteConfigState.projects = [
      ...siteConfigState.projects,
      {
        key: "proj_" + Date.now().toString(36),
        title: "新项目",
        summary: "项目简要描述...",
        category: "theme",
        phase: "building",
        technologies: ["TypeScript", "Svelte"],
        icon: "material-symbols:deployed-code-outline-rounded",
        cover: "/assets/images/demo-avatar.webp",
        coverAlt: "项目封面预览",
        featured: false,
        pinned: false,
        website: "",
        repository: "https://github.com",
        year: String(new Date().getFullYear()),
        enable: true,
      },
    ];
  }

  function removeProjectItem(index: number) {
    siteConfigState.projects = siteConfigState.projects.filter((_, i) => i !== index);
  }

  function moveProjectItem(index: number, direction: "up" | "down") {
    const list = [...siteConfigState.projects];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    siteConfigState.projects = list;
  }

  async function saveProjectsSettings() {
    try {
      const res = await configApi.updateSite({ projects: siteConfigState.projects });
      if (res.success) {
        showMessage("精选项目列表已保存成功！前台刷新即现");
      } else {
        showMessage(res.error || "保存项目列表失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Devices Operations ---
  function addDeviceItem() {
    siteConfigState.devices = [
      ...siteConfigState.devices,
      {
        id: "dev_" + Date.now().toString(36),
        name: "新设备",
        brand: "Apple",
        category: "desk",
        status: "active",
        specs: "配置说明",
        description: "日常工作与使用体验描述...",
        icon: "material-symbols:laptop-mac-rounded",
        image: "",
        featured: false,
        year: String(new Date().getFullYear()),
        link: "https://",
        enable: true,
      },
    ];
  }

  function removeDeviceItem(index: number) {
    siteConfigState.devices = siteConfigState.devices.filter((_, i) => i !== index);
  }

  function moveDeviceItem(index: number, direction: "up" | "down") {
    const list = [...siteConfigState.devices];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    siteConfigState.devices = list;
  }

  async function saveDevicesSettings() {
    try {
      const res = await configApi.updateSite({ devices: siteConfigState.devices });
      if (res.success) {
        showMessage("设备清单已保存成功！前台刷新即现");
      } else {
        showMessage(res.error || "保存设备清单失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Skills Operations ---
  function addSkillItem() {
    siteConfigState.skills = [
      ...siteConfigState.skills,
      {
        name: "新技能",
        description: "技能描述与熟练度说明...",
        icon: "simple-icons:typescript",
        category: "frontend",
        level: "advanced",
        enable: true,
      },
    ];
  }

  function removeSkillItem(index: number) {
    siteConfigState.skills = siteConfigState.skills.filter((_, i) => i !== index);
  }

  function moveSkillItem(index: number, direction: "up" | "down") {
    const list = [...siteConfigState.skills];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    siteConfigState.skills = list;
  }

  async function saveSkillsSettings() {
    try {
      const res = await configApi.updateSite({ skills: siteConfigState.skills });
      if (res.success) {
        showMessage("技能清单已保存成功！前台刷新即现");
      } else {
        showMessage(res.error || "保存技能清单失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Friend Apply Info Operation ---
  async function saveFriendApplyInfo() {
    try {
      const res = await configApi.updateSite({ friendApplyInfo: siteConfigState.friendApplyInfo });
      if (res.success) {
        showMessage("本站友链申请信息已保存成功！前台申请窗口即刻生效");
      } else {
        showMessage(res.error || "保存申请信息失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Timeline Operations ---
  function addTimelineItem() {
    siteConfigState.timeline = [
      {
        title: "新事件节点",
        date: new Date().toISOString().slice(0, 7).replace("-", "."),
        category: "milestone",
        subtitle: "自我突破",
        location: "",
        description: "记录新的事件、职位或项目成就...",
        highlights: ["关键成就要点 1", "关键成就要点 2"],
        tags: ["Astro", "Svelte"],
        icon: "material-symbols:rocket-launch-rounded",
        featured: false,
        enable: true,
      },
      ...siteConfigState.timeline,
    ];
  }

  function removeTimelineItem(index: number) {
    siteConfigState.timeline = siteConfigState.timeline.filter((_, i) => i !== index);
  }

  function moveTimelineItem(index: number, direction: "up" | "down") {
    const list = [...siteConfigState.timeline];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    siteConfigState.timeline = list;
  }

  async function saveTimelineSettings() {
    try {
      const res = await configApi.updateSite({ timeline: siteConfigState.timeline });
      if (res.success) {
        showMessage("时间线配置已保存成功！前台刷新即现");
      } else {
        showMessage(res.error || "保存时间线配置失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Drag and Drop Handlers ---
  function handleProjectDrop(targetIdx: number) {
    if (draggedProjectIndex === null || draggedProjectIndex === targetIdx) return;
    const list = [...siteConfigState.projects];
    const item = list.splice(draggedProjectIndex, 1)[0];
    list.splice(targetIdx, 0, item);
    siteConfigState.projects = list;
    draggedProjectIndex = null;
  }

  function handleDeviceDrop(targetIdx: number) {
    if (draggedDeviceIndex === null || draggedDeviceIndex === targetIdx) return;
    const list = [...siteConfigState.devices];
    const item = list.splice(draggedDeviceIndex, 1)[0];
    list.splice(targetIdx, 0, item);
    siteConfigState.devices = list;
    draggedDeviceIndex = null;
  }

  function handleSkillDrop(targetIdx: number) {
    if (draggedSkillIndex === null || draggedSkillIndex === targetIdx) return;
    const list = [...siteConfigState.skills];
    const item = list.splice(draggedSkillIndex, 1)[0];
    list.splice(targetIdx, 0, item);
    siteConfigState.skills = list;
    draggedSkillIndex = null;
  }

  function handleTimelineDrop(targetIdx: number) {
    if (draggedTimelineIndex === null || draggedTimelineIndex === targetIdx) return;
    const list = [...siteConfigState.timeline];
    const item = list.splice(draggedTimelineIndex, 1)[0];
    list.splice(targetIdx, 0, item);
    siteConfigState.timeline = list;
    draggedTimelineIndex = null;
  }

  // --- Clipboard & Upload Helpers ---
  async function copyToClipboard(text: string) {
    if (!text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showMessage("已复制到剪贴板！");
    } catch {
      showMessage("复制失败，请手动选择复制", true);
    }
  }

  async function handleGenericUpload(e: Event, onUploaded: (url: string) => void) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    showMessage(`正在上传 ${file.name} 至 R2 存储...`);
    try {
      const res = await uploadFile(file);
      if (res.success && res.url) {
        showMessage("上传成功！");
        onUploaded(res.url);
      } else {
        showMessage(res.error || "上传失败", true);
      }
    } catch (err: any) {
      showMessage(err.message || "上传异常", true);
    } finally {
      input.value = "";
    }
  }

  // --- Media Library Operations ---
  async function loadMediaLibrary() {
    try {
      const res = await mediaApi.list();
      const rawList = res.success ? (res.objects || res.data || []) : [];
      const uploadedList = rawList.map((f: any) => ({
        ...f,
        url: f.url?.startsWith("http") ? f.url : `${R2_PUBLIC_BASE}/${f.key.replace(/^\/+/, "")}`,
        isPreset: false,
      }));
      const uploadedKeys = new Set(uploadedList.map((f: any) => f.key));
      const presets = PRESET_MEDIA.filter((p) => !uploadedKeys.has(p.key));
      mediaFiles = [...uploadedList, ...presets];
    } catch (err: any) {
      console.error(err);
      mediaFiles = [...PRESET_MEDIA];
    }
  }

  async function deleteMediaFile(key: string) {
    if (!confirm(`确定要从 R2 存储彻底删除文件 "${key}" 吗？此操作不可恢复！`)) return;
    try {
      const res = await mediaApi.delete(key);
      if (res.success) {
        showMessage("文件已成功从 R2 删除！");
        await loadMediaLibrary();
      } else {
        showMessage(res.error || "删除失败", true);
      }
    } catch (err: any) {
      showMessage(err.message || "删除异常", true);
    }
  }

  function formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  async function handleMediaLibraryUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    mediaUploading = true;
    try {
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        showMessage(`正在上传 ${file.name} 至 R2 存储...`);
        const res = await uploadFile(file);
        if (!res.success) {
          showMessage(res.error || `上传 ${file.name} 失败`, true);
        }
      }
      showMessage("所有文件上传成功！");
      await loadMediaLibrary();
    } catch (err: any) {
      showMessage(err.message || "上传异常", true);
    } finally {
      mediaUploading = false;
      input.value = "";
    }
  }

  // --- AI Writing Assistant Operations ---
  async function fetchAiModels() {
    aiFetchingModels = true;
    try {
      const res = await aiApi.getModels({
        apiUrl: systemConfigState.aiApiUrl,
        apiKey: systemConfigState.aiApiKey,
      });
      if (res.success && Array.isArray(res.models) && res.models.length > 0) {
        aiAvailableModels = res.models;
        showMessage(`成功获取 ${res.models.length} 个可用模型！`);
      } else {
        showMessage(res.error || "获取模型列表失败，请检查 API 配置", true);
      }
    } catch (err: any) {
      showMessage(err.message || "获取模型列表异常", true);
    } finally {
      aiFetchingModels = false;
    }
  }

  function openAiAssistant(target: "post" | "moment") {
    aiTarget = target;
    aiPrompt = "";
    aiInstruction = "";
    aiResult = "";
    aiModalOpen = true;
  }

  async function executeAiGeneration(customPrompt?: string) {
    const promptToUse = customPrompt || aiInstruction || aiPrompt;
    if (!promptToUse.trim()) {
      return showMessage("请输入或选择提示词要求", true);
    }
    aiGenerating = true;
    aiResult = "";
    try {
      const contextText = aiTarget === "post"
        ? `文章标题: ${postForm.title}\n文章分类: ${postForm.category}\n已有正文:\n${postForm.content.slice(0, 2500)}`
        : `已有动态内容:\n${(momentModalOpen ? editMomentForm.content : momentContent).slice(0, 1000)}`;

      const res = await aiApi.generate({
        apiUrl: systemConfigState.aiApiUrl,
        apiKey: systemConfigState.aiApiKey,
        model: systemConfigState.aiModel,
        prompt: `【上下文】：\n${contextText}\n\n【用户指令】：\n${promptToUse}`,
        systemPrompt: "你是一个专业的个人博客写作助手。根据用户指令帮助润色、续写或整理博客内容，直接输出 Markdown 格式，不要废话。",
      });

      if (res.success && res.content) {
        aiResult = res.content;
      } else {
        showMessage(res.error || "AI 生成失败，请检查 API 配置", true);
      }
    } catch (err: any) {
      showMessage(err.message || "生成异常", true);
    } finally {
      aiGenerating = false;
    }
  }

  function insertAiResultToEditor() {
    if (!aiResult) return;
    if (aiTarget === "post") {
      postForm.content = postForm.content
        ? `${postForm.content}\n\n${aiResult}`
        : aiResult;
      showMessage("已将 AI 内容追加到博文正文！");
    } else {
      if (momentModalOpen) {
        editMomentForm.content = editMomentForm.content
          ? `${editMomentForm.content}\n\n${aiResult}`
          : aiResult;
      } else {
        momentContent = momentContent
          ? `${momentContent}\n\n${aiResult}`
          : aiResult;
      }
      showMessage("已将 AI 内容追加到动态正文！");
    }
    aiModalOpen = false;
  }

  // --- User Deletion Operation ---
  async function handleDeleteUser(user: any) {
    if (!confirm(`确定要彻底删除已封禁用户 "${user.nickname || user.username}" (ID: ${user.id}) 吗？此操作不可逆！`)) return;
    try {
      const res = await adminApi.deleteUser(user.id);
      if (res.success) {
        showMessage(`用户 ${user.username} 已成功删除！`);
        loadTabData("users");
      } else {
        showMessage(res.error || "删除用户失败", true);
      }
    } catch (err: any) {
      showMessage(err.message || "请求异常", true);
    }
  }

  // --- Live2D Model Operations ---
  function addLive2dModelEntry() {
    systemConfigState.live2dModels = [
      ...systemConfigState.live2dModels,
      { name: "新模型", url: "/pio/models/..." },
    ];
  }

  function removeLive2dModelEntry(index: number) {
    systemConfigState.live2dModels = systemConfigState.live2dModels.filter((_, i) => i !== index);
  }

  // --- Moments Image URL Helper ---
  let momentImageUrlInput = $state("");
  let editMomentImageUrlInput = $state("");

  function addMomentPhotoUrl() {
    const u = momentImageUrlInput.trim();
    if (!u) return;
    momentPhotos = [...momentPhotos, u];
    momentImageUrlInput = "";
  }

  function removeMomentPhoto(index: number) {
    momentPhotos = momentPhotos.filter((_, i) => i !== index);
  }

  function addEditMomentPhotoUrl() {
    const u = editMomentImageUrlInput.trim();
    if (!u) return;
    editMomentForm.photos = [...editMomentForm.photos, u];
    editMomentImageUrlInput = "";
  }

  // --- Seed Presets Operations ---
  async function handleSeedPresets(overwrite = false) {
    if (
      !confirm(
        overwrite
          ? "确定要恢复预设示例数据吗？此操作将重置数据库中现有的示例文章、相册、动态和友链。"
          : "确定将系统预设的示例数据（22 篇文章、6 条动态、精选相册与照片、3 个友链、4 首预设音乐）同步导入到数据库吗？"
      )
    )
      return;

    loading = true;
    try {
      const res = await adminApi.seedPresets(overwrite);
      if (res.success) {
        showMessage("预设示例数据已成功同步到 D1 数据库！前台刷新即现，后台可自由编辑删除");
        await loadDashboardData();
      } else {
        showMessage(res.error || "同步失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    } finally {
      loading = false;
    }
  }

  // --- Settings Save ---
  async function saveAllSettings() {
    try {
      const desktopBanners = siteConfigState.bannerDesktop
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const mobileBanners = siteConfigState.bannerMobile
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean);
      const sitePayload = {
        ...siteConfigState,
        lang: siteConfigState.lang,
        defaultLang: siteConfigState.lang,
        themeHue: siteConfigState.themeHue,
        themeStyle: siteConfigState.themeStyle,
        bannerDesktop: desktopBanners.length > 0 ? desktopBanners : ["/assets/images/banner/desktop/1.webp"],
        bannerMobile: mobileBanners.length > 0 ? mobileBanners : ["/assets/images/banner/mobile/1.webp"],
        bannerSubtitles: siteConfigState.bannerSubtitles.split("\n").map((s: string) => s.trim()).filter(Boolean),
      };
      const [siteRes, sysRes] = await Promise.all([
        configApi.updateSite(sitePayload),
        configApi.updateSystem(systemConfigState),
      ]);
      if (siteRes.success && sysRes.success) {
        showMessage("全站外观设定、音乐曲目、背景图与系统设置已保存生效！");
      } else {
        showMessage(siteRes.error || sysRes.error || "保存失败", true);
      }
    } catch (err: any) {
      showMessage(err.message, true);
    }
  }

  // --- Image Upload Helper ---
  async function handleFileUpload(e: Event, targetField: "postCover" | "albumCover" | "momentPhoto" | "editMomentPhoto") {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    showMessage("正在上传图片至 R2 存储...");
    const res = await uploadFile(file);
    if (res.success && res.url) {
      showMessage("图片上传成功！");
      if (targetField === "postCover") postForm.image = res.url;
      else if (targetField === "albumCover") albumForm.cover = res.url;
      else if (targetField === "momentPhoto") momentPhotos = [...momentPhotos, res.url];
      else if (targetField === "editMomentPhoto") editMomentForm.photos = [...editMomentForm.photos, res.url];
    } else {
      showMessage(res.error || "上传失败", true);
    }
  }

  async function handleAlbumPhotoUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files);
    showMessage(`正在上传 ${files.length} 张相片至 R2 存储...`);
    let count = 0;
    try {
      for (const file of files) {
        const res = await uploadFile(file);
        if (res.success && res.url) {
          count++;
          lastUploadedAlbumPhotoUrl = res.url;
          if (albumForm.photosText && albumForm.photosText.trim()) {
            albumForm.photosText += "\n" + res.url;
          } else {
            albumForm.photosText = res.url;
          }
        }
      }
      if (count > 0) {
        showMessage(`成功上传 ${count} 张相片到 R2！`);
      } else {
        showMessage("上传失败", true);
      }
    } catch (err: any) {
      showMessage(err.message || "上传异常", true);
    } finally {
      input.value = "";
    }
  }

  onMount(async () => {
    if (typeof window !== "undefined") {
      const urlLang = new URL(window.location.href).searchParams.get("lang");
      const savedAdminLang = urlLang || localStorage.getItem("shirine_admin_lang") || localStorage.getItem("shirine_lang");
      if (savedAdminLang) adminLang = savedAdminLang;
      const onDocClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest("#shirine-admin-lang-container")) {
          adminLangOpen = false;
        }
      };
      document.addEventListener("click", onDocClick);
    }

    // 1. Check if initial setup is needed
    try {
      const setupRes = await authApi.getSetupStatus();
      if (setupRes.success && setupRes.needsSetup) {
        needsSetup = true;
      }
    } catch {}

    // 2. Check current auth status
    const meRes = await authApi.me();
    if (meRes.success && meRes.user) {
      authStore.setUser(meRes.user);
    }
    if (isAdmin) {
      loadDashboardData();
    } else {
      loading = false;
    }
  });
</script>

<div class="min-h-screen bg-[var(--surface-container-lowest)] text-[var(--on-surface)] flex flex-col font-sans transition-colors duration-200">
  <!-- Toast Messages -->
  {#if errorMsg}
    <div class="fixed top-5 right-5 z-[100] px-5 py-3 rounded-2xl bg-rose-600 text-white shadow-2xl flex items-center gap-3 animate-fade-in border border-white/20">
      <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span class="text-sm font-medium">{errorMsg}</span>
    </div>
  {/if}
  {#if successMsg}
    <div class="fixed top-5 right-5 z-[100] px-5 py-3 rounded-2xl bg-emerald-600 text-white shadow-2xl flex items-center gap-3 animate-fade-in border border-white/20">
      <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
      <span class="text-sm font-medium">{successMsg}</span>
    </div>
  {/if}

  <!-- Admin Header -->
  <header class="h-16 px-6 border-b border-[var(--outline-variant)]/20 bg-[var(--surface)]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
    <div class="flex items-center gap-4">
      <a href="/" class="flex items-center gap-2 text-primary font-bold text-lg hover:opacity-80 transition-opacity">
        <span class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">S</span>
        <span>{at.adminTitle}</span>
      </a>
      <span class="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium hidden sm:inline-block">
        {at.adminConsole}
      </span>
    </div>

    <div class="flex items-center gap-3">
      <!-- Admin Language Switcher -->
      <div id="shirine-admin-lang-container" class="relative inline-block text-left">
        <button
          type="button"
          onclick={(e) => { e.stopPropagation(); adminLangOpen = !adminLangOpen; }}
          class="text-xs font-medium px-3 py-1.5 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] transition-all flex items-center gap-1.5"
          title="Switch Language / 切换语言"
        >
          <svg class="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          <span class="font-semibold">{currentAdminLangOption.name}</span>
          <svg class="w-3 h-3 opacity-60 transition-transform duration-200 {adminLangOpen ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {#if adminLangOpen}
          <div class="absolute right-0 mt-2 w-36 rounded-2xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-xl py-1.5 z-50 animate-fade-in backdrop-blur-lg">
            {#each SUPPORTED_LANGUAGES as lang}
              <button
                type="button"
                onclick={() => setAdminLanguage(lang.code)}
                class="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left transition-colors {adminLang === lang.code ? 'bg-primary/10 text-primary font-bold' : 'text-[var(--on-surface)] hover:bg-[var(--surface-container)]'}"
              >
                <span>{lang.name}</span>
                {#if adminLang === lang.code}
                  <svg class="w-3.5 h-3.5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <a
        href="/"
        class="text-xs font-medium px-3.5 py-1.5 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] transition-all flex items-center gap-1.5"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
        <span>{at.backToSite}</span>
      </a>

      {#if authStore.user}
        <div class="flex items-center gap-2 pl-2 border-l border-[var(--outline-variant)]/20">
          <img src={authStore.user.avatar || "/assets/avatars/avatar_01.webp"} alt="Admin" class="w-8 h-8 rounded-full ring-2 ring-primary/20 object-cover" />
          <div class="hidden md:flex flex-col text-left">
            <span class="text-xs font-semibold">{authStore.user.nickname || authStore.user.username}</span>
            <span class="text-[10px] text-primary capitalize font-medium">{authStore.user.role}</span>
          </div>
          <button
            onclick={() => authStore.logout()}
            class="text-xs text-[var(--on-surface-variant)] hover:text-error ml-2 p-1.5 rounded-lg hover:bg-[var(--surface-container)]"
            title={at.signOut}
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      {/if}
    </div>
  </header>

  <!-- Content Container -->
  {#if !isAdmin}
    {#if needsSetup}
      <!-- Setup Wizard: Bootstrap Initial SuperAdmin -->
      <div class="flex-1 flex items-center justify-center p-6">
        <div class="w-full max-w-md p-8 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-2xl text-center">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <h2 class="text-2xl font-bold mb-2">系统初始化向导</h2>
          <p class="text-sm text-[var(--on-surface-variant)] mb-6">
            欢迎部署 Shirine！检测到系统尚未初始化管理员账号，请在此创建首位超级管理员。
          </p>
          <form onsubmit={(e) => { e.preventDefault(); handleSetupAdmin(); }} class="space-y-4 text-left">
            <div>
              <label class="text-xs font-medium block mb-1.5">超级管理员账号</label>
              <input
                type="text"
                bind:value={setupUsername}
                placeholder="例如 admin"
                required
                minlength="3"
                class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none"
              />
            </div>
            <div>
              <label class="text-xs font-medium block mb-1.5">管理员昵称</label>
              <input
                type="text"
                bind:value={setupNickname}
                placeholder="例如 Shirine Admin"
                class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none"
              />
            </div>
            <div>
              <label class="text-xs font-medium block mb-1.5">登录密码 (至少6位)</label>
              <input
                type="password"
                bind:value={setupPassword}
                placeholder="请输入密码"
                required
                minlength="6"
                class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none"
              />
            </div>
            <div>
              <label class="text-xs font-medium block mb-1.5">确认密码</label>
              <input
                type="password"
                bind:value={setupConfirmPassword}
                placeholder="请再次输入密码"
                required
                minlength="6"
                class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none"
              />
            </div>
            <div>
              <label class="text-xs font-medium block mb-1.5">安装验证密钥 (生产环境必填 SETUP_TOKEN；本地开发未配置可留空)</label>
              <input
                type="text"
                bind:value={setupToken}
                placeholder="生产环境必填 SETUP_TOKEN"
                class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={setupLoading}
              class="w-full py-3 rounded-full bg-primary text-on-primary font-semibold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all disabled:opacity-50 mt-4"
            >
              {setupLoading ? "正在初始化系统..." : "完成初始化并登入"}
            </button>
          </form>
        </div>
      </div>
    {:else}
      <!-- Auth Gate / Admin Login -->
      <div class="flex-1 flex items-center justify-center p-6">
        <div class="w-full max-w-md p-8 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-2xl text-center">
          <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
          </div>
          <h2 class="text-2xl font-bold mb-2">需要管理员登录</h2>
          <p class="text-sm text-[var(--on-surface-variant)] mb-6">
            当前后台仅对超级管理员或管理员开放。
          </p>
          <form onsubmit={(e) => { e.preventDefault(); handleAdminLogin(); }} class="space-y-4 text-left">
            <div>
              <label class="text-xs font-medium block mb-1.5">用户名或邮箱</label>
              <input
                type="text"
                bind:value={loginUsername}
                placeholder="请输入管理员账号或邮箱"
                required
                class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none"
              />
            </div>
            <div>
              <label class="text-xs font-medium block mb-1.5">登录密码</label>
              <input
                type="password"
                bind:value={loginPassword}
                placeholder="请输入密码"
                required
                class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              class="w-full py-3 rounded-full bg-primary text-on-primary font-semibold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all disabled:opacity-50 mt-4"
            >
              {loginLoading ? "验证中..." : "进入管理面板"}
            </button>
            <button
              type="button"
              onclick={() => authStore.openAuthModal("login")}
              class="w-full py-2.5 rounded-full border border-primary/30 text-primary font-medium text-xs hover:bg-primary/5 active:scale-98 transition-all mt-2"
            >
              使用安全弹窗登录 (支持人机验证)
            </button>
          </form>
        </div>
      </div>
    {/if}
  {:else}
    <!-- Main Admin Layout -->
    <div class="flex-1 flex flex-col md:flex-row">
      <!-- Sidebar Navigation -->
      <aside class="w-full md:w-64 border-r border-[var(--outline-variant)]/20 bg-[var(--surface-container-lowest)] p-4 flex md:flex-col gap-1 overflow-x-auto shrink-0">
        <button
          onclick={() => switchTab("overview")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'overview' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
          <span>{at.overview}</span>
        </button>

        <button
          onclick={() => switchTab("posts")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'posts' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>
          <span>{at.posts}</span>
        </button>

        <button
          onclick={() => switchTab("albums")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'albums' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span>{at.albums}</span>
        </button>

        <button
          onclick={() => switchTab("moments")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'moments' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          <span>{at.moments}</span>
        </button>

        <button
          onclick={() => switchTab("pages")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'pages' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          <span>{at.pages}</span>
        </button>

        <button
          onclick={() => switchTab("friends")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'friends' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          <span>{at.friends}</span>
        </button>

        <button
          onclick={() => switchTab("projects")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'projects' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          <span>🚀 项目管理</span>
        </button>

        <button
          onclick={() => switchTab("devices")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'devices' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          <span>💻 设备管理</span>
        </button>

        <button
          onclick={() => switchTab("skills")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'skills' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span>🛠️ 技能管理</span>
        </button>

        <button
          onclick={() => switchTab("compass")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'compass' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
          <span>🧭 站点罗盘</span>
        </button>

        <button
          onclick={() => switchTab("anime")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'anime' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          <span>📺 番剧追番</span>
        </button>

        <button
          onclick={() => switchTab("timeline")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'timeline' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>⏳ {at.timeline}</span>
        </button>

        <button
          onclick={() => switchTab("media")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'media' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          <span>🖼️ {at.media}</span>
        </button>

        <button
          onclick={() => switchTab("guide")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'guide' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          <span>📖 {at.guide}</span>
        </button>

        <button
          onclick={() => switchTab("users")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'users' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          <span>{at.users}</span>
        </button>

        <button
          onclick={() => switchTab("settings")}
          class="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left whitespace-nowrap {currentTab === 'settings' ? 'bg-primary text-on-primary shadow-sm' : 'hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span>{at.settings}</span>
        </button>
      </aside>

      <!-- Main Workspace -->
      <main class="flex-1 p-6 md:p-8 overflow-y-auto">
        {#if currentTab === "overview"}
          <!-- Overview Cards -->
          <div class="mb-8">
            <h1 class="text-2xl font-bold mb-2">仪表盘概览</h1>
            <p class="text-sm text-[var(--on-surface-variant)]">
              欢迎回来，{authStore.user?.nickname || authStore.user?.username}！当前系统运行在 Cloudflare Workers + D1 架构上。
            </p>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--outline-variant)]/30">
              <span class="text-xs text-[var(--on-surface-variant)] block mb-1">文章总数</span>
              <span class="text-2xl font-bold text-primary">{stats.totalPosts}</span>
            </div>
            <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--outline-variant)]/30">
              <span class="text-xs text-[var(--on-surface-variant)] block mb-1">相册总数</span>
              <span class="text-2xl font-bold text-secondary">{stats.totalAlbums}</span>
            </div>
            <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--outline-variant)]/30">
              <span class="text-xs text-[var(--on-surface-variant)] block mb-1">动态日记</span>
              <span class="text-2xl font-bold text-tertiary">{stats.totalMoments}</span>
            </div>
            <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--outline-variant)]/30">
              <span class="text-xs text-[var(--on-surface-variant)] block mb-1">注册用户</span>
              <span class="text-2xl font-bold text-amber-500">{stats.totalUsers}</span>
            </div>
            <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 col-span-2 lg:col-span-1">
              <span class="text-xs text-[var(--on-surface-variant)] block mb-1">流通总积分</span>
              <span class="text-2xl font-bold text-purple-500">{stats.totalPoints}</span>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30">
            <h2 class="text-lg font-bold mb-4">快捷操作</h2>
            <div class="flex flex-wrap gap-3">
              <button
                onclick={openNewPostModal}
                class="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-medium text-sm shadow hover:brightness-105 transition-all flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                <span>发布新博文</span>
              </button>
              <button
                onclick={openNewAlbumModal}
                class="px-5 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] font-medium text-sm transition-all flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span>新建相册</span>
              </button>
              <button
                onclick={() => handleSeedPresets(false)}
                class="px-5 py-2.5 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-medium text-sm transition-all flex items-center gap-2"
                title="将系统所有预设文章、相册、动态和友链导入至 D1 数据库"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                <span>同步预设示例到数据库</span>
              </button>
              <button
                onclick={() => switchTab("compass")}
                class="px-5 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] font-medium text-sm transition-all flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                <span>管理站点罗盘</span>
              </button>
              <button
                onclick={() => switchTab("anime")}
                class="px-5 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] font-medium text-sm transition-all flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                <span>管理番剧清单</span>
              </button>
              <button
                onclick={() => switchTab("projects")}
                class="px-5 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] font-medium text-sm transition-all flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                <span>管理精选项目</span>
              </button>
              <button
                onclick={() => switchTab("devices")}
                class="px-5 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] font-medium text-sm transition-all flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <span>管理我的设备</span>
              </button>
              <button
                onclick={() => switchTab("skills")}
                class="px-5 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] font-medium text-sm transition-all flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                <span>管理技能清单</span>
              </button>
              <button
                onclick={() => switchTab("settings")}
                class="px-5 py-2.5 rounded-xl border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] font-medium text-sm transition-all flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>
                <span>配置签到积分与系统</span>
              </button>
            </div>
          </div>

        {:else if currentTab === "posts"}
          <!-- Posts List & Controls -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold">博文管理</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">支持实时 Markdown 编辑与预览、分类标签管理、及 3 级权限限制</p>
            </div>
            <div class="flex items-center gap-3">
              <button
                onclick={() => (tagManagerModalOpen = true)}
                class="px-4 py-2.5 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <svg class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                <span>标签管理 ({existingTagsWithCount.length})</span>
              </button>
              <button
                onclick={openNewPostModal}
                class="px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-semibold shadow hover:brightness-105 flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                <span>撰写新文章</span>
              </button>
            </div>
          </div>

          <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/30 rounded-2xl overflow-hidden shadow-sm">
            <table class="w-full text-left text-sm">
              <thead class="bg-[var(--surface-container-low)] border-b border-[var(--outline-variant)]/20 text-xs text-[var(--on-surface-variant)] uppercase">
                <tr>
                  <th class="px-6 py-3.5">标题</th>
                  <th class="px-4 py-3.5">分类 / 标签</th>
                  <th class="px-4 py-3.5">权限类型</th>
                  <th class="px-4 py-3.5">发布时间</th>
                  <th class="px-6 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--outline-variant)]/10">
                {#each posts as post}
                  <tr class="hover:bg-[var(--surface-container-lowest)] transition-colors">
                    <td class="px-6 py-4">
                      <div class="font-semibold text-[var(--on-surface)] flex items-center gap-2">
                        {#if post.pinned}<span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">置顶</span>{/if}
                        <span>{post.title}</span>
                      </div>
                      <span class="text-xs text-[var(--on-surface-variant)]">{post.slug}</span>
                    </td>
                    <td class="px-4 py-4 text-xs">
                      <span class="px-2 py-0.5 rounded-md bg-[var(--surface-container)] font-medium">{post.category || "默认"}</span>
                    </td>
                    <td class="px-4 py-4 text-xs">
                      {#if post.permissionType === 'login_required'}
                        <span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">需登录</span>
                      {:else if post.permissionType === 'points_required'}
                        <span class="px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 font-medium">{post.requiredPoints} 积分解锁</span>
                      {:else}
                        <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">公开</span>
                      {/if}
                    </td>
                    <td class="px-4 py-4 text-xs text-[var(--on-surface-variant)]">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 text-right space-x-2">
                      <button onclick={() => openEditPostModal(post)} class="text-primary hover:underline text-xs font-medium">编辑</button>
                      <button onclick={() => deletePost(post.id)} class="text-error hover:underline text-xs font-medium">删除</button>
                    </td>
                  </tr>
                {/each}
                {#if posts.length === 0}
                  <tr>
                    <td colspan="5" class="py-8 text-center text-xs text-[var(--on-surface-variant)]">暂无博文，点击右上角撰写新文章</td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>

        {:else if currentTab === "albums"}
          <!-- Albums Management -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold">相册图库</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">管理瀑布流、网格相册，支持按相册设置登录或积分解锁</p>
            </div>
            <button
              onclick={openNewAlbumModal}
              class="px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-semibold shadow hover:brightness-105 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              <span>新建相册</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            {#each albums as album}
              <div class="rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface)] overflow-hidden shadow-sm flex flex-col">
                <div class="h-40 bg-[var(--surface-container)] relative overflow-hidden">
                  {#if album.cover}
                    <img src={album.cover} alt={album.title} class="w-full h-full object-cover" />
                  {:else}
                    <div class="w-full h-full flex items-center justify-center text-[var(--on-surface-variant)] text-xs">无封面</div>
                  {/if}
                  {#if album.permissionType !== 'public'}
                    <span class="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md {album.permissionType === 'login_required' ? 'bg-amber-500/80 text-white' : 'bg-purple-600/80 text-white'}">
                      {album.permissionType === 'login_required' ? '需登录' : `${album.requiredPoints} 积分`}
                    </span>
                  {/if}
                </div>
                <div class="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 class="font-bold text-base mb-1">{album.title}</h3>
                    <p class="text-xs text-[var(--on-surface-variant)] line-clamp-2">{album.description || "暂无描述"}</p>
                  </div>
                  <div class="mt-4 pt-3 border-t border-[var(--outline-variant)]/10 flex items-center justify-between text-xs">
                    <span class="text-[var(--on-surface-variant)]">照片数: {album.photoCount ?? (Array.isArray(album.photos) ? album.photos.length : 0)}</span>
                    <div class="space-x-2">
                      <button onclick={() => openEditAlbumModal(album)} class="text-primary font-medium hover:underline">编辑</button>
                      <button onclick={() => deleteAlbum(album.id)} class="text-error font-medium hover:underline">删除</button>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>

        {:else if currentTab === "moments"}
          <!-- Moments Management -->
          <div class="mb-6">
            <h1 class="text-2xl font-bold">动态日记</h1>
            <p class="text-xs text-[var(--on-surface-variant)] mt-1">发布短动态日记，支持心情、位置与多图</p>
          </div>

          <!-- Quick Moment Publisher -->
          <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm mb-8 max-w-2xl">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-[var(--on-surface)]">撰写动态日记</span>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={() => openAiAssistant("moment")}
                  class="px-2.5 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium flex items-center gap-1 transition-colors"
                  title="使用 AI 智能优化或续写动态"
                >
                  <span>🤖 AI 写作助手</span>
                </button>
                <div class="flex items-center rounded-xl bg-[var(--surface-container)] p-0.5 text-xs font-medium border border-[var(--outline-variant)]/20">
                  <button
                    type="button"
                    onclick={() => (momentEditorTab = "edit")}
                    class="px-2.5 py-0.5 rounded-lg transition-colors {momentEditorTab === 'edit' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                  >
                    编辑源码
                  </button>
                  <button
                    type="button"
                    onclick={() => (momentEditorTab = "preview")}
                    class="px-2.5 py-0.5 rounded-lg transition-colors {momentEditorTab === 'preview' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                  >
                    实时预览
                  </button>
                </div>
              </div>
            </div>
            {#if momentEditorTab === "edit"}
              <textarea
                bind:value={momentContent}
                rows="3"
                placeholder="分享今天的灵感与日常..."
                class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none resize-none"
              ></textarea>
            {:else}
              <div class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] min-h-[90px] text-sm prose dark:prose-invert max-w-none">
                {#if momentPreviewHtml}
                  {@html momentPreviewHtml}
                {:else}
                  <span class="text-xs text-[var(--on-surface-variant)] italic">暂无内容，请在编辑栏输入文字</span>
                {/if}
              </div>
            {/if}
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <input
                  type="text"
                  bind:value={momentMood}
                  placeholder="心情 (如 ✨/🌸)"
                  class="w-24 px-3 py-1.5 text-xs rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] outline-none"
                />
                <input
                  type="text"
                  bind:value={momentLocation}
                  placeholder="地点 (可选)"
                  class="w-32 px-3 py-1.5 text-xs rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] outline-none"
                />
                <label class="text-xs px-3 py-1.5 rounded-xl border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] cursor-pointer flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span>上传图片</span>
                  <input type="file" accept="image/*" class="hidden" onchange={(e) => handleFileUpload(e, "momentPhoto")} />
                </label>
                <div class="flex items-center gap-1">
                  <input
                    type="text"
                    bind:value={momentImageUrlInput}
                    placeholder="输入图片 URL..."
                    class="w-36 px-2.5 py-1.5 text-xs rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] outline-none"
                    onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMomentPhotoUrl(); } }}
                  />
                  <button
                    type="button"
                    onclick={addMomentPhotoUrl}
                    class="text-xs px-2.5 py-1.5 rounded-xl bg-[var(--surface-container-high)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline-variant)]/30 text-[var(--on-surface)] transition-colors"
                  >
                    添加
                  </button>
                </div>
              </div>
              <button
                onclick={publishMoment}
                class="px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 transition-all"
              >
                发布动态
              </button>
            </div>
            {#if momentPhotos.length > 0}
              <div class="mt-3 space-y-2">
                <div class="flex gap-2 overflow-x-auto pb-1">
                  {#each momentPhotos as photo, pIdx}
                    <div class="relative group w-14 h-14 shrink-0 rounded-xl overflow-hidden ring-1 ring-primary/30">
                      <img src={photo} alt="Upload" class="w-full h-full object-cover" />
                      <button
                        type="button"
                        onclick={() => removeMomentPhoto(pIdx)}
                        class="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white hover:bg-error transition-colors"
                        title="移除"
                      >
                        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  {/each}
                </div>
                <div class="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {#each momentPhotos as photo, pIdx}
                    <div class="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--surface-container)] text-xs">
                      <span class="truncate font-mono text-[11px] flex-1 text-[var(--on-surface-variant)]">{photo}</span>
                      <button type="button" class="text-primary hover:underline text-[11px] shrink-0 font-medium" onclick={() => copyToClipboard(photo)}>复制链接</button>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>

          <!-- Moments List -->
          <div class="space-y-4 max-w-2xl">
            {#each moments as moment}
              <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-2 text-xs flex-wrap">
                    <span class="text-base">{moment.mood || "✨"}</span>
                    <span class="font-semibold text-[var(--on-surface)]">{new Date(moment.createdAt).toLocaleString()}</span>
                    {#if moment.location}<span class="text-[var(--on-surface-variant)]">· {moment.location}</span>{/if}
                    {#if moment.pinned}<span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">置顶</span>{/if}
                    {#if moment.draft}<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold">草稿</span>{/if}
                  </div>
                  <p class="text-sm leading-relaxed whitespace-pre-wrap">{moment.content}</p>
                  {#if (moment.images && moment.images.length > 0) || (moment.photos && moment.photos.length > 0)}
                    <div class="flex gap-2 mt-3 overflow-x-auto">
                      {#each (moment.images || moment.photos) as img}
                        <img src={typeof img === 'string' ? img : (img.src || img.url)} alt="" class="w-12 h-12 rounded-xl object-cover ring-1 ring-primary/20" />
                      {/each}
                    </div>
                  {/if}
                </div>
                <div class="space-x-2 shrink-0 ml-4">
                  <button onclick={() => openEditMomentModal(moment)} class="text-xs text-primary hover:underline font-medium">编辑</button>
                  <button onclick={() => deleteMoment(moment.id)} class="text-xs text-error hover:underline font-medium">删除</button>
                </div>
              </div>
            {/each}
            {#if moments.length === 0}
              <div class="p-8 text-center text-xs text-[var(--on-surface-variant)] rounded-2xl border border-[var(--outline-variant)]/20 bg-[var(--surface)]">
                暂无动态日记，在上方发布第一条日常随笔吧
              </div>
            {/if}
          </div>

        {:else if currentTab === "pages"}
          <!-- Custom Pages Management -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold">自定义独立页面</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">创建和维护独立单页（例如：关于页、隐私政策等），支持即时编辑与发布</p>
            </div>
            <button
              onclick={openNewPageModal}
              class="px-5 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 transition-all flex items-center gap-1.5"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              <span>新建独立页面</span>
            </button>
          </div>

          <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/30 rounded-2xl overflow-hidden shadow-sm">
            <table class="w-full text-left text-sm">
              <thead class="bg-[var(--surface-container-low)] border-b border-[var(--outline-variant)]/20 text-xs text-[var(--on-surface-variant)]">
                <tr>
                  <th class="px-6 py-3.5">页面标题</th>
                  <th class="px-4 py-3.5">路径 (Slug)</th>
                  <th class="px-4 py-3.5">状态</th>
                  <th class="px-4 py-3.5">更新时间</th>
                  <th class="px-6 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--outline-variant)]/10">
                {#each pages as page}
                  <tr class="hover:bg-[var(--surface-container-lowest)] transition-colors">
                    <td class="px-6 py-4 font-semibold text-[var(--on-surface)]">
                      <div class="flex items-center gap-2">
                        {#if page.icon}
                          <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-container-high)] text-primary font-mono">{page.icon}</span>
                        {/if}
                        <span>{page.title}</span>
                      </div>
                    </td>
                    <td class="px-4 py-4 text-xs font-mono text-primary">
                      <a href={page.slug === 'about' ? '/about/' : `/pages/${page.slug}/`} target="_blank" class="hover:underline">
                        {page.slug === 'about' ? '/about/' : `/pages/${page.slug}/`}
                      </a>
                    </td>
                    <td class="px-4 py-4 text-xs">
                      {#if !page.draft && page.status !== 'draft'}
                        <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">已发布</span>
                      {:else}
                        <span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">草稿</span>
                      {/if}
                    </td>
                    <td class="px-4 py-4 text-xs text-[var(--on-surface-variant)]">
                      {page.updatedAt ? new Date(page.updatedAt).toLocaleDateString() : (page.createdAt ? new Date(page.createdAt).toLocaleDateString() : "-")}
                    </td>
                    <td class="px-6 py-4 text-right space-x-2">
                      <a
                        href={page.slug === 'about' ? '/about/' : `/pages/${page.slug}/`}
                        target="_blank"
                        class="text-emerald-600 dark:text-emerald-400 font-medium text-xs hover:underline"
                      >
                        预览
                      </a>
                      <button onclick={() => openEditPageModal(page)} class="text-primary font-medium text-xs hover:underline">编辑</button>
                      <button onclick={() => deletePage(page.id)} class="text-error font-medium text-xs hover:underline">删除</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
            {#if pages.length === 0}
              <div class="p-8 text-center space-y-3">
                <p class="text-sm text-[var(--on-surface-variant)]">暂无独立页面记录。预设的「关于」可通过一键同步导入。</p>
                <button
                  type="button"
                  onclick={() => handleSeedPresets(false)}
                  class="px-5 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-xs transition-colors"
                >
                  📥 立即同步预设页面到数据库
                </button>
              </div>
            {/if}
          </div>

        {:else if currentTab === "friends"}
          <!-- Friends Links Management -->
          <div class="mb-6 flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold">友链管理与申请</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">审核访客提交的友链申请，或直接添加/编辑友链</p>
            </div>
            <button
              onclick={openNewFriendModal}
              class="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 flex items-center gap-1.5 transition-all active:scale-98"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              <span>添加友链</span>
            </button>
          </div>

          <!-- Friend Apply Info Configuration -->
          <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm mb-6">
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-base font-bold flex items-center gap-2">
                <span>✦ 本站友链申请信息配置 (My Site Info for Friends)</span>
              </h2>
              <button
                type="button"
                onclick={saveFriendApplyInfo}
                class="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:brightness-105 transition-all flex items-center gap-1 shadow"
              >
                保存本站信息
              </button>
            </div>
            <p class="text-xs text-[var(--on-surface-variant)] mb-4">访客在前台 /friends/ 申请友链时看到的本站信息，支持自定义站点名、地址、头像与描述，方便其他博主添加贵站</p>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">本站名称</label>
                <input
                  type="text"
                  bind:value={siteConfigState.friendApplyInfo.name}
                  placeholder="如 Shirine"
                  class="w-full px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">本站网址</label>
                <input
                  type="text"
                  bind:value={siteConfigState.friendApplyInfo.url}
                  placeholder="https://..."
                  class="w-full px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-xs outline-none font-mono"
                />
              </div>
              <div>
                <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">站点头像 URL</label>
                <input
                  type="text"
                  bind:value={siteConfigState.friendApplyInfo.avatar}
                  placeholder="/assets/images/demo-avatar.webp"
                  class="w-full px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-xs outline-none"
                />
              </div>
              <div>
                <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">站点描述</label>
                <input
                  type="text"
                  bind:value={siteConfigState.friendApplyInfo.desc}
                  placeholder="一句话站点描述..."
                  class="w-full px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-xs outline-none"
                />
              </div>
            </div>
          </div>

          <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/30 rounded-2xl overflow-hidden shadow-sm">
            <table class="w-full text-left text-sm">
              <thead class="bg-[var(--surface-container-low)] border-b border-[var(--outline-variant)]/20 text-xs text-[var(--on-surface-variant)]">
                <tr>
                  <th class="px-6 py-3.5">站点名称与描述</th>
                  <th class="px-4 py-3.5">网址</th>
                  <th class="px-4 py-3.5">状态</th>
                  <th class="px-6 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--outline-variant)]/10">
                {#each friends as friend}
                  <tr class="hover:bg-[var(--surface-container-lowest)] transition-colors">
                    <td class="px-6 py-4 flex items-center gap-3">
                      <img src={friend.avatar} alt={friend.name} class="w-8 h-8 rounded-full object-cover bg-surface" />
                      <div>
                        <span class="font-semibold text-[var(--on-surface)] block">{friend.name}</span>
                        <span class="text-xs text-[var(--on-surface-variant)]">{friend.desc || "无描述"}</span>
                      </div>
                    </td>
                    <td class="px-4 py-4 text-xs">
                      <a href={friend.url} target="_blank" class="text-primary hover:underline">{friend.url}</a>
                    </td>
                    <td class="px-4 py-4 text-xs">
                      {#if friend.status === 'approved' || friend.accepted === 1}
                        <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">已批准</span>
                      {:else}
                        <span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-medium">待审核</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 text-right space-x-2">
                      <button onclick={() => openEditFriendModal(friend)} class="text-primary font-medium text-xs hover:underline">编辑</button>
                      {#if friend.status !== 'approved' && friend.accepted !== 1}
                        <button onclick={() => approveFriend(friend.id)} class="text-emerald-600 font-medium text-xs hover:underline">批准通过</button>
                      {/if}
                      <button onclick={() => deleteFriend(friend.id)} class="text-error font-medium text-xs hover:underline">删除</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

        {:else if currentTab === "users"}
          <!-- Users Management -->
          <div class="mb-6">
            <h1 class="text-2xl font-bold">注册用户管理</h1>
            <p class="text-xs text-[var(--on-surface-variant)] mt-1">查看所有用户账户、调整积分余额、晋升管理员或封禁/解封</p>
          </div>

          <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/30 rounded-2xl overflow-hidden shadow-sm">
            <table class="w-full text-left text-sm">
              <thead class="bg-[var(--surface-container-low)] border-b border-[var(--outline-variant)]/20 text-xs text-[var(--on-surface-variant)]">
                <tr>
                  <th class="px-6 py-3.5">用户</th>
                  <th class="px-4 py-3.5">角色</th>
                  <th class="px-4 py-3.5">当前积分</th>
                  <th class="px-4 py-3.5">连续签到</th>
                  <th class="px-4 py-3.5">状态</th>
                  <th class="px-6 py-3.5 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[var(--outline-variant)]/10">
                {#each users as user}
                  <tr class="hover:bg-[var(--surface-container-lowest)] transition-colors">
                    <td class="px-6 py-4 flex items-center gap-3">
                      <img src={user.avatar || "/assets/avatars/avatar_01.webp"} alt={user.username} class="w-8 h-8 rounded-full object-cover" />
                      <div>
                        <span class="font-semibold block">{user.nickname || user.username}</span>
                        <span class="text-xs text-[var(--on-surface-variant)]">{user.email || user.username}</span>
                      </div>
                    </td>
                    <td class="px-4 py-4 text-xs">
                      <span class="px-2 py-0.5 rounded-full font-bold {user.role === 'superadmin' ? 'bg-purple-500/15 text-purple-600' : user.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-[var(--surface-container)] text-[var(--on-surface-variant)]'}">
                        {user.role}
                      </span>
                    </td>
                    <td class="px-4 py-4 text-xs font-bold text-purple-600 dark:text-purple-400">
                      {user.points} 点
                    </td>
                    <td class="px-4 py-4 text-xs text-[var(--on-surface-variant)]">
                      {user.checkinStreak ?? user.checkinCount ?? 0} 天
                    </td>
                    <td class="px-4 py-4 text-xs">
                      {#if user.status === 'banned'}
                        <span class="px-2 py-0.5 rounded bg-error/10 text-error font-medium">已封禁</span>
                      {:else}
                        <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">正常</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 text-right space-x-2">
                      {#if authStore.user?.role === 'superadmin' || user.role !== 'superadmin'}
                        <button onclick={() => openAdjustPoints(user)} class="text-primary font-medium text-xs hover:underline">调整积分</button>
                      {/if}
                      {#if authStore.user?.role === 'superadmin' && user.role !== 'superadmin'}
                        <button onclick={() => toggleUserRole(user)} class="text-indigo-600 font-medium text-xs hover:underline">
                          {user.role === 'admin' ? '降为用户' : '设为管理员'}
                        </button>
                      {/if}
                      {#if user.role !== 'superadmin' && (authStore.user?.role === 'superadmin' || user.role !== 'admin')}
                        <button onclick={() => toggleUserStatus(user)} class="text-error font-medium text-xs hover:underline">
                          {user.status === 'banned' ? '解封' : '封禁'}
                        </button>
                      {/if}
                      {#if user.status === 'banned' && user.role !== 'superadmin' && (authStore.user?.role === 'superadmin' || user.role !== 'admin')}
                        <button onclick={() => handleDeleteUser(user)} class="text-rose-600 font-bold text-xs hover:underline">
                          删除用户
                        </button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

        {:else if currentTab === "projects"}
          <!-- Projects Management Panel -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold">🚀 精选项目管理 (Projects)</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">管理前台 /projects/ 的卡片式精选项目，支持全字段编辑、上下排序与实时增删</p>
            </div>
            <div class="flex items-center gap-3">
              <a
                href="/projects/"
                target="_blank"
                class="px-4 py-2 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] text-xs font-semibold transition-all"
              >
                预览前台项目 ↗
              </a>
              <button
                type="button"
                onclick={saveProjectsSettings}
                class="px-6 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 active:scale-98 transition-all flex items-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span>保存项目设置</span>
              </button>
            </div>
          </div>

          <div class="space-y-6">
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>项目列表 ({siteConfigState.projects.length} 个)</span>
                </h2>
                <button
                  type="button"
                  onclick={addProjectItem}
                  class="px-4 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex items-center gap-1"
                >
                  + 新增项目
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">前台采用美观的卡片网格布局（带分类筛选、徽章、技术栈标签与外链）。条目修改后点击保存即可生效。</p>

              {#if siteConfigState.projects && siteConfigState.projects.length > 0}
                <div class="space-y-4">
                  {#each siteConfigState.projects as item, idx}
                    <div
                      draggable="true"
                      ondragstart={() => (draggedProjectIndex = idx)}
                      ondragover={(e) => { e.preventDefault(); }}
                      ondrop={() => handleProjectDrop(idx)}
                      class="p-5 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 space-y-3 transition-shadow {draggedProjectIndex === idx ? 'opacity-50 border-primary' : ''}"
                    >
                      <div class="flex items-center justify-between gap-3 pb-2 border-b border-[var(--outline-variant)]/10">
                        <div class="flex items-center gap-2">
                          <span class="cursor-grab text-[var(--on-surface-variant)] hover:text-primary select-none text-xs font-mono" title="按住拖拽排序">⋮⋮</span>
                          <span class="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">#{idx + 1}</span>
                          <span class="font-bold text-sm text-[var(--on-surface)]">{item.title || "未命名项目"}</span>
                          {#if item.pinned}<span class="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold flex items-center gap-1">📌 置顶</span>{/if}
                          {#if item.featured}<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold flex items-center gap-1">⭐ 精选</span>{/if}
                          {#if item.enable === false}<span class="text-[10px] px-2 py-0.5 rounded-full bg-error/15 text-error font-semibold">已禁用</span>{/if}
                        </div>
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            onclick={() => moveProjectItem(idx, "up")}
                            disabled={idx === 0}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="上移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => moveProjectItem(idx, "down")}
                            disabled={idx === siteConfigState.projects.length - 1}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="下移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => removeProjectItem(idx)}
                            class="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                            title="删除项目"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">项目唯一标识 (Key)</label>
                          <input
                            type="text"
                            bind:value={item.key}
                            placeholder="如 shirine"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">项目名称 (Title)</label>
                          <input
                            type="text"
                            bind:value={item.title}
                            placeholder="项目名"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">所属分类 (Category)</label>
                          <input
                            type="text"
                            list="project-categories-list"
                            bind:value={item.category}
                            placeholder="如 theme / android / web"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                          <datalist id="project-categories-list">
                            {#each distinctProjectCategories as cat}
                              <option value={cat}>{cat}</option>
                            {/each}
                          </datalist>
                          {#if distinctProjectCategories.length > 0}
                            <div class="flex flex-wrap gap-1 mt-1.5">
                              {#each distinctProjectCategories as cat}
                                <button
                                  type="button"
                                  onclick={() => (item.category = cat)}
                                  class="text-[9px] px-2 py-0.5 rounded-md transition-colors {item.category === cat ? 'bg-primary text-on-primary font-bold' : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary'}"
                                >
                                  {cat}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">研发阶段 (Phase)</label>
                          <select
                            bind:value={item.phase}
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          >
                            <option value="building">建设中 (building)</option>
                            <option value="shipped">已发布 (shipped)</option>
                            <option value="planning">规划中 (planning)</option>
                            <option value="archived">已归档 (archived)</option>
                          </select>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">封面图片 URL (Cover)</label>
                          <input
                            type="text"
                            bind:value={item.cover}
                            placeholder="/assets/projects/..."
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">项目官网/访问链接 (Website)</label>
                          <input
                            type="text"
                            bind:value={item.website}
                            placeholder="https://..."
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">开源仓库或链接 (Repository)</label>
                          <input
                            type="text"
                            bind:value={item.repository}
                            placeholder="https://github.com/..."
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">图标 (Iconify)</label>
                          <input
                            type="text"
                            bind:value={item.icon}
                            placeholder="material-symbols:deployed-code-outline-rounded"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div class="sm:col-span-2">
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">技术栈标签 (Technologies，以英文逗号分隔)</label>
                          <input
                            type="text"
                            value={Array.isArray(item.technologies) ? item.technologies.join(", ") : (item.technologies || "")}
                            oninput={(e) => {
                              item.technologies = (e.target as HTMLInputElement).value
                                .split(/[,，]/)
                                .map((s) => s.trim())
                                .filter(Boolean);
                            }}
                            placeholder="TypeScript, Astro, Svelte, Tailwind CSS"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">年份 (Year)</label>
                          <input
                            type="text"
                            bind:value={item.year}
                            placeholder="2026"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                      </div>

                      <div class="grid grid-cols-1 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">项目描述 (Summary)</label>
                          <input
                            type="text"
                            bind:value={item.summary}
                            placeholder="项目一句话介绍与亮点..."
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                      </div>

                      <div class="flex items-center gap-6 pt-1 text-xs">
                        <label class="flex items-center gap-2 cursor-pointer font-medium">
                          <input type="checkbox" bind:checked={item.pinned} class="w-4 h-4 text-primary rounded" />
                          <span>📌 置顶排序 (Pinned)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer font-medium">
                          <input type="checkbox" bind:checked={item.featured} class="w-4 h-4 text-amber-500 rounded" />
                          <span>⭐ 设为精选 (Featured)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={item.enable !== false}
                            onchange={(e) => { item.enable = (e.target as HTMLInputElement).checked; }}
                            class="w-4 h-4 text-primary rounded"
                          />
                          <span>在前台展示此项目</span>
                        </label>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-[var(--on-surface-variant)] italic py-2">暂无项目条目，请点击右上角「+ 新增项目」</p>
              {/if}
            </div>

            <button
              type="button"
              onclick={saveProjectsSettings}
              class="px-8 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>保存项目设置</span>
            </button>
          </div>

        {:else if currentTab === "devices"}
          <!-- Devices Management Panel -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold">💻 我的设备管理 (Devices)</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">管理前台 /devices/ 的工作台数字设备，支持规格参数、状态与实时增删排序</p>
            </div>
            <div class="flex items-center gap-3">
              <a
                href="/devices/"
                target="_blank"
                class="px-4 py-2 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] text-xs font-semibold transition-all"
              >
                预览前台设备 ↗
              </a>
              <button
                type="button"
                onclick={saveDevicesSettings}
                class="px-6 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 active:scale-98 transition-all flex items-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span>保存设备设置</span>
              </button>
            </div>
          </div>

          <div class="space-y-6">
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>设备列表 ({siteConfigState.devices.length} 台)</span>
                </h2>
                <button
                  type="button"
                  onclick={addDeviceItem}
                  class="px-4 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex items-center gap-1"
                >
                  + 新增设备
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">前台采用卡片网格布局，清晰分类呈现桌面工作台、移动设备、音频设备及外设参数。</p>

              {#if siteConfigState.devices && siteConfigState.devices.length > 0}
                <div class="space-y-4">
                  {#each siteConfigState.devices as item, idx}
                    <div
                      draggable="true"
                      ondragstart={() => (draggedDeviceIndex = idx)}
                      ondragover={(e) => { e.preventDefault(); }}
                      ondrop={() => handleDeviceDrop(idx)}
                      class="p-5 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 space-y-3 transition-shadow {draggedDeviceIndex === idx ? 'opacity-50 border-primary' : ''}"
                    >
                      <div class="flex items-center justify-between gap-3 pb-2 border-b border-[var(--outline-variant)]/10">
                        <div class="flex items-center gap-2">
                          <span class="cursor-grab text-[var(--on-surface-variant)] hover:text-primary select-none text-xs font-mono" title="按住拖拽排序">⋮⋮</span>
                          <span class="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">#{idx + 1}</span>
                          <span class="font-bold text-sm text-[var(--on-surface)]">{item.name || "未命名设备"}</span>
                          {#if item.brand}<span class="text-xs text-[var(--on-surface-variant)]">({item.brand})</span>{/if}
                          {#if item.featured}<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold">精选</span>{/if}
                          {#if item.enable === false}<span class="text-[10px] px-2 py-0.5 rounded-full bg-error/15 text-error font-semibold">已禁用</span>{/if}
                        </div>
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            onclick={() => moveDeviceItem(idx, "up")}
                            disabled={idx === 0}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="上移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => moveDeviceItem(idx, "down")}
                            disabled={idx === siteConfigState.devices.length - 1}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="下移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => removeDeviceItem(idx)}
                            class="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                            title="删除设备"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">设备标识 (ID)</label>
                          <input
                            type="text"
                            bind:value={item.id}
                            placeholder="如 macbook-pro"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">设备名称 (Name)</label>
                          <input
                            type="text"
                            bind:value={item.name}
                            placeholder="MacBook Pro 16寸"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">品牌 (Brand)</label>
                          <input
                            type="text"
                            bind:value={item.brand}
                            placeholder="如 Apple / Sony"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">类别 (Category)</label>
                          <input
                            type="text"
                            list="device-categories-list"
                            bind:value={item.category}
                            placeholder="如 desk / mobile / audio / peripheral"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                          <datalist id="device-categories-list">
                            {#each distinctDeviceCategories as cat}
                              <option value={cat}>{cat}</option>
                            {/each}
                          </datalist>
                          {#if distinctDeviceCategories.length > 0}
                            <div class="flex flex-wrap gap-1 mt-1.5">
                              {#each distinctDeviceCategories as cat}
                                <button
                                  type="button"
                                  onclick={() => (item.category = cat)}
                                  class="text-[9px] px-2 py-0.5 rounded-md transition-colors {item.category === cat ? 'bg-primary text-on-primary font-bold' : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary'}"
                                >
                                  {cat}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">使用状态 (Status)</label>
                          <select
                            bind:value={item.status}
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          >
                            <option value="active">主力在用 (active)</option>
                            <option value="backup">备用闲置 (backup)</option>
                            <option value="wishlist">心愿清单 (wishlist)</option>
                            <option value="retired">已退役 (retired)</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">配置参数 (Specs)</label>
                          <input
                            type="text"
                            bind:value={item.specs}
                            placeholder="如 M3 Max / 64GB / 2TB"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">图标 (Iconify)</label>
                          <input
                            type="text"
                            bind:value={item.icon}
                            placeholder="material-symbols:laptop-mac-rounded"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">购置年份 (Year)</label>
                          <input
                            type="text"
                            bind:value={item.year}
                            placeholder="2024"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">设备封面图片 URL (Image, 可选)</label>
                          <input
                            type="text"
                            bind:value={item.image}
                            placeholder="/assets/devices/..."
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">使用感受与体验 (Description)</label>
                          <input
                            type="text"
                            bind:value={item.description}
                            placeholder="日常使用体验与评价..."
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">外链或购买地址 (Link, 可选)</label>
                          <input
                            type="text"
                            bind:value={item.link}
                            placeholder="https://..."
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div class="flex items-center gap-6 pt-1 text-xs">
                        <label class="flex items-center gap-2 cursor-pointer font-medium">
                          <input type="checkbox" bind:checked={item.featured} class="w-4 h-4 text-primary rounded" />
                          <span>设为主力精选</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={item.enable !== false}
                            onchange={(e) => { item.enable = (e.target as HTMLInputElement).checked; }}
                            class="w-4 h-4 text-primary rounded"
                          />
                          <span>在前台展示此设备</span>
                        </label>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-[var(--on-surface-variant)] italic py-2">暂无设备条目，请点击右上角「+ 新增设备」</p>
              {/if}
            </div>

            <button
              type="button"
              onclick={saveDevicesSettings}
              class="px-8 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>保存设备设置</span>
            </button>
          </div>

        {:else if currentTab === "skills"}
          <!-- Skills Management Panel -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold">🛠️ 技能清单管理 (Skills)</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">管理前台 /skills/ 的技术栈清单，支持分类熟练度、图标与实时增删排序</p>
            </div>
            <div class="flex items-center gap-3">
              <a
                href="/skills/"
                target="_blank"
                class="px-4 py-2 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] text-xs font-semibold transition-all"
              >
                预览前台技能 ↗
              </a>
              <button
                type="button"
                onclick={saveSkillsSettings}
                class="px-6 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 active:scale-98 transition-all flex items-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span>保存技能设置</span>
              </button>
            </div>
          </div>

          <div class="space-y-6">
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>技能列表 ({siteConfigState.skills.length} 项)</span>
                </h2>
                <button
                  type="button"
                  onclick={addSkillItem}
                  class="px-4 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex items-center gap-1"
                >
                  + 新增技能
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">前台采用卡片网格布局，带技术分类与熟练度色块标识。</p>

              {#if siteConfigState.skills && siteConfigState.skills.length > 0}
                <div class="space-y-3">
                  {#each siteConfigState.skills as item, idx}
                    <div
                      draggable="true"
                      ondragstart={() => (draggedSkillIndex = idx)}
                      ondragover={(e) => { e.preventDefault(); }}
                      ondrop={() => handleSkillDrop(idx)}
                      class="p-4 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 space-y-2 transition-shadow {draggedSkillIndex === idx ? 'opacity-50 border-primary' : ''}"
                    >
                      <div class="flex items-center justify-between gap-3 pb-2 border-b border-[var(--outline-variant)]/10">
                        <div class="flex items-center gap-2">
                          <span class="cursor-grab text-[var(--on-surface-variant)] hover:text-primary select-none text-xs font-mono" title="按住拖拽排序">⋮⋮</span>
                          <span class="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">#{idx + 1}</span>
                          <span class="font-bold text-sm text-[var(--on-surface)]">{item.name || "未命名技能"}</span>
                          {#if item.level}<span class="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">{item.level}</span>{/if}
                          {#if item.enable === false}<span class="text-[10px] px-2 py-0.5 rounded-full bg-error/15 text-error font-semibold">已禁用</span>{/if}
                        </div>
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            onclick={() => moveSkillItem(idx, "up")}
                            disabled={idx === 0}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="上移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => moveSkillItem(idx, "down")}
                            disabled={idx === siteConfigState.skills.length - 1}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="下移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => removeSkillItem(idx)}
                            class="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                            title="删除技能"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">技能名称 (Name)</label>
                          <input
                            type="text"
                            bind:value={item.name}
                            placeholder="如 TypeScript"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">所属技术类别 (Category)</label>
                          <input
                            type="text"
                            list="skill-categories-list"
                            bind:value={item.category}
                            placeholder="如 frontend / backend / tooling / design"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                          <datalist id="skill-categories-list">
                            {#each distinctSkillCategories as cat}
                              <option value={cat}>{cat}</option>
                            {/each}
                          </datalist>
                          {#if distinctSkillCategories.length > 0}
                            <div class="flex flex-wrap gap-1 mt-1.5">
                              {#each distinctSkillCategories as cat}
                                <button
                                  type="button"
                                  onclick={() => (item.category = cat)}
                                  class="text-[9px] px-2 py-0.5 rounded-md transition-colors {item.category === cat ? 'bg-primary text-on-primary font-bold' : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary'}"
                                >
                                  {cat}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">熟练程度 (Level)</label>
                          <select
                            bind:value={item.level}
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-medium"
                          >
                            <option value="expert">精通 (expert)</option>
                            <option value="advanced">熟练 (advanced)</option>
                            <option value="intermediate">掌握 (intermediate)</option>
                            <option value="beginner">入门 (beginner)</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">图标 (Iconify)</label>
                          <input
                            type="text"
                            bind:value={item.icon}
                            placeholder="simple-icons:typescript"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-mono"
                          />
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
                        <div class="sm:col-span-3">
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">技能描述 (Description)</label>
                          <input
                            type="text"
                            bind:value={item.description}
                            placeholder="简短描述应用场景与经验..."
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                        <div class="flex items-end pb-1.5">
                          <label class="flex items-center gap-2 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={item.enable !== false}
                              onchange={(e) => { item.enable = (e.target as HTMLInputElement).checked; }}
                              class="w-4 h-4 text-primary rounded"
                            />
                            <span>在前台展示此项</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-[var(--on-surface-variant)] italic py-2">暂无技能条目，请点击右上角「+ 新增技能」</p>
              {/if}
            </div>

            <button
              type="button"
              onclick={saveSkillsSettings}
              class="px-8 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>保存技能设置</span>
            </button>
          </div>

        {:else if currentTab === "compass"}
          <!-- Compass Settings Panel -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold">🧭 站点罗盘导航 (Compass)</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">管理前台 /compass/ 站点罗盘导航的分组与网址磁贴，支持实时增删改查</p>
            </div>
            <div class="flex items-center gap-3">
              <a
                href="/compass/"
                target="_blank"
                class="px-4 py-2 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] text-xs font-semibold transition-all"
              >
                预览前台罗盘 ↗
              </a>
              <button
                type="button"
                onclick={saveCompassSettings}
                class="px-6 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 active:scale-98 transition-all flex items-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span>保存罗盘设置</span>
              </button>
            </div>
          </div>

          <div class="space-y-6 max-w-4xl">
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-lg font-bold">罗盘分组与站点磁贴</h2>
                <button
                  type="button"
                  onclick={addCompassShelf}
                  class="px-3.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex items-center gap-1"
                >
                  + 新增导航分组
                </button>
              </div>

              {#if siteConfigState.compass && siteConfigState.compass.length > 0}
                <div class="space-y-4">
                  {#each siteConfigState.compass as shelf, shelfIdx}
                    <div class="p-4 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 space-y-3">
                      <div class="flex items-center justify-between gap-3 pb-2 border-b border-[var(--outline-variant)]/10">
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                          <div>
                            <label class="text-[10px] text-[var(--on-surface-variant)] block">分组名称</label>
                            <input
                              type="text"
                              bind:value={shelf.name}
                              placeholder="如 Development"
                              class="w-full px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs font-bold outline-none"
                            />
                          </div>
                          <div>
                            <label class="text-[10px] text-[var(--on-surface-variant)] block">分组唯一 Key</label>
                            <input
                              type="text"
                              bind:value={shelf.key}
                              placeholder="如 dev"
                              class="w-full px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs font-mono outline-none"
                            />
                          </div>
                          <div>
                            <label class="text-[10px] text-[var(--on-surface-variant)] block">分组描述 (Blurb)</label>
                            <input
                              type="text"
                              bind:value={shelf.blurb}
                              placeholder="分组副说明"
                              class="w-full px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs outline-none"
                            />
                          </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onclick={() => moveCompassShelf(shelfIdx, "up")}
                            disabled={shelfIdx === 0}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="上移分组"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => moveCompassShelf(shelfIdx, "down")}
                            disabled={shelfIdx === siteConfigState.compass.length - 1}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="下移分组"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => addCompassEntry(shelfIdx)}
                            class="px-2.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium hover:brightness-105 transition-all"
                            title="添加一条站点"
                          >
                            + 添站
                          </button>
                          <button
                            type="button"
                            onclick={() => removeCompassShelf(shelfIdx)}
                            class="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                            title="删除整个分组"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>

                      <!-- Entries -->
                      {#if shelf.entries && shelf.entries.length > 0}
                        <div class="space-y-2">
                          {#each shelf.entries as entry, entryIdx}
                            <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--outline-variant)]/20 text-xs">
                              <div class="w-full sm:w-1/4">
                                <label class="text-[9px] text-[var(--on-surface-variant)] block">网站名称</label>
                                <input
                                  type="text"
                                  bind:value={entry.label}
                                  placeholder="GitHub"
                                  class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/20 bg-[var(--surface-container-low)] outline-none"
                                />
                              </div>
                              <div class="w-full sm:w-1/3">
                                <label class="text-[9px] text-[var(--on-surface-variant)] block">网址 URL</label>
                                <input
                                  type="text"
                                  bind:value={entry.href}
                                  placeholder="https://..."
                                  class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/20 bg-[var(--surface-container-low)] outline-none font-mono"
                                />
                              </div>
                              <div class="w-full sm:w-1/4">
                                <label class="text-[9px] text-[var(--on-surface-variant)] block">简短说明</label>
                                <input
                                  type="text"
                                  bind:value={entry.note}
                                  placeholder="代码托管与开源协作"
                                  class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/20 bg-[var(--surface-container-low)] outline-none"
                                />
                              </div>
                              <div class="w-full sm:w-1/6">
                                <label class="text-[9px] text-[var(--on-surface-variant)] block">图标 (Iconify)</label>
                                <input
                                  type="text"
                                  bind:value={entry.icon}
                                  placeholder="fa6-brands:github"
                                  class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/20 bg-[var(--surface-container-low)] outline-none font-mono"
                                />
                              </div>
                              <div class="flex items-center gap-0.5 mt-3 shrink-0">
                                <button
                                  type="button"
                                  onclick={() => moveCompassEntry(shelfIdx, entryIdx, "up")}
                                  disabled={entryIdx === 0}
                                  class="p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-md transition-colors disabled:opacity-30"
                                  title="上移站点"
                                >
                                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                                </button>
                                <button
                                  type="button"
                                  onclick={() => moveCompassEntry(shelfIdx, entryIdx, "down")}
                                  disabled={entryIdx === shelf.entries.length - 1}
                                  class="p-1 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-md transition-colors disabled:opacity-30"
                                  title="下移站点"
                                >
                                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                                </button>
                                <button
                                  type="button"
                                  onclick={() => removeCompassEntry(shelfIdx, entryIdx)}
                                  class="p-1 text-error hover:bg-error/10 rounded-md transition-colors"
                                  title="删除此站点"
                                >
                                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                              </div>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="text-xs text-[var(--on-surface-variant)] italic">该分组下暂无站点磁贴，请点击右上角「+ 添站」添加</p>
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-[var(--on-surface-variant)] italic py-2">暂无罗盘分组，请点击右上角「+ 新增导航分组」</p>
              {/if}
            </div>

            <button
              type="button"
              onclick={saveCompassSettings}
              class="px-8 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>保存罗盘设置</span>
            </button>
          </div>

        {:else if currentTab === "anime"}
          <!-- Anime Settings Panel -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold">📺 番剧追番清单 (Anime)</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">管理前台 /anime/ 番剧清单的追番状态、评分与播放进度，支持实时增删改查</p>
            </div>
            <div class="flex items-center gap-3">
              <a
                href="/anime/"
                target="_blank"
                class="px-4 py-2 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] text-xs font-semibold transition-all"
              >
                预览前台番剧 ↗
              </a>
              <button
                type="button"
                onclick={saveAnimeSettings}
                class="px-6 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 active:scale-98 transition-all flex items-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span>保存追番列表</span>
              </button>
            </div>
          </div>

          <div class="space-y-6 max-w-4xl">
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-lg font-bold">追番列表</h2>
                <button
                  type="button"
                  onclick={addAnimeItem}
                  class="px-3.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex items-center gap-1"
                >
                  + 新增追番条目
                </button>
              </div>

              {#if siteConfigState.anime && siteConfigState.anime.length > 0}
                <div class="space-y-3">
                  {#each siteConfigState.anime as item, idx}
                    <div class="p-4 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 space-y-3">
                      <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                        <div class="flex items-center gap-3 flex-1">
                          <img
                            src={item.cover || "/assets/images/demo-avatar.webp"}
                            alt={item.title}
                            class="w-12 h-16 rounded-lg object-cover bg-[var(--surface-container)] shrink-0"
                          />
                          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
                            <div>
                              <label class="text-[10px] text-[var(--on-surface-variant)] block">番剧名称</label>
                              <input
                                type="text"
                                bind:value={item.title}
                                placeholder="番剧中文/原名"
                                class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs font-bold outline-none"
                              />
                            </div>
                            <div>
                              <label class="text-[10px] text-[var(--on-surface-variant)] block">追番状态</label>
                              <select
                                bind:value={item.status}
                                class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs outline-none"
                              >
                                <option value="watching">在看 (watching)</option>
                                <option value="completed">看过 (completed)</option>
                                <option value="planned">想看 (planned)</option>
                                <option value="onHold">搁置 (onHold)</option>
                                <option value="dropped">抛弃 (dropped)</option>
                              </select>
                            </div>
                            <div>
                              <label class="text-[10px] text-[var(--on-surface-variant)] block">个人评分 (0-10)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                bind:value={item.rating}
                                class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs font-bold text-amber-500 outline-none"
                              />
                            </div>
                            <div>
                              <label class="text-[10px] text-[var(--on-surface-variant)] block">进度 (已看 / 总集数)</label>
                              <div class="flex items-center gap-1">
                                <input
                                  type="number"
                                  bind:value={item.progress.watched}
                                  class="w-1/2 px-2 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs outline-none text-center"
                                />
                                <span class="text-xs text-[var(--on-surface-variant)]">/</span>
                                <input
                                  type="number"
                                  bind:value={item.progress.total}
                                  class="w-1/2 px-2 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs outline-none text-center"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onclick={() => moveAnimeItem(idx, "up")}
                            disabled={idx === 0}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="上移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => moveAnimeItem(idx, "down")}
                            disabled={idx === siteConfigState.anime.length - 1}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="下移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => removeAnimeItem(idx)}
                            class="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                            title="删除此番剧条目"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-[var(--outline-variant)]/10 text-xs">
                        <div>
                          <label class="text-[9px] text-[var(--on-surface-variant)] block">封面图片 URL</label>
                          <input
                            type="text"
                            bind:value={item.cover}
                            placeholder="/assets/anime/..."
                            class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/20 bg-[var(--surface)] outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[9px] text-[var(--on-surface-variant)] block">外链播放/Bangumi 地址</label>
                          <input
                            type="text"
                            bind:value={item.link}
                            placeholder="https://..."
                            class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/20 bg-[var(--surface)] outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label class="text-[9px] text-[var(--on-surface-variant)] block">一句话短评/感想</label>
                          <input
                            type="text"
                            bind:value={item.description}
                            placeholder="番剧简评..."
                            class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/20 bg-[var(--surface)] outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-[var(--on-surface-variant)] italic py-2">暂无追番条目，请点击右上角「+ 新增追番条目」</p>
              {/if}
            </div>

            <button
              type="button"
              onclick={saveAnimeSettings}
              class="px-8 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>保存追番列表</span>
            </button>
          </div>

        {:else if currentTab === "settings"}
          <!-- Settings Panel -->
          <div class="mb-6">
            <h1 class="text-2xl font-bold">系统与全站配置</h1>
            <p class="text-xs text-[var(--on-surface-variant)] mt-1">配置每日签到积分规则、Cloudflare Turnstile 人机验证、看板娘及全站核心设定</p>
          </div>

          <div class="space-y-6 max-w-3xl">
            <!-- Check-in Points Policy -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <h2 class="text-lg font-bold mb-1 flex items-center gap-2">
                <span>🎁 每日签到与积分引擎规则</span>
              </h2>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">
                配置普通用户每日签到获取积分的计算模式。支持固定积分或在指定闭区间随机获取积分。
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs font-semibold block mb-1.5">签到积分发放模式</label>
                  <select
                    bind:value={systemConfigState.checkinMode}
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                  >
                    <option value="fixed">固定积分模式 (Fixed)</option>
                    <option value="random">随机区间模式 (Random Range [min, max])</option>
                  </select>
                </div>

                {#if systemConfigState.checkinMode === 'fixed'}
                  <div>
                    <label class="text-xs font-semibold block mb-1.5">每次签到发放固定积分</label>
                    <input
                      type="number"
                      bind:value={systemConfigState.checkinFixedPoints}
                      min="1"
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                    />
                  </div>
                {:else}
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="text-xs font-semibold block mb-1.5">最小积分 (Min)</label>
                      <input
                        type="number"
                        bind:value={systemConfigState.checkinRandomMin}
                        min="1"
                        class="w-full px-3 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label class="text-xs font-semibold block mb-1.5">最大积分 (Max)</label>
                      <input
                        type="number"
                        bind:value={systemConfigState.checkinRandomMax}
                        min="1"
                        class="w-full px-3 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                      />
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Cloudflare Turnstile -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-lg font-bold flex items-center gap-2">
                  <span>🛡️ Cloudflare Turnstile 人机验证</span>
                </h2>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" bind:checked={systemConfigState.turnstileEnable} class="sr-only peer" />
                  <div class="w-11 h-6 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">
                为注册与登录开启 Cloudflare Turnstile 无感防护，有效阻断恶意脚本爆破。
              </p>

              {#if systemConfigState.turnstileEnable}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label class="text-xs font-semibold block mb-1.5">Site Key (前端密钥)</label>
                    <input
                      type="text"
                      bind:value={systemConfigState.turnstileSiteKey}
                      placeholder="0x4AAAAAA..."
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label class="text-xs font-semibold block mb-1.5">Secret Key (后端服务端私钥)</label>
                    <input
                      type="password"
                      bind:value={systemConfigState.turnstileSecretKey}
                      placeholder="0x4AAAAAA..."
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                    />
                  </div>
                </div>
              {/if}
            </div>

            <!-- Live2D Settings -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <h2 class="text-lg font-bold mb-1 flex items-center gap-2">
                <span>🐱 看板娘 (Live2D Widget) 配置</span>
              </h2>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">
                独立控制看板娘显示、互动多语言支持与多模型切换管理。
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <label class="flex items-center gap-3 p-3 rounded-2xl border border-[var(--outline-variant)]/20 cursor-pointer">
                  <input type="checkbox" bind:checked={systemConfigState.live2dGuestEnable} class="w-4 h-4 text-primary rounded" />
                  <span class="text-sm font-medium">前台博客页面展示看板娘</span>
                </label>
                <label class="flex items-center gap-3 p-3 rounded-2xl border border-[var(--outline-variant)]/20 cursor-pointer">
                  <input type="checkbox" bind:checked={systemConfigState.live2dAdminEnable} class="w-4 h-4 text-primary rounded" />
                  <span class="text-sm font-medium">后台管理页面展示看板娘</span>
                </label>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="text-xs font-semibold block mb-1.5">看板娘互动台词语言 (Interaction Language)</label>
                  <select
                    bind:value={systemConfigState.live2dLang}
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                  >
                    <option value="zh_CN">简体中文 (zh_CN)</option>
                    <option value="zh_TW">繁體中文 (zh_TW)</option>
                    <option value="en">English (en)</option>
                    <option value="ja">日本語 (ja)</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-semibold block mb-1.5">当前启用模型路径 (Active Model JSON)</label>
                  <input
                    type="text"
                    bind:value={systemConfigState.live2dModel}
                    placeholder="/pio/models/NOIR/noir.model3.json"
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
                  />
                </div>
              </div>

              <!-- Multi-Model Manager -->
              <div class="p-4 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-primary">Live2D 多模型库管理</span>
                  <div class="flex items-center gap-2">
                    <label class="cursor-pointer px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center gap-1">
                      <span>📤 上传模型文件</span>
                      <input type="file" class="hidden" onchange={(e) => handleGenericUpload(e, (url) => {
                        systemConfigState.live2dModels = [...systemConfigState.live2dModels, { name: "上传模型", url }];
                      })} />
                    </label>
                    <button
                      type="button"
                      onclick={addLive2dModelEntry}
                      class="px-2.5 py-1 rounded-lg bg-[var(--surface-container-high)] text-xs font-semibold hover:bg-[var(--surface-container-highest)] transition-colors"
                    >
                      + 新增模型地址
                    </button>
                  </div>
                </div>

                <div class="space-y-2">
                  {#each systemConfigState.live2dModels as model, idx}
                    <div class="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface)] border border-[var(--outline-variant)]/20 text-xs">
                      <label class="flex items-center gap-1.5 cursor-pointer shrink-0" title="设为当前生效模型">
                        <input
                          type="radio"
                          name="activeLive2dModel"
                          checked={systemConfigState.live2dModel === model.url}
                          onchange={() => { systemConfigState.live2dModel = model.url; }}
                          class="text-primary"
                        />
                        <span class="text-[10px] font-bold {systemConfigState.live2dModel === model.url ? 'text-primary' : 'text-[var(--on-surface-variant)]'}">
                          {systemConfigState.live2dModel === model.url ? '使用中' : '选用'}
                        </span>
                      </label>
                      <input
                        type="text"
                        bind:value={model.name}
                        placeholder="模型名称"
                        class="w-28 px-2 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-xs outline-none"
                      />
                      <input
                        type="text"
                        bind:value={model.url}
                        placeholder="模型 JSON 地址 (如 /pio/models/... 或 https://...)"
                        class="flex-1 px-2 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-xs font-mono outline-none"
                      />
                      <button
                        type="button"
                        onclick={() => removeLive2dModelEntry(idx)}
                        class="p-1 text-error hover:bg-error/10 rounded-md transition-colors shrink-0"
                        title="删除此模型"
                      >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  {/each}
                </div>

                <!-- Live2D Quotes / Custom Dialogues -->
                <div class="mt-4 pt-3 border-t border-[var(--outline-variant)]/20 space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-primary">Live2D 看板娘互动台词设定 (每行一句)</label>
                    <span class="text-[11px] text-[var(--on-surface-variant)]">点击看板娘或停留时随机提示</span>
                  </div>
                  <textarea
                    bind:value={systemConfigState.live2dQuotes}
                    rows="5"
                    placeholder="欢迎来到 Shirine！&#10;今天也是美好的一天～&#10;看文章累了就伸个懒腰吧！"
                    class="w-full p-3 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs font-mono outline-none focus:border-primary leading-relaxed"
                  ></textarea>
                  <p class="text-[11px] text-[var(--on-surface-variant)]">
                    支持多行文本，访客在前台与看板娘交互时将随机朗读或弹出气泡台词。保存设置后即刻生效。
                  </p>
                </div>
              </div>
            </div>

            <!-- AI Writing Assistant Settings -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-1">
                <h2 class="text-lg font-bold flex items-center gap-2">
                  <span>🤖 AI 写作助手模型与接口配置</span>
                </h2>
                <button
                  type="button"
                  onclick={fetchAiModels}
                  disabled={aiFetchingModels}
                  class="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {#if aiFetchingModels}
                    <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                    <span>正在获取模型...</span>
                  {:else}
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    <span>获取可用模型列表</span>
                  {/if}
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">
                支持 OpenAI 或任何兼容 OpenAI 协议的自建/第三方大语言模型接口（如 DeepSeek, Moonshot, Ollama, SiliconFlow 等）。
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="text-xs font-semibold block mb-1.5">API 端点 (Base URL)</label>
                  <input
                    type="text"
                    bind:value={systemConfigState.aiApiUrl}
                    placeholder="https://api.openai.com/v1"
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
                  />
                </div>
                <div>
                  <label class="text-xs font-semibold block mb-1.5">API Key (密钥)</label>
                  <input
                    type="password"
                    bind:value={systemConfigState.aiApiKey}
                    placeholder="sk-..."
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label class="text-xs font-semibold block mb-1.5">模型标识 (Model ID)</label>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    bind:value={systemConfigState.aiModel}
                    placeholder="例如: gpt-4o-mini, deepseek-chat, claude-3-haiku"
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
                  />
                </div>
              </div>

              {#if aiAvailableModels.length > 0}
                <div class="mt-3">
                  <label class="text-[11px] text-[var(--on-surface-variant)] block mb-1">接口返回的可用模型（点击直接选择）：</label>
                  <div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20">
                    {#each aiAvailableModels as mod}
                      <button
                        type="button"
                        onclick={() => (systemConfigState.aiModel = mod)}
                        class="text-[10px] px-2.5 py-1 rounded-lg transition-colors font-mono {systemConfigState.aiModel === mod ? 'bg-primary text-on-primary font-bold' : 'bg-[var(--surface)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary'}"
                      >
                        {mod}
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            <!-- Site Core Settings -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <h2 class="text-lg font-bold mb-1 flex items-center gap-2">
                <span>🎨 博客基础设定</span>
              </h2>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">博客品牌、标题及 Material 3 调色盘主色相</p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs font-semibold block mb-1.5">博客标题 (Title)</label>
                  <input
                    type="text"
                    bind:value={siteConfigState.title}
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                  />
                </div>
                <div>
                  <label class="text-xs font-semibold block mb-1.5">副标题 (Subtitle)</label>
                  <input
                    type="text"
                    bind:value={siteConfigState.subtitle}
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                  />
                </div>
                <div>
                  <label class="text-xs font-semibold block mb-1.5">主色相色调 (Hue 0-360)</label>
                  <div class="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="360"
                      bind:value={siteConfigState.themeHue}
                      class="flex-1 accent-primary"
                    />
                    <span class="text-xs font-bold w-8">{siteConfigState.themeHue}°</span>
                  </div>
                </div>
                <div>
                  <label class="text-xs font-semibold block mb-1.5">顶栏对齐布局</label>
                  <select
                    bind:value={siteConfigState.topAppBarAlign}
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                  >
                    <option value="center">居中对齐 (Center)</option>
                    <option value="left">靠左对齐 (Left)</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-semibold block mb-1.5">{at.defaultLang}</label>
                  <select
                    bind:value={siteConfigState.lang}
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                  >
                    {#each SUPPORTED_LANGUAGES as l}
                      <option value={l.code}>{l.name} ({l.code})</option>
                    {/each}
                  </select>
                </div>
              </div>
            </div>

            <!-- Banner & Wallpaper Settings -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <h2 class="text-lg font-bold mb-1 flex items-center gap-2">
                <span>🖼️ 横幅背景与壁纸主题</span>
              </h2>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">自定义首页顶部横幅、手机端壁纸及打字机打字特效字幕</p>

              <div class="space-y-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <label class="text-xs font-semibold block">桌面端横幅图片 URL（支持多图，每行一张）</label>
                      <label class="cursor-pointer text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium flex items-center gap-1">
                        <span>📤 上传到 R2</span>
                        <input type="file" accept="image/*" class="hidden" onchange={(e) => handleGenericUpload(e, (url) => {
                          siteConfigState.bannerDesktop = siteConfigState.bannerDesktop ? `${siteConfigState.bannerDesktop}\n${url}` : url;
                        })} />
                      </label>
                    </div>
                    <textarea
                      bind:value={siteConfigState.bannerDesktop}
                      rows="3"
                      placeholder="/assets/images/banner/desktop/1.webp 或 https://...&#10;支持多图，每行一张"
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
                    ></textarea>
                  </div>
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <label class="text-xs font-semibold block">移动端横幅图片 URL（支持多图，每行一张）</label>
                      <label class="cursor-pointer text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium flex items-center gap-1">
                        <span>📤 上传到 R2</span>
                        <input type="file" accept="image/*" class="hidden" onchange={(e) => handleGenericUpload(e, (url) => {
                          siteConfigState.bannerMobile = siteConfigState.bannerMobile ? `${siteConfigState.bannerMobile}\n${url}` : url;
                        })} />
                      </label>
                    </div>
                    <textarea
                      bind:value={siteConfigState.bannerMobile}
                      rows="3"
                      placeholder="/assets/images/banner/mobile/1.webp 或 https://...&#10;支持多图，每行一张"
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
                    ></textarea>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label class="text-xs font-semibold block mb-1.5">全站壁纸呈现模式</label>
                    <select
                      bind:value={siteConfigState.wallpaperMode}
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                    >
                      <option value="banner">仅横幅壁纸 (Banner)</option>
                      <option value="full">全屏壁纸铺展 (Full)</option>
                      <option value="none">纯色极简无壁纸 (None)</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-xs font-semibold block mb-1.5">背景纹理叠加 (Texture)</label>
                    <select
                      bind:value={siteConfigState.texturePreset}
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                    >
                      <option value="starlight">星光细砂 (Starlight)</option>
                      <option value="dot">波点阵列 (Dot)</option>
                      <option value="grid">极细网格 (Grid)</option>
                      <option value="none">无纹理 (None)</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-xs font-semibold block mb-1.5">纹理不透明度 ({Math.round(siteConfigState.textureOpacity * 100)}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.01"
                      bind:value={siteConfigState.textureOpacity}
                      class="w-full accent-primary mt-2"
                    />
                  </div>
                </div>

                <div>
                  <label class="text-xs font-semibold block mb-1.5">首页打字机轮播台词（每行一条）</label>
                  <textarea
                    bind:value={siteConfigState.bannerSubtitles}
                    rows="4"
                    placeholder="输入打字机轮播台词，每行一条..."
                    class="w-full p-3.5 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Profile & Bio Settings -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <h2 class="text-lg font-bold mb-1 flex items-center gap-2">
                <span>👤 站长名片与个人资料</span>
              </h2>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">修改侧边栏个人名片的作者名字、头像地址以及简介描述</p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs font-semibold block mb-1.5">站长昵称 / 姓名</label>
                  <input
                    type="text"
                    bind:value={siteConfigState.authorName}
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                  />
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="text-xs font-semibold block">头像图片 URL</label>
                    <label class="cursor-pointer text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium flex items-center gap-1">
                      <span>📤 上传新头像</span>
                      <input type="file" accept="image/*" class="hidden" onchange={(e) => handleGenericUpload(e, (url) => { siteConfigState.avatar = url; })} />
                    </label>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      type="text"
                      bind:value={siteConfigState.avatar}
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                    />
                    {#if siteConfigState.avatar}
                      <button
                        type="button"
                        onclick={() => copyToClipboard(siteConfigState.avatar)}
                        class="p-2.5 rounded-xl border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)] shrink-0"
                        title="复制头像链接"
                      >
                        📋
                      </button>
                    {/if}
                  </div>
                </div>
              </div>

              <div class="mt-4">
                <label class="text-xs font-semibold block mb-1.5">个性签名 / 自我介绍 Bio</label>
                <textarea
                  bind:value={siteConfigState.bio}
                  rows="2"
                  class="w-full p-3 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                ></textarea>
              </div>

              <!-- Social Links Editor -->
              <div class="mt-6 pt-5 border-t border-[var(--outline-variant)]/20">
                <div class="flex items-center justify-between mb-2">
                  <div>
                    <h3 class="text-xs font-bold text-primary uppercase tracking-wider">社交平台与外链跳转 (Social Links)</h3>
                    <p class="text-[11px] text-[var(--on-surface-variant)]">配置侧边栏名片底部的社交图标，支持 GitHub、Steam、Facebook、Twitter 等点击直接跳转</p>
                  </div>
                  <button
                    type="button"
                    onclick={() => addProfileLink()}
                    class="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex items-center gap-1"
                  >
                    + 添加新链接
                  </button>
                </div>

                <!-- Quick Presets -->
                <div class="flex flex-wrap items-center gap-1.5 mb-3">
                  <span class="text-[11px] text-[var(--on-surface-variant)]">快速添加：</span>
                  <button
                    type="button"
                    onclick={() => addProfileLink({ name: "GitHub", icon: "fa6-brands:github", url: "https://github.com/yiran168/Shirine" })}
                    class="px-2.5 py-1 rounded-md bg-[var(--surface-container-high)] text-xs hover:bg-[var(--surface-container-highest)] transition-colors"
                  >
                    GitHub
                  </button>
                  <button
                    type="button"
                    onclick={() => addProfileLink({ name: "Steam", icon: "fa6-brands:steam", url: "https://store.steampowered.com" })}
                    class="px-2.5 py-1 rounded-md bg-[var(--surface-container-high)] text-xs hover:bg-[var(--surface-container-highest)] transition-colors"
                  >
                    Steam
                  </button>
                  <button
                    type="button"
                    onclick={() => addProfileLink({ name: "Facebook", icon: "fa6-brands:facebook", url: "https://www.facebook.com" })}
                    class="px-2.5 py-1 rounded-md bg-[var(--surface-container-high)] text-xs hover:bg-[var(--surface-container-highest)] transition-colors"
                  >
                    Facebook
                  </button>
                  <button
                    type="button"
                    onclick={() => addProfileLink({ name: "Twitter", icon: "fa6-brands:twitter", url: "https://twitter.com" })}
                    class="px-2.5 py-1 rounded-md bg-[var(--surface-container-high)] text-xs hover:bg-[var(--surface-container-highest)] transition-colors"
                  >
                    Twitter/X
                  </button>
                  <button
                    type="button"
                    onclick={() => addProfileLink({ name: "Bilibili", icon: "fa6-brands:bilibili", url: "https://space.bilibili.com" })}
                    class="px-2.5 py-1 rounded-md bg-[var(--surface-container-high)] text-xs hover:bg-[var(--surface-container-highest)] transition-colors"
                  >
                    Bilibili
                  </button>
                  <button
                    type="button"
                    onclick={() => addProfileLink({ name: "Telegram", icon: "fa6-brands:telegram", url: "https://t.me" })}
                    class="px-2.5 py-1 rounded-md bg-[var(--surface-container-high)] text-xs hover:bg-[var(--surface-container-highest)] transition-colors"
                  >
                    Telegram
                  </button>
                </div>

                {#if siteConfigState.profileLinks && siteConfigState.profileLinks.length > 0}
                  <div class="space-y-2">
                    {#each siteConfigState.profileLinks as link, idx}
                      <div class="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 text-xs">
                        <div class="w-1/4">
                          <label class="text-[9px] text-[var(--on-surface-variant)] block mb-0.5">平台名称</label>
                          <input
                            type="text"
                            bind:value={link.name}
                            placeholder="如 GitHub"
                            class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs outline-none"
                          />
                        </div>
                        <div class="w-1/4">
                          <label class="text-[9px] text-[var(--on-surface-variant)] block mb-0.5">图标名称 (Iconify)</label>
                          <input
                            type="text"
                            bind:value={link.icon}
                            placeholder="fa6-brands:github"
                            class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs outline-none font-mono"
                          />
                        </div>
                        <div class="flex-1">
                          <label class="text-[9px] text-[var(--on-surface-variant)] block mb-0.5">跳转 URL</label>
                          <input
                            type="text"
                            bind:value={link.url}
                            placeholder="https://..."
                            class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs outline-none font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onclick={() => removeProfileLink(idx)}
                          class="mt-3 p-1.5 text-error hover:bg-error/10 rounded-md transition-colors"
                          title="删除此社交链接"
                        >
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="text-xs text-[var(--on-surface-variant)] italic py-1">暂未配置社交链接，点击上方预设或按钮添加</p>
                {/if}
              </div>
            </div>

            <!-- Announcement Settings -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-lg font-bold flex items-center gap-2">
                  <span>📢 侧边栏公告栏 (Announcement)</span>
                </h2>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" bind:checked={siteConfigState.announcementEnable} class="sr-only peer" />
                  <div class="w-11 h-6 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">在前台侧边栏顶部展示全站置顶重要通知或标语</p>

              {#if siteConfigState.announcementEnable}
                <div class="space-y-4">
                  <div>
                    <label class="text-xs font-semibold block mb-1.5">公告栏自定义标题 (可留空)</label>
                    <input
                      type="text"
                      bind:value={siteConfigState.announcementTitle}
                      placeholder="特别公告"
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label class="text-xs font-semibold block mb-1.5">公告正文内容</label>
                    <textarea
                      bind:value={siteConfigState.announcementContent}
                      rows="3"
                      placeholder="在此输入公告通知内容..."
                      class="w-full p-3 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                    ></textarea>
                  </div>
                  <!-- Announcement Jump Links List -->
                  <div class="space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span class="text-xs font-semibold block">公告跳转按钮列表</span>
                        <span class="text-[10px] text-[var(--on-surface-variant)]">支持同时配置多个跳转链接（如 GitHub、Steam、Facebook 等）</span>
                      </div>
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-[10px] text-[var(--on-surface-variant)]">快捷添加：</span>
                        <button
                          type="button"
                          onclick={() => addAnnouncementLinkPreset("github")}
                          class="px-2 py-0.5 rounded bg-[var(--surface-container-high)] text-[11px] hover:bg-[var(--surface-container-highest)] transition-colors"
                        >
                          + GitHub
                        </button>
                        <button
                          type="button"
                          onclick={() => addAnnouncementLinkPreset("steam")}
                          class="px-2 py-0.5 rounded bg-[var(--surface-container-high)] text-[11px] hover:bg-[var(--surface-container-highest)] transition-colors"
                        >
                          + Steam
                        </button>
                        <button
                          type="button"
                          onclick={() => addAnnouncementLinkPreset("facebook")}
                          class="px-2 py-0.5 rounded bg-[var(--surface-container-high)] text-[11px] hover:bg-[var(--surface-container-highest)] transition-colors"
                        >
                          + Facebook
                        </button>
                        <button
                          type="button"
                          onclick={addCustomAnnouncementLink}
                          class="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] hover:bg-primary/20 transition-colors"
                        >
                          + 自定义
                        </button>
                      </div>
                    </div>

                    {#if siteConfigState.announcementLinks && siteConfigState.announcementLinks.length > 0}
                      <div class="space-y-2">
                        {#each siteConfigState.announcementLinks as link, idx}
                          <div class="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 text-xs">
                            <div class="w-1/3">
                              <label class="text-[9px] text-[var(--on-surface-variant)] block mb-0.5">按钮名称</label>
                              <input
                                type="text"
                                bind:value={link.text}
                                placeholder="如 GitHub"
                                class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs font-semibold outline-none"
                              />
                            </div>
                            <div class="flex-1">
                              <label class="text-[9px] text-[var(--on-surface-variant)] block mb-0.5">跳转 URL</label>
                              <input
                                type="text"
                                bind:value={link.url}
                                placeholder="https://..."
                                class="w-full px-2.5 py-1 rounded-md border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs outline-none font-mono"
                              />
                            </div>
                            <button
                              type="button"
                              onclick={() => removeAnnouncementLink(idx)}
                              class="mt-3 p-1.5 text-error hover:bg-error/10 rounded-md transition-colors"
                              title="删除此跳转链接"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <p class="text-xs text-[var(--on-surface-variant)] italic py-1">暂无跳转链接，点击上方快捷按钮添加</p>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>

            <!-- Music Player Settings -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-lg font-bold flex items-center gap-2">
                  <span>🎵 全局背景音乐播放器</span>
                </h2>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" bind:checked={siteConfigState.musicEnable} class="sr-only peer" />
                  <div class="w-11 h-6 bg-surface-container peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">支持 Meting API 在线网易云/QQ音乐歌单，以及自建音频曲目播放列表</p>

              {#if siteConfigState.musicEnable}
                <div class="space-y-4">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="text-xs font-semibold block mb-1.5">播放源模式</label>
                      <select
                        bind:value={siteConfigState.musicProvider}
                        class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                      >
                        <option value="mixed">混合模式 (Meting歌单 + 自定义曲目)</option>
                        <option value="meting">仅 Meting 在线歌单</option>
                        <option value="local">仅自定义本地曲目</option>
                      </select>
                    </div>
                    <div>
                      <label class="text-xs font-semibold block mb-1.5">默认播放音量 ({Math.round(siteConfigState.musicVolume * 100)}%)</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        bind:value={siteConfigState.musicVolume}
                        class="w-full accent-primary mt-2"
                      />
                    </div>
                  </div>

                  {#if siteConfigState.musicProvider === 'meting' || siteConfigState.musicProvider === 'mixed'}
                    <div class="p-4 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 space-y-3">
                      <h3 class="text-xs font-bold text-primary">Meting 歌单配置</h3>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label class="text-xs font-semibold block mb-1">音乐平台 Server</label>
                          <select
                            bind:value={siteConfigState.musicMetingServer}
                            class="w-full px-3 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-sm outline-none"
                          >
                            <option value="netease">网易云音乐 (netease)</option>
                            <option value="tencent">QQ 音乐 (tencent)</option>
                            <option value="kugou">酷狗音乐 (kugou)</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-xs font-semibold block mb-1">歌单 ID (Playlist ID)</label>
                          <input
                            type="text"
                            bind:value={siteConfigState.musicMetingId}
                            placeholder="例如: 8152976493"
                            class="w-full px-3 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-sm outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  {/if}

                  {#if siteConfigState.musicProvider === 'local' || siteConfigState.musicProvider === 'mixed'}
                    <div class="space-y-3">
                      <div class="flex items-center justify-between">
                        <label class="text-xs font-bold text-[var(--on-surface)]">自定义音乐列表 ({siteConfigState.musicTracks?.length || 0} 首)</label>
                        <button
                          onclick={addMusicTrack}
                          class="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                          <span>添加新曲目</span>
                        </button>
                      </div>

                      <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {#each siteConfigState.musicTracks as track, idx}
                          <div class="p-3.5 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <img src={track.cover || "/assets/images/music/dazbee.webp"} alt={track.title} class="w-10 h-10 rounded-xl object-cover shrink-0 bg-surface" />
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 w-full">
                              <input
                                type="text"
                                bind:value={track.title}
                                placeholder="曲目标题"
                                class="px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface)] text-xs font-semibold outline-none"
                              />
                              <input
                                type="text"
                                bind:value={track.artist}
                                placeholder="艺术家 / 歌手"
                                class="px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface)] text-xs outline-none"
                              />
                              <div class="flex items-center gap-1">
                                <input
                                  type="text"
                                  bind:value={track.source}
                                  placeholder="音频 URL (/assets/music/... 或 https://...)"
                                  class="flex-1 px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface)] text-xs outline-none font-mono"
                                />
                                <label class="cursor-pointer p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[10px] shrink-0 font-medium" title="上传音频文件 (.mp3, .flac, .wav, .ogg, .m4a)">
                                  <span>🎵 上传</span>
                                  <input type="file" accept="audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac" class="hidden" onchange={(e) => handleGenericUpload(e, (url) => { track.source = url; })} />
                                </label>
                                {#if track.source}
                                  <button type="button" onclick={() => copyToClipboard(track.source)} class="p-1.5 rounded-lg border border-[var(--outline-variant)]/20 hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)] text-[10px] shrink-0" title="复制音频链接">
                                    📋
                                  </button>
                                {/if}
                              </div>
                              <div class="flex items-center gap-1">
                                <input
                                  type="text"
                                  bind:value={track.cover}
                                  placeholder="封面图片 URL"
                                  class="flex-1 px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface)] text-xs outline-none font-mono"
                                />
                                <label class="cursor-pointer p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[10px] shrink-0 font-medium" title="上传封面图片">
                                  <span>🖼️ 上传</span>
                                  <input type="file" accept="image/*" class="hidden" onchange={(e) => handleGenericUpload(e, (url) => { track.cover = url; })} />
                                </label>
                                {#if track.cover}
                                  <button type="button" onclick={() => copyToClipboard(track.cover)} class="p-1.5 rounded-lg border border-[var(--outline-variant)]/20 hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)] text-[10px] shrink-0" title="复制封面链接">
                                    📋
                                  </button>
                                {/if}
                              </div>
                            </div>
                            <button
                              onclick={() => removeMusicTrack(idx)}
                              class="p-2 text-error hover:bg-error/10 rounded-xl transition-colors shrink-0"
                              title="移除此曲目"
                            >
                              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>



            <!-- Seed & Presets Sync Management -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <h2 class="text-lg font-bold mb-1 flex items-center gap-2">
                <span>📦 预设示例数据与数据库同步</span>
              </h2>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">
                一键将 22 篇示例博文、6 条随想动态、精选画廊相册、友链及背景图同步写入 D1 数据库。数据库为前台唯一事实来源，所有预设均可在后台增删改查。
              </p>

              <div class="flex flex-wrap gap-3">
                <button
                  onclick={() => handleSeedPresets(false)}
                  class="px-5 py-2.5 rounded-full border border-primary/40 bg-primary/10 text-primary font-semibold text-xs hover:bg-primary/20 active:scale-98 transition-all flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  <span>补充同步预设数据 (不覆盖已有数据)</span>
                </button>
                <button
                  onclick={() => handleSeedPresets(true)}
                  class="px-5 py-2.5 rounded-full border border-error/40 bg-error/10 text-error font-semibold text-xs hover:bg-error/20 active:scale-98 transition-all flex items-center gap-2"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  <span>一键重置恢复全部预设示例</span>
                </button>
              </div>
            </div>

            <!-- Save Button -->
            <button
              onclick={saveAllSettings}
              class="px-8 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>保存所有外观与系统设定</span>
            </button>
          </div>

        {:else if currentTab === "timeline"}
          <!-- Timeline Management Panel -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold">⏳ 时间线事件管理 (Timeline)</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">管理前台 /timeline/ 发展历程与里程碑节点，支持拖拽排序、分类标签、亮点成就及实时增删</p>
            </div>
            <div class="flex items-center gap-3">
              <a
                href="/timeline/"
                target="_blank"
                class="px-4 py-2 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] text-xs font-semibold transition-all"
              >
                预览前台时间线 ↗
              </a>
              <button
                type="button"
                onclick={saveTimelineSettings}
                class="px-6 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 active:scale-98 transition-all flex items-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                <span>保存时间线设置</span>
              </button>
            </div>
          </div>

          <div class="space-y-6">
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm">
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>时间线节点列表 ({siteConfigState.timeline.length} 个)</span>
                </h2>
                <button
                  type="button"
                  onclick={addTimelineItem}
                  class="px-4 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all flex items-center gap-1"
                >
                  + 新增事件节点
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)] mb-4">前台采用精致轴线设计，按时间倒序清晰展示个人经历、项目发布及关键突破。</p>

              {#if siteConfigState.timeline && siteConfigState.timeline.length > 0}
                <div class="space-y-4">
                  {#each siteConfigState.timeline as item, idx}
                    <div
                      draggable="true"
                      ondragstart={() => (draggedTimelineIndex = idx)}
                      ondragover={(e) => { e.preventDefault(); }}
                      ondrop={() => handleTimelineDrop(idx)}
                      class="p-5 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 space-y-3 transition-shadow {draggedTimelineIndex === idx ? 'opacity-50 border-primary' : ''}"
                    >
                      <div class="flex items-center justify-between gap-3 pb-2 border-b border-[var(--outline-variant)]/10">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="cursor-grab text-[var(--on-surface-variant)] hover:text-primary select-none text-xs font-mono" title="按住拖拽排序">⋮⋮</span>
                          <span class="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">#{idx + 1}</span>
                          <span class="font-bold text-sm text-[var(--on-surface)]">{item.title || "未命名节点"}</span>
                          {#if item.date}<span class="text-xs text-primary font-mono font-semibold">({item.date})</span>{/if}
                          {#if item.category}<span class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] font-medium">{item.category}</span>{/if}
                          {#if item.featured}<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold">精选高亮</span>{/if}
                          {#if item.enable === false}<span class="text-[10px] px-2 py-0.5 rounded-full bg-error/15 text-error font-semibold">已禁用</span>{/if}
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onclick={() => moveTimelineItem(idx, "up")}
                            disabled={idx === 0}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="上移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => moveTimelineItem(idx, "down")}
                            disabled={idx === siteConfigState.timeline.length - 1}
                            class="p-1.5 text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] rounded-lg transition-colors disabled:opacity-30"
                            title="下移"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                          </button>
                          <button
                            type="button"
                            onclick={() => removeTimelineItem(idx)}
                            class="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors"
                            title="删除此节点"
                          >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">事件标题 (Title) *</label>
                          <input
                            type="text"
                            bind:value={item.title}
                            placeholder="如 Architecture Upgrade"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">发生时间 (Date) *</label>
                          <input
                            type="text"
                            bind:value={item.date}
                            placeholder="如 2026.08 或 2025.03 – 至今"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">副标题/机构 (Subtitle)</label>
                          <input
                            type="text"
                            bind:value={item.subtitle}
                            placeholder="如 Technology Lab 或 开源项目"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">地点/坐标 (Location)</label>
                          <input
                            type="text"
                            bind:value={item.location}
                            placeholder="如 Tokyo, Japan"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">事件分类 (Category)</label>
                          <input
                            type="text"
                            list="timeline-category-list"
                            bind:value={item.category}
                            placeholder="milestone / career / project / education / life"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                          <datalist id="timeline-category-list">
                            {#each distinctTimelineCategories as cat}
                              <option value={cat}></option>
                            {/each}
                          </datalist>
                          {#if distinctTimelineCategories.length > 0}
                            <div class="flex flex-wrap gap-1 mt-1.5">
                              {#each distinctTimelineCategories as cat}
                                <button
                                  type="button"
                                  onclick={() => (item.category = cat)}
                                  class="text-[9px] px-2 py-0.5 rounded-md transition-colors {item.category === cat ? 'bg-primary text-on-primary font-bold' : 'bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary'}"
                                >
                                  {cat}
                                </button>
                              {/each}
                            </div>
                          {/if}
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">图标 (Iconify)</label>
                          <input
                            type="text"
                            bind:value={item.icon}
                            placeholder="material-symbols:rocket-launch-rounded"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-mono"
                          />
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">技术或标签 (Tags，以英文逗号分隔)</label>
                          <input
                            type="text"
                            value={Array.isArray(item.tags) ? item.tags.join(", ") : (item.tags || "")}
                            oninput={(e) => {
                              item.tags = (e.target as HTMLInputElement).value
                                .split(/[,，]/)
                                .map((s) => s.trim())
                                .filter(Boolean);
                            }}
                            placeholder="Astro, Svelte 5, M3E, Tailwind"
                            class="w-full px-2.5 py-1.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none"
                          />
                        </div>
                      </div>

                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">详细描述 (Description)</label>
                          <textarea
                            bind:value={item.description}
                            rows="3"
                            placeholder="记录该事件节点的详细内容、心得感悟与历程背景..."
                            class="w-full p-2.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none resize-none"
                          ></textarea>
                        </div>
                        <div>
                          <label class="text-[10px] text-[var(--on-surface-variant)] block font-medium">成就有利点/核心亮点 (Highlights，每行一条)</label>
                          <textarea
                            value={Array.isArray(item.highlights) ? item.highlights.join("\n") : (item.highlights || "")}
                            oninput={(e) => {
                              item.highlights = (e.target as HTMLTextAreaElement).value
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean);
                            }}
                            rows="3"
                            placeholder="亮点 1: 升级了全新核心架构&#10;亮点 2: 提高了运行效率 40%"
                            class="w-full p-2.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] outline-none font-mono"
                          ></textarea>
                        </div>
                      </div>

                      <div class="flex items-center gap-6 pt-1 text-xs">
                        <label class="flex items-center gap-2 cursor-pointer font-medium">
                          <input type="checkbox" bind:checked={item.featured} class="w-4 h-4 text-amber-500 rounded" />
                          <span>⭐ 设为重要里程碑高亮 (Featured)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer font-medium">
                          <input
                            type="checkbox"
                            checked={item.enable !== false}
                            onchange={(e) => { item.enable = (e.target as HTMLInputElement).checked; }}
                            class="w-4 h-4 text-primary rounded"
                          />
                          <span>在前台展示此时间线节点</span>
                        </label>
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-[var(--on-surface-variant)] italic py-2">暂无时间线节点，请点击右上角「+ 新增事件节点」</p>
              {/if}
            </div>

            <button
              type="button"
              onclick={saveTimelineSettings}
              class="px-8 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-md hover:brightness-105 active:scale-98 transition-all flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>保存时间线设置</span>
            </button>
          </div>

        {:else if currentTab === "media"}
          <!-- Media Library Panel -->
          <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 class="text-2xl font-bold">🖼️ 媒体库 (R2 Cloud Storage)</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">查看并管理存储在 Cloudflare R2 中的图片、音频与附件资源，支持一键上传、复制 URL 及彻底删除</p>
            </div>
            <div class="flex items-center gap-3">
              <button
                type="button"
                onclick={loadMediaLibrary}
                class="px-4 py-2 rounded-full border border-[var(--outline-variant)]/40 hover:bg-[var(--surface-container)] text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <span>🔄 刷新</span>
              </button>
              <label class="px-5 py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 cursor-pointer flex items-center gap-1.5 transition-all active:scale-98">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                <span>{mediaUploading ? "正在上传中..." : "📤 上传文件到 R2"}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac,.pdf"
                  disabled={mediaUploading}
                  class="hidden"
                  onchange={handleMediaLibraryUpload}
                />
              </label>
            </div>
          </div>

          <!-- Stats & Filter Bar -->
          <div class="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <span class="text-xs font-semibold text-[var(--on-surface)]">
                总文件数: <strong class="text-primary">{mediaFiles.length}</strong>
              </span>
              <span class="text-xs font-semibold text-[var(--on-surface-variant)]">
                占用存储: <strong class="text-[var(--on-surface)]">{formatFileSize(totalMediaStorageBytes)}</strong>
              </span>
            </div>

            <div class="flex items-center gap-3 flex-1 sm:flex-initial justify-end">
              <!-- Filter tabs -->
              <div class="flex items-center rounded-xl bg-[var(--surface-container)] p-0.5 text-xs font-medium border border-[var(--outline-variant)]/20">
                <button
                  type="button"
                  onclick={() => (mediaFilter = "all")}
                  class="px-2.5 py-1 rounded-lg transition-colors {mediaFilter === 'all' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                >
                  全部 ({mediaFiles.length})
                </button>
                <button
                  type="button"
                  onclick={() => (mediaFilter = "image")}
                  class="px-2.5 py-1 rounded-lg transition-colors {mediaFilter === 'image' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                >
                  图片
                </button>
                <button
                  type="button"
                  onclick={() => (mediaFilter = "audio")}
                  class="px-2.5 py-1 rounded-lg transition-colors {mediaFilter === 'audio' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                >
                  音频
                </button>
                <button
                  type="button"
                  onclick={() => (mediaFilter = "uploaded")}
                  class="px-2.5 py-1 rounded-lg transition-colors {mediaFilter === 'uploaded' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                >
                  云端上传
                </button>
                <button
                  type="button"
                  onclick={() => (mediaFilter = "preset")}
                  class="px-2.5 py-1 rounded-lg transition-colors {mediaFilter === 'preset' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                >
                  全站预设
                </button>
              </div>

              <!-- Search -->
              <div class="relative w-48 sm:w-64">
                <input
                  type="text"
                  bind:value={mediaSearch}
                  placeholder="搜索文件名或路径..."
                  class="w-full px-3 py-1.5 pl-8 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-xs outline-none focus:border-primary"
                />
                <svg class="w-3.5 h-3.5 text-[var(--on-surface-variant)] absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
            </div>
          </div>

          <!-- Media Files Grid -->
          {#if filteredMediaFiles.length > 0}
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {#each filteredMediaFiles as file}
                {@const isImage = /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i.test(file.key) || file.httpMetadata?.contentType?.startsWith("image/")}
                {@const isAudio = /\.(mp3|flac|wav|ogg|m4a|aac)$/i.test(file.key) || file.httpMetadata?.contentType?.startsWith("audio/")}
                <div class="rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface)] overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                  <div class="h-32 bg-[var(--surface-container)] relative overflow-hidden flex items-center justify-center">
                    {#if isImage}
                      <img src={file.url} alt={file.key} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    {:else if isAudio}
                      <div class="flex flex-col items-center gap-1.5 text-primary p-2 w-full">
                        <span class="text-2xl">🎵</span>
                        <span class="text-[10px] font-mono text-[var(--on-surface-variant)] truncate max-w-[100px]">{file.key.split('.').pop()?.toUpperCase()}</span>
                      </div>
                    {:else}
                      <div class="flex flex-col items-center gap-1 text-[var(--on-surface-variant)]">
                        <span class="text-3xl">📄</span>
                        <span class="text-[10px] font-mono uppercase">{file.key.split('.').pop()}</span>
                      </div>
                    {/if}
                    <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-semibold {file.isPreset ? 'bg-secondary/80 text-on-secondary' : 'bg-primary/80 text-on-primary'} backdrop-blur-xs">
                      {file.isPreset ? '预设' : 'R2 云端'}
                    </span>
                    <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-mono backdrop-blur-xs">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  <div class="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <p class="text-xs font-semibold text-[var(--on-surface)] truncate" title={file.key}>{file.key.split("/").pop() || file.key}</p>
                      <p class="text-[10px] text-[var(--on-surface-variant)] font-mono truncate mt-0.5" title={file.url}>{file.url}</p>
                      {#if isAudio}
                        <audio controls src={file.url} preload="none" class="w-full mt-2 h-7 rounded"></audio>
                      {/if}
                    </div>

                    <div class="mt-3 pt-2 border-t border-[var(--outline-variant)]/10 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onclick={() => copyToClipboard(file.url)}
                        class="text-primary hover:underline text-[11px] font-medium flex items-center gap-1"
                        title="复制外链"
                      >
                        <span>📋 复制 URL</span>
                      </button>
                      {#if !file.isPreset}
                        <button
                          type="button"
                          onclick={() => deleteMediaFile(file.key)}
                          class="text-error hover:underline text-[11px] font-medium"
                          title="从 R2 彻底删除"
                        >
                          删除
                        </button>
                      {:else}
                        <span class="text-[10px] text-[var(--on-surface-variant)]">内置</span>
                      {/if}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="p-12 text-center rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 space-y-3">
              <span class="text-4xl block">🖼️</span>
              <p class="text-sm font-semibold text-[var(--on-surface)]">暂无匹配的媒体文件</p>
              <p class="text-xs text-[var(--on-surface-variant)]">点击右上角「上传文件到 R2」，可上传图片、音频及媒体素材</p>
            </div>
          {/if}

        {:else if currentTab === "guide"}
          <!-- Markdown Syntax Guide Panel -->
          <div class="mb-6 flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold">📖 写作语法指南 (Markdown Cheat Sheet)</h1>
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">Shirine 原生支持丰富的 Material 3 Expressive 扩展语法。点击任一代码块右上角即可直接复制模板使用！</p>
            </div>
          </div>

          <div class="space-y-6 max-w-4xl">
            <!-- Basic Formatting -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>🖋️ 基础文本排版 (Headings, Bold, Lists, Tables)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard(`## 二级标题\n### 三级标题\n\n**加粗文字**，*斜体文字*，~~删除线~~，==高亮标记==。\n\n> 这是一个经典引用段落。\n\n- 无序列表项 A\n- 无序列表项 B\n  - 嵌套列表项\n\n1. 有序编号 1\n2. 有序编号 2\n\n- [x] 已完成的任务\n- [ ] 待完成的任务清单`)}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制基础语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">支持标准 GFM（GitHub Flavored Markdown）所有排版特性，包括表格、任务清单与脚注。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>## 二级标题
### 三级标题

**加粗文字**，*斜体文字*，~~删除线~~，==高亮标记==。

> 这是一个经典引用段落。

- 无序列表项 A
- 无序列表项 B
  - 嵌套列表项

1. 有序编号 1
2. 有序编号 2

- [x] 已完成的任务
- [ ] 待完成的任务清单

| 表头一 | 表头二 | 表头三 |
| :--- | :---: | ---: |
| 左对齐 | 居中对齐 | 右对齐 |</code></pre>
            </div>

            <!-- Admonitions -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>💡 警告与提示卡片 (Admonitions)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard(`:::note[说明标注]\n这是一个通用的说明信息标注卡片。\n:::\n\n:::tip[实用技巧]\n推荐在编写教程时使用此提示框，突出核心操作秘诀。\n:::\n\n:::important[重要提醒]\n特别关键的注意要点，提醒读者切勿遗漏。\n:::\n\n:::warning[警示信息]\n操作过程中可能出现的意外隐患与警告。\n:::\n\n:::caution[危险操作]\n可能导致数据丢失或严重异常的高危操作提醒。\n:::`)}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制全套卡片语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">采用 Directive 风格三冒号包裹，内置 note, tip, important, warning, caution 5 大语义配色及 Material 3 图标。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>:::note[说明标注]
这是一个通用的说明信息标注卡片。
:::

:::tip[实用技巧]
推荐在编写教程时使用此提示框，突出核心操作秘诀。
:::

:::important[重要提醒]
特别关键的注意要点，提醒读者切勿遗漏。
:::

:::warning[警示信息]
操作过程中可能出现的意外隐患与警告。
:::

:::caution[危险操作]
可能导致数据丢失或严重异常的高危操作提醒。
:::</code></pre>
            </div>

            <!-- Expressive Code -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>💻 增强代码块 (Expressive Code)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard('```ts title="src/utils/demo.ts" {2,4-5}\nexport function greeting(name: string): string {\n  // 这一行将被高亮标注\n  const message = `Hello, ${name}!`;\n  console.log(message);\n  return message;\n}\n```')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制代码块语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">支持文件名标题栏 <code>title="..."</code>、指定行高亮 <code>&#123;1,3-5&#125;</code>、差异标记 <code>// [!code ++]</code> 与终端命令复制。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>```ts title="src/utils/demo.ts" &#123;2,4-5&#125;
export function greeting(name: string): string &#123;
  // 这一行将被高亮标注
  const message = `Hello, $&#123;name&#125;!`;
  console.log(message);
  return message;
&#125;
```</code></pre>
            </div>

            <!-- Math & Mermaid -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>📐 数学公式与 Mermaid 流程图 (KaTeX & Diagrams)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard('行内公式如质能方程：$E = mc^2$\n\n块级复杂公式：\n$$\n\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}\n$$\n\n```mermaid\ngraph TD;\n    A[编写文章] --> B(实时渲染预览);\n    B --> C{是否发布?};\n    C -- 是 --> D[前台访客浏览];\n    C -- 否 --> E[存为草稿];\n```')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制公式图表语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">原生内置 KaTeX 渲染引擎与 Mermaid 图表引擎，无须手动引入任何额外外部脚本。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>行内公式如质能方程：$E = mc^2$

块级复杂公式：
$$
\sum_&#123;n=1&#125;^\infty \frac&#123;1&#125;&#123;n^2&#125; = \frac&#123;\pi^2&#125;&#123;6&#125;
$$

```mermaid
graph TD;
    A[编写文章] --> B(实时渲染预览);
    B --> C&#123;是否发布?&#125;;
    C -- 是 --> D[前台访客浏览];
    C -- 否 --> E[存为草稿];
```</code></pre>
            </div>

            <!-- Collapse Panels & Tabs -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>📂 折叠面板与分栏选项卡 (Collapse & Tabs)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard(':::collapse[点击展开阅读详情与配置说明]\n这里是折叠内部的详细长文本内容，默认收起，保持页面清爽。\n:::\n\n:::tabs\n== pnpm\n```bash\npnpm install\n```\n== bun\n```bash\nbun install\n```\n== npm\n```bash\nnpm install\n```\n:::')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制折叠分栏语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">用于长篇内容折叠隐藏、以及多包管理器命令对比切换。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>:::collapse[点击展开阅读详情与配置说明]
这里是折叠内部的详细长文本内容，默认收起，保持页面清爽。
:::

:::tabs
== pnpm
```bash
pnpm install
```
== bun
```bash
bun install
```
== npm
```bash
npm install
```
:::</code></pre>
            </div>

            <!-- Video & Audio Embeds -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>🎬 视频、音频与画廊组件 (Media Embeds)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard('::bilibili[BV1GJ411x7h7]\n\n::youtube[dQw4w9WgXcQ]\n\n::audio[https://example.com/song.mp3]{title="曲目名" artist="歌手"}\n\n:::image-grid{cols=2}\n![示例 1](https://example.com/image1.webp)\n![示例 2](https://example.com/image2.webp)\n:::\n\n::spoiler[这是一段鼠标滑过才显示的剧透遮罩文字]')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制多媒体语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">支持一行嵌入 B 站、YouTube 响应式视频，以及双列画廊和剧透刮刮乐。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>::bilibili[BV1GJ411x7h7]

::youtube[dQw4w9WgXcQ]

::audio[https://example.com/song.mp3]&#123;title="曲目名" artist="歌手"&#125;

:::image-grid&#123;cols=2&#125;
![示例 1](https://example.com/image1.webp)
![示例 2](https://example.com/image2.webp)
:::

::spoiler[这是一段鼠标滑过才显示的剧透遮罩文字]</code></pre>
            </div>

            <!-- Steps Flow -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>🪜 序号导轨步骤条 (Steps Flow)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard(':::steps{title="部署流程"}\n1. **安装项目依赖**\n\n   在终端执行 `bun install` 安装所有必须的运行时模块。\n\n2. **配置环境变量**\n\n   根据 `.env.example` 填入 Cloudflare D1、R2 凭证与鉴权密钥。\n\n3. **执行发布构建**\n\n   运行 `bun run build` 生成生产就绪静态文件并推送到 Cloudflare Pages。\n:::')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制步骤条语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">将有序列表渲染为 Material 3 Expressive 序号导轨流，适合撰写环境配置、安装教程与工作流。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>:::steps&#123;title="部署流程"&#125;
1. **安装项目依赖**

   在终端执行 `bun install` 安装所有必须的运行时模块。

2. **配置环境变量**

   根据 `.env.example` 填入 Cloudflare D1、R2 凭证与鉴权密钥。

3. **执行发布构建**

   运行 `bun run build` 生成生产就绪静态文件并推送到 Cloudflare Pages。
:::</code></pre>
            </div>

            <!-- File Tree -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>🌲 交互式目录树 (File Tree)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard(':::file-tree{title="Shirine 源码目录结构" icon="colored"}\n- client/\n  - src/\n    - components/\n      - PostCard.astro\n      - Header.astro\n    - content/\n      - posts/ # 博客正文 Markdown\n    - styles/\n  - public/\n    - favicon.svg\n- server/\n  - src/\n    - routes/\n- wrangler.jsonc\n:::')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制目录树语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">使用 Markdown 嵌套列表或代码围栏即可生成带多彩图标的可折叠项目目录树。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>:::file-tree&#123;title="Shirine 源码目录结构" icon="colored"&#125;
- client/
  - src/
    - components/
      - PostCard.astro
      - Header.astro
    - content/
      - posts/ # 博客正文 Markdown
    - styles/
  - public/
    - favicon.svg
- server/
  - src/
    - routes/
- wrangler.jsonc
:::</code></pre>
            </div>

            <!-- Artplayer & Audio Reader -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>🎥 Artplayer 视频播放器与 Audio Reader 行内朗读</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard('::artplayer{src="https://pub-a6d6803bf2bf426ca31d2f66fdba3ace.r2.dev/video/demo.mp4" title="Shirine 演示视频" preload="auto"}\n\n:audio-reader[试听《口笛で愛は歌えない》音频片段]{src="https://pub-a6d6803bf2bf426ca31d2f66fdba3ace.r2.dev/audio/dazbee.mp3"}')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制音视频语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">Shirine 原生支持接入 R2 直链的 HTML5 原生极速播放器与紧凑型行内发音朗读器。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>::artplayer&#123;src="https://pub-a6d6803bf2bf426ca31d2f66fdba3ace.r2.dev/video/demo.mp4" title="Shirine 演示视频" preload="auto"&#125;

:audio-reader[试听《口笛で愛は歌えない》音频片段]&#123;src="https://pub-a6d6803bf2bf426ca31d2f66fdba3ace.r2.dev/audio/dazbee.mp3"&#125;</code></pre>
            </div>

            <!-- GitHub Card & Field Group -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>🐙 GitHub 仓库卡片与参数属性清单 (Field Cards)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard('::github{repo="yiran168/Shirine"}\n\n:::: field-group\n\n::: field title\n@type string\n@required\n\n博文或页面的主标题，将渲染在文章卡片与顶部 AppBar 中。\n:::\n\n::: field draft\n@type boolean\n@default false\n@optional\n\n是否存为草稿。当设为 true 时，仅管理员登录后可见，普通访客不可访问。\n:::\n\n::::')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制卡片语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">一行代码自动拉取并渲染 GitHub 仓库信息，以及编写 API 文档专用的结构化参数属性卡片。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>::github&#123;repo="yiran168/Shirine"&#125;

:::: field-group

::: field title
@type string
@required

博文或页面的主标题，将渲染在文章卡片与顶部 AppBar 中。
:::

::: field draft
@type boolean
@default false
@optional

是否存为草稿。当设为 true 时，仅管理员登录后可见，普通访客不可访问。
:::

::::</code></pre>
            </div>

            <!-- Annotations & Marker Highlights -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>🏷️ 荧光笔高亮与悬浮术语注解 (Marker & Annotations)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard('Shirine 采用了现代化 Material 3 动态取色算法 [+m3e]。\n\n[+m3e]:\n  Material 3 Expressive 设计规范，根据主色相自动生成全套对比度适配的色彩变量。\n\n==主题主色荧光标记==\n==错误警示标记=={.error}\n==实用技巧标记=={.tip}\n==第三强调色标记=={.tertiary}')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制高亮与注解语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">支持 4 种语义的荧光笔高亮标注，以及鼠标悬停即刻弹出浮层解释的行内术语注解。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>Shirine 采用了现代化 Material 3 动态取色算法 [+m3e]。

[+m3e]:
  Material 3 Expressive 设计规范，根据主色相自动生成全套对比度适配的色彩变量。

==主题主色荧光标记==
==错误警示标记==&#123;.error&#125;
==实用技巧标记==&#123;.tip&#125;
==第三强调色标记==&#123;.tertiary&#125;</code></pre>
            </div>

            <!-- Multi-tab Sync & Accordion FAQ -->
            <div class="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--outline-variant)]/30 shadow-sm space-y-4">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--outline-variant)]/15">
                <h2 class="text-base font-bold flex items-center gap-2">
                  <span>❓ 手风琴问答组与同步代码选项卡 (Accordion & Option Groups)</span>
                </h2>
                <button
                  type="button"
                  onclick={() => copyToClipboard(':::collapse[❓ 常见问题 1：全站多媒体如何直传 Cloudflare R2？]\n配置 Cloudflare R2 绑定凭证并在 `wrangler.jsonc` 中指定 `PUBLIC_R2_URL`，系统上传的所有图片、音频与预设文件均全量使用 R2 CDN 直链。\n:::\n\n:::collapse[❓ 常见问题 2：为什么管理员无需输入密码或积分即可直读加密内容？]\nShirine 现已全面升级权限流：当检测到当前访客具有管理员（admin / superadmin）身份时，SSR 端自动透传特权直出完整正文，无需解密密码或扣除积分！\n:::\n\n::: tabs#package-manager\n\n@tab:active pnpm#pnpm\n```bash\npnpm install\npnpm dev\n```\n\n@tab Bun#bun\n```bash\nbun install\nbun dev\n```\n\n@tab npm#npm\n```bash\nnpm install\nnpm run dev\n```\n\n:::')}
                  class="px-3 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-primary font-medium transition-colors"
                >
                  📋 复制问答与选项卡语法
                </button>
              </div>
              <p class="text-xs text-[var(--on-surface-variant)]">带有记忆能力的多选项卡，以及可自由折叠展开的手风琴问答列表。</p>
              <pre class="p-4 rounded-2xl bg-[var(--surface-container-low)] text-xs font-mono overflow-x-auto text-[var(--on-surface)] leading-relaxed"><code>:::collapse[❓ 常见问题 1：全站多媒体如何直传 Cloudflare R2？]
配置 Cloudflare R2 绑定凭证并在 `wrangler.jsonc` 中指定 `PUBLIC_R2_URL`，系统上传的所有图片、音频与预设文件均全量使用 R2 CDN 直链。
:::

:::collapse[❓ 常见问题 2：为什么管理员无需输入密码或积分即可直读加密内容？]
Shirine 现已全面升级权限流：当检测到当前访客具有管理员（admin / superadmin）身份时，SSR 端自动透传特权直出完整正文，无需解密密码或扣除积分！
:::

::: tabs#package-manager

@tab:active pnpm#pnpm
```bash
pnpm install
pnpm dev
```

@tab Bun#bun
```bash
bun install
bun dev
```

@tab npm#npm
```bash
npm install
npm run dev
```

:::</code></pre>
            </div>
          </div>
        {/if}
      </main>
    </div>
  {/if}

  <!-- Post Editor Modal -->
  {#if postModalOpen}
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onclick={(e) => { if (e.target === e.currentTarget) postModalOpen = false; }}
      role="dialog"
    >
      <div class="bg-white dark:bg-zinc-900 bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[var(--outline-variant)]/20">
          <h2 class="text-xl font-bold">{editingPost ? "编辑博文" : "撰写新文章"}</h2>
          <button onclick={() => (postModalOpen = false)} class="p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold block mb-1">文章标题 *</label>
              <input type="text" bind:value={postForm.title} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1">固定链接别名 Slug (如 hello-shirine)</label>
              <input type="text" bind:value={postForm.slug} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="text-xs font-semibold">分类 Category</label>
                {#if existingCategories.length > 0}
                  <select
                    class="text-[11px] px-2 py-0.5 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface-container)] text-[var(--on-surface-variant)] outline-none"
                    onchange={(e) => {
                      const val = (e.target as HTMLSelectElement).value;
                      if (val) postForm.category = val;
                    }}
                  >
                    <option value="">已有分类...</option>
                    {#each existingCategories as cat}
                      <option value={cat}>{cat}</option>
                    {/each}
                  </select>
                {/if}
              </div>
              <input type="text" bind:value={postForm.category} placeholder="输入或从右上角选择" class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1">标签 (逗号分隔)</label>
              <input type="text" bind:value={postForm.tags} placeholder="Shirine, Anime, Tech" class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
              {#if existingTagsWithCount.length > 0}
                <div class="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
                  {#each existingTagsWithCount.slice(0, 8) as tag}
                    <button
                      type="button"
                      onclick={() => {
                        const current = postForm.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean);
                        if (!current.includes(tag.name)) {
                          postForm.tags = current.length > 0 ? `${postForm.tags}, ${tag.name}` : tag.name;
                        }
                      }}
                      class="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
                      title="点击加入标签"
                    >
                      +{tag.name}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1">阅读权限级别</label>
              <select bind:value={postForm.permissionType} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none">
                <option value="public">完全公开 (Public)</option>
                <option value="login_required">登录可见 (Login Required)</option>
                <option value="points_required">积分解锁 (Points Required)</option>
              </select>
            </div>
          </div>

          {#if postForm.permissionType === 'points_required'}
            <div class="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between">
              <span class="text-xs font-semibold text-purple-600 dark:text-purple-400">所需解锁积分点数：</span>
              <input type="number" bind:value={postForm.requiredPoints} min="1" class="w-28 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-[var(--surface-container-low)] text-sm font-bold text-center outline-none" />
            </div>
          {/if}

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20">
            <div>
              <label class="text-xs font-semibold block mb-1">独立访问密码 (Encrypted / Password)</label>
              <input
                type="text"
                bind:value={postForm.password}
                placeholder="设置访问密码，留空则无需密码"
                class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-sm outline-none font-mono"
              />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1">密码提示 (Password Hint)</label>
              <input
                type="text"
                bind:value={postForm.passwordHint}
                placeholder="例如：博主的生日"
                class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-sm outline-none"
              />
            </div>
            <div class="sm:col-span-2 flex flex-wrap gap-6 pt-2">
              <label class="flex items-center gap-2 cursor-pointer text-xs font-medium">
                <input type="checkbox" bind:checked={postForm.pinned} class="rounded text-primary focus:ring-primary w-4 h-4" />
                <span>📌 置顶本篇文章</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-xs font-medium">
                <input type="checkbox" bind:checked={postForm.draft} class="rounded text-amber-500 focus:ring-amber-500 w-4 h-4" />
                <span>📝 保存为草稿（草稿仅管理员可见）</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer text-xs font-medium">
                <input type="checkbox" bind:checked={postForm.hideHomeContent} class="rounded text-primary focus:ring-primary w-4 h-4" />
                <span>🔒 密码保护时在首页/列表页隐藏摘要简介</span>
              </label>
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">封面图片 URL (或点击右侧按钮直接上传至 R2)</label>
            <div class="flex gap-2">
              <input type="text" bind:value={postForm.image} placeholder="https://..." class="flex-1 px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
              <label class="px-4 py-2 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium cursor-pointer flex items-center gap-1.5 shrink-0">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                <span>上传到 R2</span>
                <input type="file" accept="image/*" class="hidden" onchange={(e) => handleFileUpload(e, "postCover")} />
              </label>
            </div>
            {#if postForm.image}
              <div class="mt-1 flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
                <span class="truncate">封面链接: {postForm.image}</span>
                <button type="button" class="text-primary hover:underline shrink-0" onclick={() => copyToClipboard(postForm.image)}>复制链接</button>
              </div>
            {/if}
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-semibold">Markdown 正文内容 *</label>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={() => openAiAssistant("post")}
                  class="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium flex items-center gap-1 transition-colors"
                  title="使用 AI 智能优化、续写或生成文章大纲"
                >
                  <span>🤖 AI 写作助手</span>
                </button>
                <div class="flex items-center rounded-xl bg-[var(--surface-container)] p-0.5 text-xs font-medium border border-[var(--outline-variant)]/20">
                  <button
                    type="button"
                    onclick={() => (postEditorTab = "edit")}
                    class="px-3 py-1 rounded-lg transition-colors {postEditorTab === 'edit' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                  >
                    编辑源码
                  </button>
                  <button
                    type="button"
                    onclick={() => (postEditorTab = "preview")}
                    class="px-3 py-1 rounded-lg transition-colors {postEditorTab === 'preview' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                  >
                    实时预览
                  </button>
                </div>
              </div>
            </div>
            {#if postEditorTab === "edit"}
              <textarea
                bind:value={postForm.content}
                rows="12"
                placeholder="# 欢迎来到 Shirine 博文..."
                class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] font-mono text-sm focus:border-primary outline-none"
              ></textarea>
            {:else}
              <div class="w-full p-5 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] min-h-[280px] max-h-[450px] overflow-y-auto prose dark:prose-invert max-w-none text-sm leading-relaxed">
                {#if postPreviewHtml}
                  {@html postPreviewHtml}
                {:else}
                  <p class="text-xs text-[var(--on-surface-variant)] italic">暂无内容，请在左侧“编辑源码”中输入 Markdown 文本</p>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="pt-4 border-t border-[var(--outline-variant)]/20 flex items-center justify-end gap-3">
          <button onclick={() => (postModalOpen = false)} class="px-5 py-2 rounded-full border border-[var(--outline-variant)]/40 text-xs font-medium hover:bg-[var(--surface-container)]">取消</button>
          <button onclick={savePost} class="px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105">保存并发布</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Album Modal -->
  {#if albumModalOpen}
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onclick={(e) => { if (e.target === e.currentTarget) albumModalOpen = false; }}
      role="dialog"
    >
      <div class="bg-white dark:bg-zinc-900 bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[var(--outline-variant)]/20">
          <h2 class="text-xl font-bold">{editingAlbum ? "编辑相册" : "新建相册"}</h2>
          <button onclick={() => (albumModalOpen = false)} class="p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold block mb-1">相册名称 *</label>
              <input type="text" bind:value={albumForm.title} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1">Slug 别名</label>
              <input type="text" bind:value={albumForm.slug} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">相册描述</label>
            <input type="text" bind:value={albumForm.description} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">封面图片 URL</label>
            <div class="flex gap-2">
              <input type="text" bind:value={albumForm.cover} class="flex-1 px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
              <label class="px-4 py-2 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium cursor-pointer flex items-center gap-1.5 shrink-0">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                <span>上传封面</span>
                <input type="file" accept="image/*" class="hidden" onchange={(e) => handleFileUpload(e, "albumCover")} />
              </label>
            </div>
            {#if albumForm.cover}
              <div class="mt-1 flex items-center gap-2 text-xs text-[var(--on-surface-variant)]">
                <span class="truncate">封面链接: {albumForm.cover}</span>
                <button type="button" class="text-primary hover:underline shrink-0" onclick={() => copyToClipboard(albumForm.cover)}>复制链接</button>
              </div>
            {/if}
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold block mb-1">相册权限类型</label>
              <select bind:value={albumForm.permissionType} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none">
                <option value="public">完全公开</option>
                <option value="login_required">登录可见</option>
                <option value="points_required">积分解锁</option>
                <option value="password">独立密码保护 (Password)</option>
              </select>
            </div>
            {#if albumForm.permissionType === 'points_required'}
              <div>
                <label class="text-xs font-semibold block mb-1">所需解锁积分</label>
                <input type="number" bind:value={albumForm.requiredPoints} min="1" class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
              </div>
            {/if}
          </div>

          {#if albumForm.permissionType === 'password'}
            <div class="grid grid-cols-2 gap-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
              <div>
                <label class="text-xs font-semibold block mb-1 text-rose-600 dark:text-rose-400">相册访问密码 *</label>
                <input
                  type="text"
                  bind:value={albumForm.password}
                  placeholder="设置访问密码"
                  class="w-full px-3.5 py-2 rounded-xl border border-rose-500/30 bg-[var(--surface)] text-sm outline-none font-mono"
                />
              </div>
              <div>
                <label class="text-xs font-semibold block mb-1 text-rose-600 dark:text-rose-400">密码提示 Password Hint</label>
                <input
                  type="text"
                  bind:value={albumForm.passwordHint}
                  placeholder="例如：某次旅行的地点"
                  class="w-full px-3.5 py-2 rounded-xl border border-rose-500/30 bg-[var(--surface)] text-sm outline-none"
                />
              </div>
            </div>
          {/if}

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-semibold block">照片地址列表 (每行一张图片 URL)</label>
              <label class="px-3 py-1.5 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                <span>上传相片到 R2</span>
                <input type="file" accept="image/*" multiple class="hidden" onchange={handleAlbumPhotoUpload} />
              </label>
            </div>
            <textarea
              bind:value={albumForm.photosText}
              rows="6"
              placeholder="https://example.com/photo1.webp&#10;https://example.com/photo2.webp"
              class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] font-mono text-sm focus:border-primary outline-none"
            ></textarea>
            {#if lastUploadedAlbumPhotoUrl}
              <div class="mt-1.5 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                <span class="truncate">最近上传成功: {lastUploadedAlbumPhotoUrl}</span>
                <button type="button" class="font-bold hover:underline shrink-0" onclick={() => copyToClipboard(lastUploadedAlbumPhotoUrl)}>复制链接</button>
              </div>
            {/if}
          </div>
        </div>

        <div class="pt-4 border-t border-[var(--outline-variant)]/20 flex items-center justify-end gap-3">
          <button onclick={() => (albumModalOpen = false)} class="px-5 py-2 rounded-full border border-[var(--outline-variant)]/40 text-xs font-medium hover:bg-[var(--surface-container)]">取消</button>
          <button onclick={saveAlbum} class="px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105">保存相册</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Moment Edit Modal -->
  {#if momentModalOpen}
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onclick={(e) => { if (e.target === e.currentTarget) momentModalOpen = false; }}
      role="dialog"
    >
      <div class="bg-white dark:bg-zinc-900 bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[var(--outline-variant)]/20">
          <h2 class="text-xl font-bold">编辑动态日记</h2>
          <button onclick={() => (momentModalOpen = false)} class="p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-semibold">动态正文内容 *</label>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={() => openAiAssistant("moment")}
                  class="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium flex items-center gap-1 transition-colors"
                  title="使用 AI 智能优化或续写动态"
                >
                  <span>🤖 AI 写作助手</span>
                </button>
                <div class="flex items-center rounded-xl bg-[var(--surface-container)] p-0.5 text-xs font-medium border border-[var(--outline-variant)]/20">
                  <button
                    type="button"
                    onclick={() => (editMomentEditorTab = "edit")}
                    class="px-3 py-1 rounded-lg transition-colors {editMomentEditorTab === 'edit' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                  >
                    编辑源码
                  </button>
                  <button
                    type="button"
                    onclick={() => (editMomentEditorTab = "preview")}
                    class="px-3 py-1 rounded-lg transition-colors {editMomentEditorTab === 'preview' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                  >
                    实时预览
                  </button>
                </div>
              </div>
            </div>
            {#if editMomentEditorTab === "edit"}
              <textarea
                bind:value={editMomentForm.content}
                rows="4"
                class="w-full p-3.5 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none resize-none"
              ></textarea>
            {:else}
              <div class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] min-h-[120px] max-h-[250px] overflow-y-auto prose dark:prose-invert max-w-none text-sm leading-relaxed">
                {#if editMomentPreviewHtml}
                  {@html editMomentPreviewHtml}
                {:else}
                  <p class="text-xs text-[var(--on-surface-variant)] italic">暂无内容，请在左侧“编辑源码”中输入 Markdown 文本</p>
                {/if}
              </div>
            {/if}
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold block mb-1">心情状态 (Emoji 或文字)</label>
              <input
                type="text"
                bind:value={editMomentForm.mood}
                placeholder="✨"
                class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
              />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1">发布地点</label>
              <input
                type="text"
                bind:value={editMomentForm.location}
                placeholder="城市 / 坐标"
                class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <label class="text-xs font-semibold">附带图片列表 ({editMomentForm.photos.length} 张)</label>
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1">
                  <input
                    type="text"
                    bind:value={editMomentImageUrlInput}
                    placeholder="输入图片 URL..."
                    class="w-36 px-2.5 py-1 text-xs rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] outline-none"
                    onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditMomentPhotoUrl(); } }}
                  />
                  <button
                    type="button"
                    onclick={addEditMomentPhotoUrl}
                    class="text-xs px-2 py-1 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface)]"
                  >
                    添加
                  </button>
                </div>
                <label class="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium cursor-pointer flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span>上传新图片</span>
                  <input type="file" accept="image/*" class="hidden" onchange={(e) => handleFileUpload(e, "editMomentPhoto")} />
                </label>
              </div>
            </div>
            {#if editMomentForm.photos.length > 0}
              <div class="grid grid-cols-3 gap-2">
                {#each editMomentForm.photos as photo, idx}
                  <div class="relative group rounded-xl overflow-hidden border border-[var(--outline-variant)]/20">
                    <img src={photo} alt="" class="w-full h-20 object-cover" />
                    <button
                      type="button"
                      onclick={() => removeEditMomentPhoto(idx)}
                      class="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-error transition-colors"
                      title="移除图片"
                    >
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                {/each}
              </div>
              <div class="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                {#each editMomentForm.photos as photo, idx}
                  <div class="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--surface-container)] text-xs">
                    <span class="truncate font-mono text-[11px] flex-1 text-[var(--on-surface-variant)]">{photo}</span>
                    <button type="button" class="text-primary hover:underline text-[11px] shrink-0 font-medium" onclick={() => copyToClipboard(photo)}>复制链接</button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="flex items-center gap-6 pt-2">
            <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold">
              <input type="checkbox" bind:checked={editMomentForm.pinned} class="w-4 h-4 text-primary rounded" />
              <span>置顶此动态</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold">
              <input type="checkbox" bind:checked={editMomentForm.draft} class="w-4 h-4 text-primary rounded" />
              <span>存为草稿 (仅管理员可见)</span>
            </label>
          </div>
        </div>

        <div class="pt-4 border-t border-[var(--outline-variant)]/20 flex items-center justify-end gap-3">
          <button onclick={() => (momentModalOpen = false)} class="px-5 py-2 rounded-full border border-[var(--outline-variant)]/40 text-xs font-medium hover:bg-[var(--surface-container)]">取消</button>
          <button onclick={saveMomentEdit} class="px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105">保存修改</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Page Edit/Create Modal -->
  {#if pageModalOpen}
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onclick={(e) => { if (e.target === e.currentTarget) pageModalOpen = false; }}
      role="dialog"
    >
      <div class="bg-white dark:bg-zinc-900 bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[var(--outline-variant)]/20">
          <h2 class="text-xl font-bold">{editingPage ? "编辑独立页面" : "新建独立页面"}</h2>
          <button onclick={() => (pageModalOpen = false)} class="p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold block mb-1">页面标题 *</label>
              <input type="text" bind:value={pageForm.title} placeholder="例如：关于我们" class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1">访问路径 (Slug) *</label>
              <input type="text" bind:value={pageForm.slug} placeholder="例如：about" class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono" />
            </div>
          </div>

          <!-- Iconify Picker Section -->
          <div class="p-3.5 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 space-y-2.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-primary flex items-center gap-1.5">
                <span>🎨 页面导航图标 (Iconify)</span>
                {#if pageForm.icon}
                  <span class="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-mono text-[11px] font-semibold">{pageForm.icon}</span>
                {/if}
              </label>
              <a
                href="https://icon-sets.iconify.design/material-symbols/"
                target="_blank"
                rel="noreferrer"
                class="text-[11px] text-primary hover:underline flex items-center gap-1"
                title="在新窗口查阅 Material Symbols 官方全量图标名"
              >
                <span>查询 Material Symbols 全量图标库 ↗</span>
              </a>
            </div>

            <div class="flex items-center gap-2">
              <input
                type="text"
                bind:value={pageForm.icon}
                placeholder="例如: material-symbols:article-outline-rounded"
                class="flex-1 px-3 py-1.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs font-mono outline-none focus:border-primary"
              />
              {#if pageForm.icon}
                <button
                  type="button"
                  onclick={() => (pageForm.icon = "")}
                  class="px-2.5 py-1.5 rounded-xl border border-[var(--outline-variant)]/30 text-xs text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
                >
                  清除
                </button>
              {/if}
            </div>

            <div>
              <div class="text-[11px] text-[var(--on-surface-variant)] mb-1.5 font-medium">常用 Material Symbols 图标（点击一键选用）：</div>
              <div class="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                {#each BUILTIN_PAGE_ICONS as item}
                  <button
                    type="button"
                    onclick={() => (pageForm.icon = item.icon)}
                    class="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 transition-all {pageForm.icon === item.icon ? 'bg-primary text-on-primary font-bold shadow-xs' : 'bg-[var(--surface)] hover:bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] border border-[var(--outline-variant)]/20'}"
                    title={item.icon}
                  >
                    <span>{item.label}</span>
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">发布状态</label>
            <select bind:value={pageForm.status} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none">
              <option value="published">立即发布 (published)</option>
              <option value="draft">保存为草稿 (draft)</option>
            </select>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-semibold">Markdown 内容与实时预览</label>
              <div class="flex items-center gap-1 bg-[var(--surface-container)] p-0.5 rounded-lg border border-[var(--outline-variant)]/20">
                <button
                  type="button"
                  onclick={() => (pageEditorTab = "edit")}
                  class="px-3 py-1 rounded-md text-xs font-medium transition-all {pageEditorTab === 'edit' ? 'bg-primary text-on-primary shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                >
                  ✏️ 编辑正文
                </button>
                <button
                  type="button"
                  onclick={() => (pageEditorTab = "preview")}
                  class="px-3 py-1 rounded-md text-xs font-medium transition-all {pageEditorTab === 'preview' ? 'bg-primary text-on-primary shadow-xs' : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'}"
                >
                  👁️ 实时预览
                </button>
              </div>
            </div>

            {#if pageEditorTab === "edit"}
              <textarea
                bind:value={pageForm.content}
                rows="14"
                placeholder="在此输入页面正文 Markdown 内容..."
                class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] font-mono text-sm focus:border-primary outline-none"
              ></textarea>
            {:else}
              <div class="min-h-[300px] max-h-[480px] overflow-y-auto p-5 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-lowest)]">
                <div class="prose dark:prose-invert max-w-none text-sm leading-relaxed">
                  {@html renderDynamicMarkdown(pageForm.content || "*（暂无内容，请在「编辑正文」中输入 Markdown 文本）*")}
                </div>
              </div>
            {/if}
          </div>
        </div>

        <div class="pt-4 border-t border-[var(--outline-variant)]/20 flex items-center justify-between gap-3">
          <div>
            {#if pageForm.slug}
              <a
                href={['about', 'projects', 'devices', 'skills'].includes(pageForm.slug) ? `/${pageForm.slug}/` : `/pages/${pageForm.slug}`}
                target="_blank"
                class="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
              >
                <span>在新窗口预览效果</span>
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              </a>
            {/if}
          </div>
          <div class="flex items-center gap-3">
            <button onclick={() => (pageModalOpen = false)} class="px-5 py-2 rounded-full border border-[var(--outline-variant)]/40 text-xs font-medium hover:bg-[var(--surface-container)]">取消</button>
            <button onclick={savePage} class="px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105">保存页面</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Adjust Points Modal -->
  {#if userPointsModalOpen && targetUser}
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onclick={(e) => { if (e.target === e.currentTarget) userPointsModalOpen = false; }}
      role="dialog"
    >
      <div class="bg-white dark:bg-zinc-900 bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <h3 class="text-lg font-bold mb-1">调整用户积分</h3>
        <p class="text-xs text-[var(--on-surface-variant)] mb-4">
          目标用户：<strong class="text-[var(--on-surface)]">{targetUser.username}</strong>（当前积分：{targetUser.points}）
        </p>
        <div class="mb-4">
          <label class="text-xs font-semibold block mb-1">积分增减额度（正数为增加，负数为扣除）</label>
          <input
            type="number"
            bind:value={adjustPointsDelta}
            placeholder="例如: 50 或 -20"
            class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm font-bold outline-none"
          />
        </div>
        <div class="flex items-center justify-end gap-2">
          <button onclick={() => (userPointsModalOpen = false)} class="px-4 py-2 rounded-full border border-[var(--outline-variant)]/40 text-xs hover:bg-[var(--surface-container)]">取消</button>
          <button onclick={saveAdjustPoints} class="px-5 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold">确认调整</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Friend Modal -->
  {#if friendModalOpen}
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onclick={(e) => { if (e.target === e.currentTarget) friendModalOpen = false; }}
      role="dialog"
    >
      <div class="bg-white dark:bg-zinc-900 bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-md shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[var(--outline-variant)]/20">
          <h2 class="text-xl font-bold">{editingFriend ? "编辑友链" : "添加友链"}</h2>
          <button onclick={() => (friendModalOpen = false)} class="p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="py-4 space-y-4">
          <div>
            <label class="text-xs font-semibold block mb-1">站点名称 *</label>
            <input
              type="text"
              bind:value={friendForm.name}
              placeholder="例如：Shirine"
              class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
            />
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">站点网址 (URL) *</label>
            <input
              type="text"
              bind:value={friendForm.url}
              placeholder="https://example.com"
              class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
            />
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">站点图标 / 头像 URL *</label>
            <input
              type="text"
              bind:value={friendForm.avatar}
              placeholder="https://example.com/avatar.png"
              class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
            />
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">站点简介描述</label>
            <textarea
              bind:value={friendForm.desc}
              rows="2"
              placeholder="一句简短的站点描述..."
              class="w-full p-3 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
            ></textarea>
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">审核状态</label>
            <select
              bind:value={friendForm.status}
              class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
            >
              <option value="approved">已批准通过 (Approved)</option>
              <option value="pending">待审核 (Pending)</option>
            </select>
          </div>
        </div>

        <div class="pt-4 border-t border-[var(--outline-variant)]/20 flex items-center justify-end gap-3">
          <button onclick={() => (friendModalOpen = false)} class="px-5 py-2 rounded-full border border-[var(--outline-variant)]/40 text-xs font-medium hover:bg-[var(--surface-container)]">取消</button>
          <button onclick={saveFriend} class="px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105">保存友链</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Tag Manager Modal -->
  {#if tagManagerModalOpen}
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onclick={(e) => { if (e.target === e.currentTarget) tagManagerModalOpen = false; }}
      role="dialog"
    >
      <div class="bg-white dark:bg-zinc-900 bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[var(--outline-variant)]/20">
          <div>
            <h2 class="text-xl font-bold">全站标签管理</h2>
            <p class="text-xs text-[var(--on-surface-variant)] mt-0.5">创建、重命名或删除标签（重命名与删除会自动同步更新所有关联文章）</p>
          </div>
          <button onclick={() => (tagManagerModalOpen = false)} class="p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Add New Tag Input -->
        <div class="pt-4 pb-2 border-b border-[var(--outline-variant)]/20 flex items-center gap-2">
          <input
            type="text"
            bind:value={newTagName}
            placeholder="输入新标签名 (例如: Anime, 日记)"
            class="flex-1 px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none focus:border-primary"
            onkeydown={(e) => { if (e.key === 'Enter') handleAddNewTag(); }}
          />
          <button
            onclick={handleAddNewTag}
            class="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 shrink-0"
          >
            添加新标签
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 space-y-3">
          {#if existingTagsWithCount.length === 0}
            <div class="text-center py-8 text-xs text-[var(--on-surface-variant)]">
              暂无任何标签数据
            </div>
          {:else}
            <div class="space-y-2">
              {#each existingTagsWithCount as tag}
                <div class="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20">
                  <div class="flex items-center gap-2">
                    <span class="px-2.5 py-1 rounded-xl bg-primary/10 text-primary font-semibold text-xs font-mono">
                      #{tag.name}
                    </span>
                    <span class="text-xs text-[var(--on-surface-variant)]">
                      {tag.count} 篇文章
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    {#if renamingOldTag === tag.name}
                      <input
                        type="text"
                        bind:value={renamingNewTag}
                        placeholder="新标签名"
                        class="px-2.5 py-1 rounded-xl border border-primary text-xs bg-[var(--surface)] outline-none w-28"
                      />
                      <button
                        onclick={() => handleRenameTag(tag.name)}
                        class="px-3 py-1 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105"
                      >
                        确认
                      </button>
                      <button
                        onclick={() => { renamingOldTag = ""; renamingNewTag = ""; }}
                        class="px-2 py-1 rounded-xl border border-[var(--outline-variant)]/40 text-xs hover:bg-[var(--surface-container)]"
                      >
                        取消
                      </button>
                    {:else}
                      <button
                        onclick={() => { renamingOldTag = tag.name; renamingNewTag = tag.name; }}
                        class="px-3 py-1 rounded-xl border border-[var(--outline-variant)]/40 text-xs font-medium hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:text-primary transition-colors"
                      >
                        重命名
                      </button>
                      <button
                        onclick={() => handleDeleteTag(tag.name)}
                        class="px-3 py-1 rounded-xl border border-rose-500/30 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        删除
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="pt-4 border-t border-[var(--outline-variant)]/20 flex items-center justify-end">
          <button onclick={() => (tagManagerModalOpen = false)} class="px-5 py-2 rounded-full border border-[var(--outline-variant)]/40 text-xs font-medium hover:bg-[var(--surface-container)]">关闭</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- AI Assistant Modal -->
  {#if aiModalOpen}
    <div
      class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onclick={(e) => { if (e.target === e.currentTarget) aiModalOpen = false; }}
      role="dialog"
    >
      <div class="bg-white dark:bg-zinc-900 bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between pb-4 border-b border-[var(--outline-variant)]/20">
          <div class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">🤖</span>
            <div>
              <h2 class="text-lg font-bold">AI 智能写作助手</h2>
              <p class="text-xs text-[var(--on-surface-variant)]">
                当前协助：<strong class="text-primary">{aiTarget === "post" ? "博文撰写" : "动态日记"}</strong> · 模型：<code class="px-1.5 py-0.5 rounded bg-[var(--surface-container)] font-mono text-[11px]">{systemConfigState.aiModel}</code>
              </p>
            </div>
          </div>
          <button onclick={() => (aiModalOpen = false)} class="p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          <!-- Quick Prompt Chips -->
          <div>
            <label class="text-xs font-semibold text-[var(--on-surface)] block mb-1.5">快捷写作指令预设 (点击即可快速填入并生成)：</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                onclick={() => executeAiGeneration("请根据上方上下文内容继续往下续写，行文保持同一语调与深度，逻辑自然递进。")}
                disabled={aiGenerating}
                class="px-2.5 py-1 rounded-lg bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary text-xs font-medium transition-colors cursor-pointer"
              >
                ✨ 续写文章 / 下文展开
              </button>
              <button
                type="button"
                onclick={() => executeAiGeneration("请对已有内容进行润色优化，修饰措辞与语句通顺度，提升文字美感并修正错别字，保持原意。")}
                disabled={aiGenerating}
                class="px-2.5 py-1 rounded-lg bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary text-xs font-medium transition-colors cursor-pointer"
              >
                🎨 文笔润色 / 语句通顺
              </button>
              <button
                type="button"
                onclick={() => executeAiGeneration("请根据当前内容生成 150 字以内的精炼摘要与核心看点提要。")}
                disabled={aiGenerating}
                class="px-2.5 py-1 rounded-lg bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary text-xs font-medium transition-colors cursor-pointer"
              >
                📋 提炼摘要 / 核心看点
              </button>
              <button
                type="button"
                onclick={() => executeAiGeneration("请围绕当前主题为我设计一份详尽清晰的 Markdown 结构大纲（包含多级标题与小结）。")}
                disabled={aiGenerating}
                class="px-2.5 py-1 rounded-lg bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary text-xs font-medium transition-colors cursor-pointer"
              >
                📐 生成文章大纲结构
              </button>
              <button
                type="button"
                onclick={() => executeAiGeneration("请将以上正文流畅地翻译为地道优美的英文。")}
                disabled={aiGenerating}
                class="px-2.5 py-1 rounded-lg bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary text-xs font-medium transition-colors cursor-pointer"
              >
                🌐 翻译为地道英文
              </button>
              <button
                type="button"
                onclick={() => executeAiGeneration("请为当前文字优化 Markdown 排版格式，合理添加重点加粗、引用与分段。")}
                disabled={aiGenerating}
                class="px-2.5 py-1 rounded-lg bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-primary/20 hover:text-primary text-xs font-medium transition-colors cursor-pointer"
              >
                💡 优化排版与格式
              </button>
            </div>
          </div>

          <!-- Instruction Textarea -->
          <div>
            <label class="text-xs font-semibold text-[var(--on-surface)] block mb-1">自定义指令要求</label>
            <textarea
              bind:value={aiInstruction}
              rows="3"
              placeholder="输入给 AI 的具体要求，例如：'以幽默风趣的技术博主口吻为本段写一个生动的开场白'..."
              class="w-full p-3 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none focus:border-primary resize-none"
            ></textarea>
          </div>

          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              {#if aiAvailableModels.length > 0}
                <label class="text-[11px] text-[var(--on-surface-variant)]">模型：</label>
                <select
                  bind:value={systemConfigState.aiModel}
                  class="px-2.5 py-1 rounded-lg border border-[var(--outline-variant)]/30 bg-[var(--surface)] text-xs outline-none font-mono"
                >
                  {#each aiAvailableModels as mod}
                    <option value={mod}>{mod}</option>
                  {/each}
                </select>
              {:else}
                <button
                  type="button"
                  onclick={fetchAiModels}
                  disabled={aiFetchingModels}
                  class="text-[11px] text-primary hover:underline flex items-center gap-1"
                >
                  <span>{aiFetchingModels ? "正在获取模型..." : "🔄 刷新可用模型列表"}</span>
                </button>
              {/if}
            </div>

            <button
              type="button"
              onclick={() => executeAiGeneration()}
              disabled={aiGenerating}
              class="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {#if aiGenerating}
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                <span>AI 正在思考生成中...</span>
              {:else}
                <span>🚀 开始生成</span>
              {/if}
            </button>
          </div>

          <!-- Result Area -->
          {#if aiGenerating}
            <div class="p-6 rounded-2xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)]/20 text-center space-y-2 animate-pulse">
              <span class="text-2xl">✨</span>
              <p class="text-xs text-[var(--on-surface-variant)]">AI 正在根据您的上下文与指令进行创作，请稍候...</p>
            </div>
          {:else if aiResult}
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-[var(--on-surface)]">生成结果预览 (Markdown)</span>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    onclick={() => copyToClipboard(aiResult)}
                    class="px-2.5 py-1 rounded-lg border border-[var(--outline-variant)]/30 hover:bg-[var(--surface-container)] text-xs text-[var(--on-surface-variant)] transition-colors"
                  >
                    📋 复制内容
                  </button>
                  <button
                    type="button"
                    onclick={() => { aiResult = ""; }}
                    class="px-2 py-1 rounded-lg hover:bg-error/10 text-error text-xs transition-colors"
                  >
                    清空
                  </button>
                </div>
              </div>
              <div class="w-full p-4 rounded-2xl border border-primary/30 bg-[var(--surface-container-low)] max-h-[260px] overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap font-mono">
                {aiResult}
              </div>
            </div>
          {/if}
        </div>

        <!-- Footer -->
        <div class="pt-4 border-t border-[var(--outline-variant)]/20 flex items-center justify-between gap-3">
          <button onclick={() => (aiModalOpen = false)} class="px-5 py-2 rounded-full border border-[var(--outline-variant)]/40 text-xs font-medium hover:bg-[var(--surface-container)]">关闭</button>
          {#if aiResult}
            <button
              onclick={insertAiResultToEditor}
              class="px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 active:scale-98 transition-all flex items-center gap-1.5"
            >
              <span>📥 追加插入到当前编辑器正文</span>
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
