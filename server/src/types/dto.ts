/**
 * Shirine Shared DTOs (Data Transfer Objects)
 * Defines unified contracts between server and client for all API endpoints.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
  [key: string]: any; // Allows backward compatibility (e.g. post, album, stats, config)
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// User DTO
export type UserRole = "superadmin" | "admin" | "user";
export type UserStatus = "active" | "banned";

export interface UserDto {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  role: UserRole;
  points: number;
  status: UserStatus;
  lastCheckinDate?: string | null;
  checkinStreak: number;
  createdAt: number | Date;
}

// Post DTOs
export type PermissionType = "public" | "login_required" | "points_required" | "password";

export interface PostListDto {
  id: number;
  slug: string;
  alias?: string | null;
  permalink?: string | null;
  title: string;
  description: string;
  image: string;
  category: string;
  tags: string[];
  pinned: boolean;
  draft: boolean;
  permissionType: PermissionType;
  requiredPoints: number;
  isUnlocked: boolean;
  isLocked?: boolean;
  requiresPassword?: boolean;
  hideHomeContent?: boolean;
  isPurchased?: boolean;
  isAuthenticated?: boolean;
  lockReason?: string;
  createdAt: number | Date;
  updatedAt: number | Date;
}

export interface PostDetailDto extends PostListDto {
  content: string | null;
  commentEnabled: boolean;
  encrypted: boolean;
  password?: string;
  passwordHint?: string;
  userPoints?: number;
  author?: {
    id: number;
    username: string;
    nickname: string;
    avatar: string;
  } | null;
  prev?: {
    id: number;
    slug: string;
    title: string;
  } | null;
  next?: {
    id: number;
    slug: string;
    title: string;
  } | null;
}

// Album DTOs
export interface AlbumPhotoDto {
  id: number;
  url: string;
  alt: string;
  title?: string;
  description?: string;
  tags?: string[];
  sortOrder?: number;
}

export interface AlbumIndexDto {
  id: number;
  slug?: string | null;
  title: string;
  description: string;
  cover: string;
  photoCount: number;
  count?: number; // legacy alias
  permissionType: PermissionType;
  requiredPoints: number;
  isUnlocked: boolean;
  protected?: boolean;
  requiresPassword?: boolean;
  passwordHint?: string;
  draft: boolean;
  layout?: "grid" | "masonry";
  columns?: number;
  tags?: string[];
  date?: string;
  createdAt: number | Date;
  updatedAt: number | Date;
}

export interface AlbumDetailDto extends AlbumIndexDto {
  lockReason?: string;
  userPoints?: number;
  photos: AlbumPhotoDto[];
}

// Moment DTOs
export interface MomentImageDto {
  src: string;
  alt: string;
  thumbnailSrc?: string;
  thumbnailSrcset?: string;
}

export interface MomentDto {
  id: number;
  content: string;
  location: string;
  mood: string;
  images: MomentImageDto[];
  tags: string[];
  pinned: boolean;
  draft: boolean;
  createdAt: number | Date;
  updatedAt: number | Date;
}

// Friend DTOs
export interface FriendDto {
  id: number;
  name: string;
  desc: string;
  avatar: string;
  url: string;
  accepted: number; // 1 = approved, 0 = pending
  status?: string; // "approved" | "pending"
  sortOrder: number;
  createdAt: number | Date;
  updatedAt: number | Date;
}

// Custom Page DTO
export interface PageDto {
  id: number;
  slug: string;
  title: string;
  content: string;
  draft: boolean;
  createdAt: number | Date;
  updatedAt: number | Date;
}

// Admin Stats DTO
export interface AdminStatsDto {
  posts: number;
  users: number;
  albums: number;
  moments: number;
  totalPoints: number;
  checkinToday: number;
  totalPosts?: number;
  totalUsers?: number;
  totalAlbums?: number;
  totalMoments?: number;
}
