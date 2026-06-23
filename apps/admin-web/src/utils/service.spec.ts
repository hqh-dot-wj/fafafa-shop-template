import { describe, expect, it, vi } from 'vitest';
import { createServiceConfig, getServiceBaseURL, resolveApiResourceUrl, resolveWebSocketResourceUrl } from './service';

function asTestEnv(partial: Record<string, unknown>): Env.ImportMeta {
  return partial as unknown as Env.ImportMeta;
}

describe('createServiceConfig', () => {
  const baseEnv = {
    VITE_SERVICE_BASE_URL: 'http://localhost:3000',
    VITE_OTHER_SERVICE_BASE_URL: '',
    VITE_APP_BASE_API: '/api',
    VITE_APP_WEBSOCKET: 'N',
  };

  it('Given 基础环境变量, When createServiceConfig, Then 返回正确配置', () => {
    const config = createServiceConfig(asTestEnv(baseEnv));

    expect(config.baseURL).toBe('http://localhost:3000');
    expect(config.proxyPattern).toBe('/api');
    expect(config.ws).toBe(false);
    expect(config.other).toEqual([]);
  });

  it('Given VITE_APP_WEBSOCKET=Y, When createServiceConfig, Then ws=true', () => {
    const config = createServiceConfig(asTestEnv({ ...baseEnv, VITE_APP_WEBSOCKET: 'Y' }));
    expect(config.ws).toBe(true);
  });

  it('Given 有效 OTHER_SERVICE_BASE_URL, When createServiceConfig, Then 解析 other 配置', () => {
    const env = {
      ...baseEnv,
      VITE_OTHER_SERVICE_BASE_URL: '{ demo: "http://upload.example.com" }',
    };
    const config = createServiceConfig(asTestEnv(env));

    expect(config.other).toHaveLength(1);
    expect(config.other[0].key).toBe('demo');
    expect(config.other[0].baseURL).toBe('http://upload.example.com');
    expect(config.other[0].proxyPattern).toBe('/proxy-demo');
  });

  it('Given 无效 JSON OTHER_SERVICE_BASE_URL, When createServiceConfig, Then other 为空', () => {
    const env = { ...baseEnv, VITE_OTHER_SERVICE_BASE_URL: 'invalid json' };
    const config = createServiceConfig(asTestEnv(env));
    expect(config.other).toEqual([]);
  });
});

describe('getServiceBaseURL', () => {
  const baseEnv = {
    DEV: true,
    VITE_HTTP_PROXY: 'Y',
    VITE_SERVICE_BASE_URL: 'http://localhost:3000',
    VITE_OTHER_SERVICE_BASE_URL: '',
    VITE_APP_BASE_API: '/api',
    VITE_APP_WEBSOCKET: 'N',
  };

  it('Given 使用代理, When getServiceBaseURL, Then 返回代理路径', () => {
    const { baseURL } = getServiceBaseURL(asTestEnv(baseEnv), true);
    expect(baseURL).toBe('/api');
  });

  it('Given 不使用代理, When getServiceBaseURL, Then 返回完整 URL', () => {
    const { baseURL } = getServiceBaseURL(asTestEnv(baseEnv), false);
    expect(baseURL).toBe('http://localhost:3000/api');
  });

  it('Given 有 other 服务且使用代理, When getServiceBaseURL, Then other 使用代理路径', () => {
    const env = {
      ...baseEnv,
      VITE_OTHER_SERVICE_BASE_URL: '{ demo: "http://upload.example.com" }',
    };
    const { otherBaseURL } = getServiceBaseURL(asTestEnv(env), true);
    expect(otherBaseURL.demo).toBe('/proxy-demo');
  });

  it('Given 有 other 服务且不使用代理, When getServiceBaseURL, Then other 使用原始 URL', () => {
    const env = {
      ...baseEnv,
      VITE_OTHER_SERVICE_BASE_URL: '{ demo: "http://upload.example.com" }',
    };
    const { otherBaseURL } = getServiceBaseURL(asTestEnv(env), false);
    expect(otherBaseURL.demo).toBe('http://upload.example.com');
  });
});

describe('resolveApiResourceUrl', () => {
  const baseEnv = {
    DEV: true,
    VITE_HTTP_PROXY: 'N',
    VITE_SERVICE_BASE_URL: 'http://localhost:8080',
    VITE_APP_BASE_API: '/api',
  };

  it('Given 直连后端, When resolveApiResourceUrl, Then 返回完整 URL', () => {
    expect(resolveApiResourceUrl('/resource/sse', asTestEnv(baseEnv))).toBe('http://localhost:8080/api/resource/sse');
  });

  it('Given 使用代理, When resolveApiResourceUrl, Then 返回同源 /api 路径', () => {
    const env = { ...baseEnv, VITE_HTTP_PROXY: 'Y' };
    const origin = 'http://localhost:9527';
    vi.stubGlobal('window', { location: { origin } });
    expect(resolveApiResourceUrl('/resource/sse', asTestEnv(env))).toBe(`${origin}/api/resource/sse`);
    vi.unstubAllGlobals();
  });
});

describe('resolveWebSocketResourceUrl', () => {
  it('Given 直连后端, When resolveWebSocketResourceUrl, Then http 转为 ws', () => {
    const env = {
      DEV: true,
      VITE_HTTP_PROXY: 'N',
      VITE_SERVICE_BASE_URL: 'http://localhost:8080',
      VITE_APP_BASE_API: '/api',
    };
    expect(resolveWebSocketResourceUrl('/resource/websocket', asTestEnv(env))).toBe(
      'ws://localhost:8080/api/resource/websocket',
    );
  });
});
