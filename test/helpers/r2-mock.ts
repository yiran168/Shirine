export interface MockR2ObjectMetadata {
  contentType?: string;
  contentDisposition?: string;
  cacheControl?: string;
  customMetadata?: Record<string, string>;
}

export class MockR2ObjectBody {
  public key: string;
  public size: number;
  public httpEtag: string;
  public uploaded: Date;
  public customMetadata: Record<string, string>;
  public httpMetadata?: MockR2ObjectMetadata;
  private data: Uint8Array;

  constructor(
    key: string,
    data: Uint8Array,
    metadata?: MockR2ObjectMetadata
  ) {
    this.key = key;
    this.data = data;
    this.size = data.byteLength;
    this.httpEtag = `"${crypto.randomUUID()}"`;
    this.uploaded = new Date();
    this.customMetadata = metadata?.customMetadata || {};
    this.httpMetadata = metadata || {};
  }

  get body(): ReadableStream {
    const data = this.data;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.data.buffer.slice(
      this.data.byteOffset,
      this.data.byteOffset + this.data.byteLength
    );
  }

  async text(): Promise<string> {
    return new TextDecoder().decode(this.data);
  }

  writeHttpMetadata(headers: Headers): void {
    if (this.httpMetadata?.contentType) {
      headers.set("content-type", this.httpMetadata.contentType);
    }
    if (this.httpMetadata?.contentDisposition) {
      headers.set("content-disposition", this.httpMetadata.contentDisposition);
    }
    if (this.httpMetadata?.cacheControl) {
      headers.set("cache-control", this.httpMetadata.cacheControl);
    }
  }
}

export class MockR2Bucket {
  private storage = new Map<string, { data: Uint8Array; metadata?: MockR2ObjectMetadata }>();

  async get(key: string): Promise<MockR2ObjectBody | null> {
    const item = this.storage.get(key);
    if (!item) return null;
    return new MockR2ObjectBody(key, item.data, item.metadata);
  }

  async put(
    key: string,
    value: ArrayBuffer | Uint8Array | string | ReadableStream,
    options?: { httpMetadata?: MockR2ObjectMetadata; customMetadata?: Record<string, string> }
  ): Promise<MockR2ObjectBody> {
    let bytes: Uint8Array;
    if (typeof value === "string") {
      bytes = new TextEncoder().encode(value);
    } else if (value instanceof Uint8Array) {
      bytes = value;
    } else if (value instanceof ArrayBuffer) {
      bytes = new Uint8Array(value);
    } else if (value && typeof (value as any).getReader === "function") {
      const reader = (value as ReadableStream).getReader();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const res = await reader.read();
        if (res.done) done = true;
        else if (res.value) chunks.push(res.value);
      }
      const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
      bytes = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
    } else {
      bytes = new Uint8Array(0);
    }

    const metadata: MockR2ObjectMetadata = {
      ...(options?.httpMetadata || {}),
      customMetadata: options?.customMetadata,
    };

    this.storage.set(key, { data: bytes, metadata });
    return new MockR2ObjectBody(key, bytes, metadata);
  }

  async delete(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      this.storage.delete(k);
    }
  }

  async head(key: string): Promise<MockR2ObjectBody | null> {
    return this.get(key);
  }

  async list(options?: { limit?: number; prefix?: string; cursor?: string }): Promise<{
    objects: MockR2ObjectBody[];
    truncated: boolean;
    cursor?: string;
  }> {
    const prefix = options?.prefix || "";
    const limit = options?.limit || 1000;
    const objects: MockR2ObjectBody[] = [];
    for (const [key, item] of this.storage.entries()) {
      if (key.startsWith(prefix)) {
        objects.push(new MockR2ObjectBody(key, item.data, item.metadata));
        if (objects.length >= limit) break;
      }
    }
    return {
      objects,
      truncated: false,
    };
  }

  clear(): void {
    this.storage.clear();
  }
}

export function createMockR2Bucket(): MockR2Bucket {
  return new MockR2Bucket();
}
