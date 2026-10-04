export interface MediaFile {
  key: string;
  size: number;
  uploaded: string;
  url: string;
  originalName?: string;
  fallbackUrl?: string;
  isPreset?: boolean;
  httpMetadata?: { contentType?: string };
}

export function mergeMediaFiles(uploads: MediaFile[], presets: MediaFile[]): MediaFile[] {
  const unique = new Map(uploads.map(file => [file.key, { ...file, isPreset: false }]));
  const sorted = [...unique.values()].sort((a, b) =>
    (Date.parse(b.uploaded) || 0) - (Date.parse(a.uploaded) || 0) || a.key.localeCompare(b.key));
  return [...sorted, ...presets.filter(file => !unique.has(file.key)).map(file => ({
    ...file, isPreset: true, url: file.fallbackUrl || file.url,
  }))];
}

/** R2 lists by key, not upload date. Follow every cursor before declaring the catalog complete. */
export async function collectMediaPages(
  list: (cursor?: string, signal?: AbortSignal) => Promise<{ success: boolean; objects?: MediaFile[]; cursor?: string | null; error?: string }>,
  publish: (files: MediaFile[], complete: boolean) => void,
  signal: AbortSignal,
): Promise<void> {
  const files = new Map<string, MediaFile>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const result = await list(cursor, signal);
    if (signal.aborted) return;
    if (!result.success || !Array.isArray(result.objects)) throw new Error(result.error || "媒体列表加载失败");
    for (const file of result.objects) files.set(file.key, file);
    const next = result.cursor || undefined;
    if (next && cursors.has(next)) throw new Error("媒体分页返回重复游标，请刷新重试");
    publish([...files.values()], !next);
    if (next) cursors.add(next);
    cursor = next;
  } while (cursor && !signal.aborted);
}
