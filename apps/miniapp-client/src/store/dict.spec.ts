import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDictByType } from '@/api/dict';
import { useDictStore } from './dict';

vi.mock('@/api/dict', () => ({
  getDictByType: vi.fn(),
}));

const mockedGetDictByType = vi.mocked(getDictByType);

describe('dict store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('首次拉取应写入缓存，重复请求应复用缓存', async () => {
    mockedGetDictByType.mockResolvedValue([
      { dictCode: 1, dictType: 'store_order_status', dictLabel: '待支付', dictValue: 'PENDING_PAY', dictSort: 1 },
    ]);

    const store = useDictStore();

    await store.ensureDict('store_order_status');
    await store.ensureDict('store_order_status');

    expect(mockedGetDictByType).toHaveBeenCalledTimes(1);
    expect(store.getDict('store_order_status')).toHaveLength(1);
  });

  it('getOptions 应返回 label/value 结构', async () => {
    mockedGetDictByType.mockResolvedValue([
      { dictCode: 1, dictType: 'store_order_status', dictLabel: '待支付', dictValue: 'PENDING_PAY', dictSort: 1 },
      { dictCode: 2, dictType: 'store_order_status', dictLabel: '已支付', dictValue: 'PAID', dictSort: 2 },
    ]);

    const store = useDictStore();
    const options = await store.getOptions('store_order_status');

    expect(options).toEqual([
      { label: '待支付', value: 'PENDING_PAY' },
      { label: '已支付', value: 'PAID' },
    ]);
  });
});
