import JSEncrypt from 'jsencrypt';
import { getServiceBaseURL } from './service';
// 密钥对生成 http://web.chacuo.net/netrsakeypair

// fallback TTL：后端 /auth/publicKey 故障时，用 env 公钥兜底 30s 再尝试拉运行时公钥。
// 不无限缓存 fallback 是为了保留"后端恢复后自动切回运行时公钥"的能力；
// 不每次重试是为了避免故障窗口期内每次加密都对已知失败的 endpoint 多打一次往返。
const FALLBACK_PUBLIC_KEY_TTL_MS = 30_000;

const envPublicKey = import.meta.env.VITE_APP_RSA_PUBLIC_KEY;
let cachedPublicKey: string | null = null;
// cachedPublicKey 何时过期；Infinity 表示"运行时公钥已成功获取，不再过期"。
let cachedPublicKeyExpiry = 0;
let publicKeyRequest: Promise<string> | null = null;

function getFallbackPublicKey() {
  if (!envPublicKey) {
    throw new Error('RSA public key is not configured');
  }

  return envPublicKey;
}

// fallback 命中时短 TTL 缓存 env 公钥，避免故障期每次加密都重发 /auth/publicKey。
function cacheFallbackPublicKey(): string {
  const key = getFallbackPublicKey();
  cachedPublicKey = key;
  cachedPublicKeyExpiry = Date.now() + FALLBACK_PUBLIC_KEY_TTL_MS;
  return key;
}

function getRuntimePublicKeyUrl() {
  const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
  const { baseURL } = getServiceBaseURL(import.meta.env, isHttpProxy);

  return `${baseURL}/auth/publicKey`;
}

function extractPublicKey(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as { data?: unknown; publicKey?: unknown };
  if (typeof record.publicKey === 'string' && record.publicKey.trim()) {
    return record.publicKey;
  }

  if (record.data && typeof record.data === 'object') {
    const data = record.data as { publicKey?: unknown };

    if (typeof data.publicKey === 'string' && data.publicKey.trim()) {
      return data.publicKey;
    }
  }

  return null;
}

async function fetchRuntimePublicKey() {
  if (typeof fetch !== 'function') {
    return cacheFallbackPublicKey();
  }

  try {
    const response = await fetch(getRuntimePublicKeyUrl(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return cacheFallbackPublicKey();
    }

    const runtimePublicKey = extractPublicKey(await response.json());
    if (!runtimePublicKey) {
      return cacheFallbackPublicKey();
    }

    cachedPublicKey = runtimePublicKey;
    // 运行时公钥成功获取后永不过期（页面生命周期内）；后续无需重试。
    cachedPublicKeyExpiry = Number.POSITIVE_INFINITY;
    return runtimePublicKey;
  } catch {
    return cacheFallbackPublicKey();
  }
}

export function resetEncryptionPublicKeyCacheForTest() {
  cachedPublicKey = null;
  cachedPublicKeyExpiry = 0;
  publicKeyRequest = null;
}

export async function getEncryptionPublicKey() {
  // fallback 命中需要 TTL 守门，过期则重新尝试 runtime key；运行时公钥的 expiry 是 Infinity，命中即返回。
  if (cachedPublicKey && Date.now() < cachedPublicKeyExpiry) {
    return cachedPublicKey;
  }

  if (!publicKeyRequest) {
    publicKeyRequest = fetchRuntimePublicKey().finally(() => {
      publicKeyRequest = null;
    });
  }

  return publicKeyRequest;
}

/**
 * RSA 加密
 * 使用公钥加密数据（用于加密 AES 密钥发送给后端）
 *
 * @param txt 待加密的明文
 * @returns 加密后的 Base64 字符串
 */
export const encrypt = async (txt: string) => {
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(await getEncryptionPublicKey()); // 设置公钥

  const encrypted = encryptor.encrypt(txt); // 对数据进行加密
  if (!encrypted) {
    throw new Error('RSA encrypt failed');
  }

  return encrypted;
};
