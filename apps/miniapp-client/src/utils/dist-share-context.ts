/**
 * 分销分享上下文工具
 * 负责 sid/shareUserId 的解析与本地缓存，支持 query 与 scene 双入口。
 */

const SHARE_SID_STORAGE_KEY = 'dist_share_sid';
const SHARE_SID_EXPIRE_KEY = 'dist_share_sid_expire';
const DEFAULT_SHARE_SID_EXPIRE_MS = 24 * 60 * 60 * 1000;

export interface DistShareContext {
  sid?: string;
  shareUserId?: string;
  targetPath?: string;
  source: 'query' | 'scene' | 'none';
}

function readString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseKeyValue(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!input) return result;
  const normalized = input.startsWith('?') ? input.slice(1) : input;
  for (const item of normalized.split('&')) {
    if (!item) continue;
    const [rawKey = '', rawValue = ''] = item.split('=');
    const key = safeDecode(rawKey);
    const value = safeDecode(rawValue);
    if (key) result[key] = value;
  }
  return result;
}

function fromQuery(query: Record<string, unknown>): DistShareContext {
  const sid = readString(query.sid) || readString(query.shareSid) || readString(query.s);
  const shareUserId = readString(query.shareUserId) || readString(query.referrerId) || readString(query.u);
  const targetPath = readString(query.targetPath) || readString(query.redirectPath) || readString(query.target);

  if (sid || shareUserId) {
    const context: DistShareContext = { source: 'query' };
    if (sid) context.sid = sid;
    if (shareUserId) context.shareUserId = shareUserId;
    if (targetPath) context.targetPath = targetPath;
    return context;
  }

  return { source: 'none' };
}

function fromScene(query: Record<string, unknown>): DistShareContext {
  const sceneRaw = readString(query.scene);
  if (!sceneRaw) return { source: 'none' };

  const parsed = parseKeyValue(safeDecode(sceneRaw));
  const sid = readString(parsed.sid) || readString(parsed.shareSid) || readString(parsed.s);
  const shareUserId = readString(parsed.shareUserId) || readString(parsed.referrerId) || readString(parsed.u);
  const targetPath = readString(parsed.targetPath) || readString(parsed.redirectPath) || readString(parsed.target);

  if (sid || shareUserId) {
    const context: DistShareContext = { source: 'scene' };
    if (sid) context.sid = sid;
    if (shareUserId) context.shareUserId = shareUserId;
    if (targetPath) context.targetPath = targetPath;
    return context;
  }

  return { source: 'none' };
}

export function extractDistShareContext(
  options?: { query?: Record<string, unknown> } | Record<string, unknown>,
): DistShareContext {
  const query = (options && 'query' in options ? options.query : options) as Record<string, unknown> | undefined;
  if (!query) return { source: 'none' };

  const queryResult = fromQuery(query);
  if (queryResult.sid || queryResult.shareUserId) return queryResult;

  return fromScene(query);
}

export function saveShareSid(sid: string, expireMs: number = DEFAULT_SHARE_SID_EXPIRE_MS) {
  if (!sid) return;
  const expireAt = Date.now() + expireMs;
  uni.setStorageSync(SHARE_SID_STORAGE_KEY, sid);
  uni.setStorageSync(SHARE_SID_EXPIRE_KEY, expireAt);
}

export function getShareSid(): string | null {
  const sid = readString(uni.getStorageSync(SHARE_SID_STORAGE_KEY));
  const expireAt = Number(uni.getStorageSync(SHARE_SID_EXPIRE_KEY) || 0);
  if (!sid || !expireAt || Date.now() >= expireAt) {
    clearShareSid();
    return null;
  }
  return sid;
}

export function clearShareSid() {
  uni.removeStorageSync(SHARE_SID_STORAGE_KEY);
  uni.removeStorageSync(SHARE_SID_EXPIRE_KEY);
}

export function buildDistEntryPath(sid: string, targetPath?: string) {
  if (!sid) return '/pages/index/index';
  const encodedTarget = targetPath ? encodeURIComponent(targetPath) : '';
  return encodedTarget
    ? `/pages/distribution/entry?sid=${encodeURIComponent(sid)}&targetPath=${encodedTarget}`
    : `/pages/distribution/entry?sid=${encodeURIComponent(sid)}`;
}

const TABBAR_PATHS = new Set(['/pages/index/index', '/pages/category/category', '/pages/cart/cart', '/pages/me/me']);

export function navigateByPath(path: string, fallback: string = '/pages/index/index') {
  const target = readString(path) || fallback;
  if (TABBAR_PATHS.has(target)) {
    uni.switchTab({ url: target });
    return;
  }
  uni.redirectTo({ url: target });
}
