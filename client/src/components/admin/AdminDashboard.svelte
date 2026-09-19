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
    uploadFile,
    setToken,
  } from "../../services/api";
  import { SUPPORTED_LANGUAGES, getAdminText, type AdminLang, type LanguageOption } from "../../i18n/adminI18n";

  type TabType = "overview" | "posts" | "albums" | "moments" | "pages" | "friends" | "users" | "settings";

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
    photosText: "", // JSON or newline separated URLs
  });

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
    content: "",
    status: "published",
  });

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
    announcementEnable: true,
    announcementTitle: "",
    announcementContent: "The only way to do great work is to love what you do",
    announcementLinkText: "GitHub",
    announcementLinkUrl: "https://github.com/yiran168/Shirine",
    musicEnable: true,
    musicProvider: "mixed",
    musicVolume: 0.7,
    musicMetingServer: "netease",
    musicMetingId: "14164869977",
    musicTracks: [] as any[],
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
  });

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
        const res = await friendsApi.list();
        if (res.success) friends = res.data || [];
      } else if (tab === "users") {
        const res = await adminApi.getUsers({ pageSize: 100 });
        if (res.success) users = res.data || [];
      } else if (tab === "settings") {
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
            announcementEnable: a.enable ?? siteConfigState.announcementEnable,
            announcementTitle: a.title ?? siteConfigState.announcementTitle,
            announcementContent: a.content ?? siteConfigState.announcementContent,
            announcementLinkText: a.link?.text ?? siteConfigState.announcementLinkText,
            announcementLinkUrl: a.link?.url ?? siteConfigState.announcementLinkUrl,
            musicEnable: m.enable ?? siteConfigState.musicEnable,
            musicProvider: m.provider ?? siteConfigState.musicProvider,
            musicVolume: m.defaultVolume ?? siteConfigState.musicVolume,
            musicMetingServer: m.meting?.server ?? siteConfigState.musicMetingServer,
            musicMetingId: m.meting?.id ?? siteConfigState.musicMetingId,
            musicTracks: Array.isArray(m.tracks) ? m.tracks : siteConfigState.musicTracks,
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
      photosText: "",
    };
    albumModalOpen = true;
  }

  async function openEditAlbumModal(album: any) {
    editingAlbum = album;
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
      content: "",
      status: "published",
    };
    pageModalOpen = true;
  }

  function openEditPageModal(page: any) {
    editingPage = page;
    pageForm = {
      id: page.id,
      title: page.title || "",
      slug: page.slug || "",
      content: page.content || "",
      status: page.draft ? "draft" : (page.status || "published"),
    };
    pageModalOpen = true;
  }

  async function savePage() {
    if (!pageForm.title.trim()) return showMessage("请输入页面标题", true);
    if (!pageForm.slug.trim()) return showMessage("请输入页面路径 slug (例如: about)", true);
    const isDraft = pageForm.status === "draft";
    const payload = {
      title: pageForm.title.trim(),
      slug: pageForm.slug.trim().toLowerCase(),
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
    <div class="fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl bg-error text-on-error shadow-2xl flex items-center gap-3 animate-fade-in">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      <span class="text-sm font-medium">{errorMsg}</span>
    </div>
  {/if}
  {#if successMsg}
    <div class="fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl bg-emerald-600 text-white shadow-2xl flex items-center gap-3 animate-fade-in">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
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
          <img src={authStore.user.avatar || "/assets/avatars/avatar-1.webp"} alt="Admin" class="w-8 h-8 rounded-full ring-2 ring-primary/20 object-cover" />
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
              <label class="text-xs font-medium block mb-1.5">用户名 / 邮箱</label>
              <input
                type="text"
                bind:value={loginUsername}
                placeholder="请输入管理员账号"
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
              <p class="text-xs text-[var(--on-surface-variant)] mt-1">支持实时 Markdown 编辑、置顶、及 3 级权限限制（公开 / 需登录 / 积分解锁）</p>
            </div>
            <button
              onclick={openNewPostModal}
              class="px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-semibold shadow hover:brightness-105 flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              <span>撰写新文章</span>
            </button>
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
            <textarea
              bind:value={momentContent}
              rows="3"
              placeholder="分享今天的灵感与日常..."
              class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none resize-none"
            ></textarea>
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
                  <span>添加图片</span>
                  <input type="file" accept="image/*" class="hidden" onchange={(e) => handleFileUpload(e, "momentPhoto")} />
                </label>
              </div>
              <button
                onclick={publishMoment}
                class="px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105 transition-all"
              >
                发布动态
              </button>
            </div>
            {#if momentPhotos.length > 0}
              <div class="flex gap-2 mt-3 overflow-x-auto">
                {#each momentPhotos as photo}
                  <img src={photo} alt="Upload" class="w-14 h-14 rounded-xl object-cover ring-1 ring-primary/30" />
                {/each}
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
                      {page.title}
                    </td>
                    <td class="px-4 py-4 text-xs font-mono text-primary">
                      <a href={`/pages/${page.slug}`} target="_blank" class="hover:underline">/pages/{page.slug}</a>
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
                      <button onclick={() => openEditPageModal(page)} class="text-primary font-medium text-xs hover:underline">编辑</button>
                      <button onclick={() => deletePage(page.id)} class="text-error font-medium text-xs hover:underline">删除</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
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
                      <img src={user.avatar || "/assets/avatars/avatar-1.webp"} alt={user.username} class="w-8 h-8 rounded-full object-cover" />
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
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
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
                独立控制访客端与管理员后台看板娘的显示与沙箱挂载。
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

              <div>
                <label class="text-xs font-semibold block mb-1.5">Live2D 模型配置文件路径 (Model JSON URL / Path)</label>
                <input
                  type="text"
                  bind:value={systemConfigState.live2dModel}
                  placeholder="/pio/models/NOIR/noir.model3.json"
                  class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
                />
                <p class="text-[11px] text-[var(--on-surface-variant)] mt-1.5">
                  默认内置看板娘模型路径为 <code>/pio/models/NOIR/noir.model3.json</code>，亦支持配置其他自建静态路径或合法外部 CDN 链接。
                </p>
              </div>
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
                    <label class="text-xs font-semibold block mb-1.5">桌面端横幅图片 URL（支持多图，每行一张）</label>
                    <textarea
                      bind:value={siteConfigState.bannerDesktop}
                      rows="3"
                      placeholder="/assets/images/banner/desktop/1.webp 或 https://...&#10;支持多图，每行一张"
                      class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono"
                    ></textarea>
                  </div>
                  <div>
                    <label class="text-xs font-semibold block mb-1.5">移动端横幅图片 URL（支持多图，每行一张）</label>
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
                  <label class="text-xs font-semibold block mb-1.5">头像图片 URL</label>
                  <input
                    type="text"
                    bind:value={siteConfigState.avatar}
                    class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                  />
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
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="text-xs font-semibold block mb-1.5">跳转链接按钮文字</label>
                      <input
                        type="text"
                        bind:value={siteConfigState.announcementLinkText}
                        placeholder="了解更多"
                        class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label class="text-xs font-semibold block mb-1.5">跳转链接 URL</label>
                      <input
                        type="text"
                        bind:value={siteConfigState.announcementLinkUrl}
                        placeholder="https://..."
                        class="w-full px-4 py-2.5 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none"
                      />
                    </div>
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
                              <input
                                type="text"
                                bind:value={track.source}
                                placeholder="音频 URL (/assets/music/... 或 https://...)"
                                class="px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface)] text-xs outline-none font-mono"
                              />
                              <input
                                type="text"
                                bind:value={track.cover}
                                placeholder="封面图片 URL"
                                class="px-3 py-1.5 rounded-lg border border-[var(--outline-variant)]/20 bg-[var(--surface)] text-xs outline-none font-mono"
                              />
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
        {/if}
      </main>
    </div>
  {/if}

  <!-- Post Editor Modal -->
  {#if postModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
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
              <label class="text-xs font-semibold block mb-1">分类 Category</label>
              <input type="text" bind:value={postForm.category} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1">标签 (逗号分隔)</label>
              <input type="text" bind:value={postForm.tags} placeholder="Shirine, Anime, Tech" class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
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
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">Markdown 正文内容 *</label>
            <textarea
              bind:value={postForm.content}
              rows="12"
              placeholder="# 欢迎来到 Shirine 博文..."
              class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] font-mono text-sm focus:border-primary outline-none"
            ></textarea>
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
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
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
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold block mb-1">相册权限类型</label>
              <select bind:value={albumForm.permissionType} class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none">
                <option value="public">完全公开</option>
                <option value="login_required">登录可见</option>
                <option value="points_required">积分解锁</option>
              </select>
            </div>
            {#if albumForm.permissionType === 'points_required'}
              <div>
                <label class="text-xs font-semibold block mb-1">所需解锁积分</label>
                <input type="number" bind:value={albumForm.requiredPoints} min="1" class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
              </div>
            {/if}
          </div>

          <div>
            <label class="text-xs font-semibold block mb-1">照片地址列表 (每行一张图片 URL)</label>
            <textarea
              bind:value={albumForm.photosText}
              rows="6"
              placeholder="https://example.com/photo1.webp&#10;https://example.com/photo2.webp"
              class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] font-mono text-sm focus:border-primary outline-none"
            ></textarea>
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
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[var(--outline-variant)]/20">
          <h2 class="text-xl font-bold">编辑动态日记</h2>
          <button onclick={() => (momentModalOpen = false)} class="p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          <div>
            <label class="text-xs font-semibold block mb-1">动态正文内容 *</label>
            <textarea
              bind:value={editMomentForm.content}
              rows="4"
              class="w-full p-3.5 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm focus:border-primary outline-none resize-none"
            ></textarea>
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
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs font-semibold">附带图片列表 ({editMomentForm.photos.length} 张)</label>
              <label class="text-xs px-3 py-1.5 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] text-xs font-medium cursor-pointer flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <span>上传新图片</span>
                <input type="file" accept="image/*" class="hidden" onchange={(e) => handleFileUpload(e, "editMomentPhoto")} />
              </label>
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
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div class="flex items-center justify-between pb-4 border-b border-[var(--outline-variant)]/20">
          <h2 class="text-xl font-bold">{editingPage ? "编辑独立页面" : "新建独立页面"}</h2>
          <button onclick={() => (pageModalOpen = false)} class="p-1 rounded-lg hover:bg-[var(--surface-container)] text-[var(--on-surface-variant)]">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold block mb-1">页面标题 *</label>
              <input type="text" bind:value={pageForm.title} placeholder="例如：关于我们" class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none" />
            </div>
            <div>
              <label class="text-xs font-semibold block mb-1">访问路径 (Slug) *</label>
              <input type="text" bind:value={pageForm.slug} placeholder="例如：about" class="w-full px-3.5 py-2 rounded-xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] text-sm outline-none font-mono" />
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
            <label class="text-xs font-semibold block mb-1">Markdown 内容</label>
            <textarea
              bind:value={pageForm.content}
              rows="12"
              placeholder="在此输入页面正文 Markdown 内容..."
              class="w-full p-4 rounded-2xl border border-[var(--outline-variant)]/30 bg-[var(--surface-container-low)] font-mono text-sm focus:border-primary outline-none"
            ></textarea>
          </div>
        </div>

        <div class="pt-4 border-t border-[var(--outline-variant)]/20 flex items-center justify-end gap-3">
          <button onclick={() => (pageModalOpen = false)} class="px-5 py-2 rounded-full border border-[var(--outline-variant)]/40 text-xs font-medium hover:bg-[var(--surface-container)]">取消</button>
          <button onclick={savePage} class="px-6 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold shadow hover:brightness-105">保存页面</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Adjust Points Modal -->
  {#if userPointsModalOpen && targetUser}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
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
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div class="bg-[var(--surface)] border border-[var(--outline-variant)]/40 rounded-3xl p-6 w-full max-w-md shadow-2xl">
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
</div>
