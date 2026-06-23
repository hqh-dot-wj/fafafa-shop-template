/**
 * Vitest 全局初始化：补齐 uni 等运行时 API 的最小桩，避免 Pinia store 在 Node 中读 undefined
 */
import { vi } from 'vitest';
import { resetRuntimePopupOrchestratorForTest } from '@/store/popup-orchestrator';

/** 避免 @/utils → pages.json 经 Vite JSON 插件解析（含注释的 JSON 会失败） */
vi.mock('@/pages.json', () => ({
  pages: [{ path: 'pages/index/index', type: 'home', style: {} }],
  subPackages: [],
}));

const storage = new Map<string, unknown>();

const uniMock = {
  getStorageSync: vi.fn((key: string) => storage.get(key)),
  setStorageSync: vi.fn((key: string, value: unknown) => {
    storage.set(key, value);
  }),
  removeStorageSync: vi.fn((key: string) => {
    storage.delete(key);
  }),
  showToast: vi.fn(),
  showModal: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  $emit: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  redirectTo: vi.fn(),
  getLocation: vi.fn(),
  openSetting: vi.fn(),
};

vi.stubGlobal('uni', uniMock);

export function clearTestStorage(): void {
  storage.clear();
  resetRuntimePopupOrchestratorForTest();
}
