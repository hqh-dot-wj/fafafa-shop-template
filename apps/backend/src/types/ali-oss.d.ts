declare module 'ali-oss' {
  import type { Readable } from 'stream';

  interface PutObjectOptions {
    headers?: Record<string, string>;
  }

  class AliOssClient {
    constructor(options: Record<string, string | undefined>);
    put(name: string, file: Buffer | Readable, options?: PutObjectOptions): Promise<{ url: string }>;
    delete(name: string): Promise<unknown>;
    /** 生成带过期时间的 GET 签名 URL（私有 Bucket 供浏览器拉流/缩略图） */
    signatureUrl(name: string, options?: { expires?: number }): string;
  }

  export default AliOssClient;
}
