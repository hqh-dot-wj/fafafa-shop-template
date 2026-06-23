import { afterEach, describe, expect, it, vi } from 'vitest';

type MessageMock = {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function setMessageMock(): MessageMock {
  const success = vi.fn();
  const error = vi.fn();
  window.$message = { success, error } as any;
  return { success, error };
}

async function importHandleCopy(isSupported: boolean) {
  const copy = vi.fn();

  vi.resetModules();
  vi.doMock('@vueuse/core', () => ({
    useClipboard: () => ({ copy, isSupported })
  }));

  const module = await import('./copy');
  return { handleCopy: module.handleCopy, copy };
}

describe('handleCopy', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unmock('@vueuse/core');
  });

  it('Given browser unsupported, When copy, Then show error', async () => {
    const message = setMessageMock();
    const { handleCopy, copy } = await importHandleCopy(false);

    await handleCopy('abc');

    expect(message.error).toHaveBeenCalledWith('您的浏览器不支持 Clipboard API');
    expect(copy).not.toHaveBeenCalled();
  });

  it('Given empty source, When copy, Then no success message', async () => {
    const message = setMessageMock();
    const { handleCopy, copy } = await importHandleCopy(true);

    await handleCopy('');

    expect(copy).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
  });

  it('Given secure context, When copy, Then call clipboard and show success', async () => {
    const message = setMessageMock();
    const { handleCopy, copy } = await importHandleCopy(true);

    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: {}, configurable: true });

    await handleCopy('hello world');

    expect(copy).toHaveBeenCalledWith('hello world');
    expect(message.success).toHaveBeenCalledWith('复制成功');
  });
});
