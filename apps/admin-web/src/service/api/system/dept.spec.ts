// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchBatchDeleteDept,
  fetchCreateDept,
  fetchGetDeptList,
  fetchGetDeptSelect,
  fetchGetExcludeDeptList,
  fetchUpdateDept,
} from './dept';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('System Dept API', () => {
  it('fetchGetDeptList should GET /system/dept/list', async () => {
    const params: Api.System.DeptSearchParams = { deptName: '研发' };
    const res = await fetchGetDeptList(params);
    expect(res.data).toMatchObject({ url: '/system/dept/list', method: 'get', params });
  });

  it('fetchGetExcludeDeptList should GET /system/dept/list/exclude/:deptId', async () => {
    const res = await fetchGetExcludeDeptList(1);
    expect(res.data).toMatchObject({ url: '/system/dept/list/exclude/1', method: 'get' });
  });

  it('fetchCreateDept should POST /system/dept', async () => {
    const data: Api.System.DeptOperateParams = { deptName: '新部门', parentId: 0 };
    const res = await fetchCreateDept(data);
    expect(res.data).toMatchObject({ url: '/system/dept', method: 'post', data });
  });

  it('fetchUpdateDept should PUT /system/dept', async () => {
    const data: Api.System.DeptOperateParams = { deptId: 1, deptName: '改名部门' };
    const res = await fetchUpdateDept(data);
    expect(res.data).toMatchObject({ url: '/system/dept', method: 'put', data });
  });

  it('fetchBatchDeleteDept should DELETE /system/dept/:ids (joined)', async () => {
    const res = await fetchBatchDeleteDept([1, 2]);
    expect(res.data).toMatchObject({ url: '/system/dept/1,2', method: 'delete' });
  });

  it('fetchGetDeptSelect should GET /system/dept/optionselect', async () => {
    const res = await fetchGetDeptSelect();
    expect(res.data).toMatchObject({ url: '/system/dept/optionselect', method: 'get' });
  });
});
