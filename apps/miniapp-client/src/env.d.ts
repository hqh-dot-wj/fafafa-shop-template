/// <reference types="vite/client" />
/// <reference types="vite-svg-loader" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  /** 网站标题，应用名称 */
  readonly VITE_APP_TITLE: string;
  /** 服务端口号 */
  readonly VITE_SERVER_PORT: string;
  /** 后台接口地址 */
  readonly VITE_SERVER_BASEURL: string;
  /** H5是否需要代理 */
  readonly VITE_APP_PROXY_ENABLE: 'true' | 'false';
  /** H5是否需要代理，需要的话有个前缀 */
  readonly VITE_APP_PROXY_PREFIX: string;
  /** 后端是否有统一前缀 /api */
  readonly VITE_SERVER_HAS_API_PREFIX: 'true' | 'false';
  /** 认证模式，'single' | 'double' ==> 单token | 双token */
  readonly VITE_AUTH_MODE: 'single' | 'double';
  /** 是否清除console */
  readonly VITE_DELETE_CONSOLE: string;
  /** 首页营销场景灰度开关：Y/N */
  readonly VITE_MARKETING_HOME_SCENE_GRAY?: 'Y' | 'N';
  /** H5 本地开发：跳过定位，模拟超级租户（须 DEV + H5） */
  readonly VITE_DEV_MOCK_LOCATION?: 'true' | 'false';
  /** 模拟租户 ID，默认 000000 */
  readonly VITE_DEV_MOCK_TENANT_ID?: string;
  /** 模拟租户展示名 */
  readonly VITE_DEV_MOCK_COMPANY_NAME?: string;
  /** 模拟纬度 */
  readonly VITE_DEV_MOCK_LAT?: string;
  /** 模拟经度 */
  readonly VITE_DEV_MOCK_LNG?: string;
  // 更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __VITE_APP_PROXY__: 'true' | 'false';
