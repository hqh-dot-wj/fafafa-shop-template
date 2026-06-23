import { Injectable } from '@nestjs/common';
import OSS from 'ali-oss';
import { AppConfigService } from 'src/config/app-config.service';

/**
 * 阿里云 OSS 封装（AccessKey 服务端上传）
 */
@Injectable()
export class OssStorageService {
  private client: OSS | undefined;

  constructor(private readonly config: AppConfigService) {}

  /**
   * RAM 密钥、Bucket、地域、Endpoint、对外访问根 URL 均已配置时为 true
   */
  isConfigured(): boolean {
    const o = this.config.oss;
    return !!(
      o.accessKeyId &&
      o.accessKeySecret &&
      o.region &&
      o.bucket &&
      o.endpoint &&
      o.publicBaseUrl
    );
  }

  /**
   * 上传对象
   *
   * @param objectKey - 对象键（可含前缀）
   * @param buffer - 文件内容
   * @param contentType - Content-Type
   */
  async putObject(objectKey: string, buffer: Buffer, contentType: string): Promise<void> {
    const client = this.getClient();
    await client.put(objectKey, buffer, {
      headers: { 'Content-Type': contentType },
    });
  }

  /**
   * 按库中记录的公网 URL 删除对象（URL 须以当前 OSS_PUBLIC_BASE_URL 为前缀）
   */
  async deleteObjectByPublicUrl(fileUrl: string): Promise<void> {
    const key = this.parseObjectKeyFromPublicUrl(fileUrl);
    if (!key) {
      return;
    }
    const client = this.getClient();
    await client.delete(key);
  }

  /**
   * 将相对路径（如 2026/04/13/uuid.png）转为带前缀的对象键
   */
  buildObjectKey(relativePath: string): string {
    const prefix = this.normalizePrefix(this.config.oss.prefix);
    const rel = relativePath.replace(/^\/+/u, '');
    return prefix ? `${prefix}${rel}` : rel;
  }

  /**
   * 对象键拼成浏览器可访问的完整 URL（使用 OSS_PUBLIC_BASE_URL）
   */
  buildPublicUrl(objectKey: string): string {
    const base = this.config.oss.publicBaseUrl.replace(/\/+$/u, '');
    const key = objectKey.replace(/^\/+/u, '');
    return `${base}/${key}`;
  }

  /**
   * 从公网 URL 解析对象键（须与 OSS_PUBLIC_BASE_URL 一致）
   */
  parseObjectKeyFromPublicUrl(fileUrl: string): string | null {
    const base = this.config.oss.publicBaseUrl.replace(/\/+$/u, '');
    if (!fileUrl.startsWith(base)) {
      return null;
    }
    const rest = fileUrl.slice(base.length).replace(/^\/+/u, '');
    return rest.length > 0 ? rest : null;
  }

  /**
   * 生成私有读对象的短时 GET 签名 URL（供管理端列表缩略图、预览等）
   */
  signGetObjectUrl(objectKey: string, expiresSeconds: number): string | null {
    if (!this.isConfigured()) {
      return null;
    }
    try {
      const client = this.getClient();
      return client.signatureUrl(objectKey, { expires: expiresSeconds });
    } catch {
      return null;
    }
  }

  private getClient(): OSS {
    if (this.client) {
      return this.client;
    }
    const o = this.config.oss;
    const ep = o.endpoint.trim();
    const endpoint = ep.startsWith('http://') || ep.startsWith('https://') ? ep : `https://${ep}`;
    this.client = new OSS({
      region: o.region,
      accessKeyId: o.accessKeyId,
      accessKeySecret: o.accessKeySecret,
      bucket: o.bucket,
      endpoint,
    });
    return this.client;
  }

  private normalizePrefix(prefix: string): string {
    const t = (prefix || '').trim().replace(/^\/+/u, '');
    if (!t) {
      return '';
    }
    return t.endsWith('/') ? t : `${t}/`;
  }
}
