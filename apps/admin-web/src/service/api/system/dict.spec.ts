// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchBatchDeleteDictType,
  fetchCreateDictType,
  fetchGetDictDataByType,
  fetchGetDictStats,
  fetchGetDictTypeList,
  fetchGetDictTypeOption,
  fetchImportDict,
  fetchRefreshCache,
  fetchUpdateDictType,
} from './dict';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('System Dict API', () => {
  it('fetchGetDictDataByType should GET /system/dict/data/type/:dictType', async () => {
    const res = await fetchGetDictDataByType('sys_user_sex');
    expect(res.data).toMatchObject({ url: '/system/dict/data/type/sys_user_sex', method: 'get' });
  });

  it('fetchGetDictTypeOption should GET /system/dict/type/optionselect', async () => {
    const res = await fetchGetDictTypeOption();
    expect(res.data).toMatchObject({ url: '/system/dict/type/optionselect', method: 'get' });
  });

  it('fetchGetDictTypeList should GET /system/dict/type/list', async () => {
    const params: Api.System.DictTypeSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetDictTypeList(params);
    expect(res.data).toMatchObject({ url: '/system/dict/type/list', method: 'get', params });
  });

  it('fetchCreateDictType should POST /system/dict/type', async () => {
    const data: Api.System.DictTypeOperateParams = { dictName: '性别', dictType: 'sys_user_sex' };
    const res = await fetchCreateDictType(data);
    expect(res.data).toMatchObject({ url: '/system/dict/type', method: 'post', data });
  });

  it('fetchUpdateDictType should PUT /system/dict/type', async () => {
    const data: Api.System.DictTypeOperateParams = { dictId: 1, dictName: '性别改' };
    const res = await fetchUpdateDictType(data);
    expect(res.data).toMatchObject({ url: '/system/dict/type', method: 'put', data });
  });

  it('fetchBatchDeleteDictType should DELETE /system/dict/type/:ids (joined)', async () => {
    const res = await fetchBatchDeleteDictType([1, 2]);
    expect(res.data).toMatchObject({ url: '/system/dict/type/1,2', method: 'delete' });
  });

  it('fetchRefreshCache should DELETE /system/dict/type/refreshCache', async () => {
    const res = await fetchRefreshCache();
    expect(res.data).toMatchObject({ url: '/system/dict/type/refreshCache', method: 'delete' });
  });

  it('fetchImportDict should POST /system/dict/import', async () => {
    const data: Api.System.ImportDictParams[] = [
      {
        dictName: '订单状态',
        dictType: 'store_order_status',
        dataList: [
          { dictLabel: '待支付', dictValue: 'PENDING_PAY' },
          { dictLabel: '已支付', dictValue: 'PAID' },
        ],
      },
    ];

    const res = await fetchImportDict(data);
    expect(res.data).toMatchObject({ url: '/system/dict/import', method: 'post', data });
  });

  it('fetchGetDictStats should GET /system/dict/stats', async () => {
    const res = await fetchGetDictStats();
    expect(res.data).toMatchObject({ url: '/system/dict/stats', method: 'get' });
  });
});
