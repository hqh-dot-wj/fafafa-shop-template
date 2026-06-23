// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import { fetchSortDictData } from './dict-data';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('System DictData API', () => {
  it('fetchSortDictData should POST /system/dict/data/sort', async () => {
    const data: Api.System.SortDictDataParams = {
      dictType: 'sys_user_sex',
      sortList: [
        { dictCode: 1, dictSort: 0 },
        { dictCode: 2, dictSort: 1 },
      ],
    };
    const res = await fetchSortDictData(data);
    expect(res.data).toMatchObject({ url: '/system/dict/data/sort', method: 'post', data });
  });
});
