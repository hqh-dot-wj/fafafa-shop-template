/**
 * Vitest 单元/组件测试全局 setup
 * 全局 mock 常用依赖，避免每个测试文件重复配置
 */
import { vi } from 'vitest';

// Mock window.$message (Naive UI 全局消息)
window.$message = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn(),
} as any;

// Mock window.$dialog
window.$dialog = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  create: vi.fn(),
} as any;

// Mock window.$notification
window.$notification = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  create: vi.fn(),
} as any;

// Mock import.meta.env
vi.stubEnv('VITE_STORAGE_PREFIX', 'test_');
vi.stubEnv('VITE_BASE_URL', '/');
