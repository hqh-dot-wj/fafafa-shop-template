// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchBatchDeleteRole,
  fetchCreateRole,
  fetchGetRoleDeptTreeSelect,
  fetchGetRoleList,
  fetchGetRoleSelect,
  fetchGetRoleUserList,
  fetchUpdateRole,
  fetchUpdateRoleAuthUser,
  fetchUpdateRoleAuthUserCancel,
  fetchUpdateRoleDataScope,
  fetchUpdateRoleStatus,
} from './role';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('System Role API', () => {
  it('fetchGetRoleList should GET /system/role/list', async () => {
    const params: Api.System.RoleSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetRoleList(params);
    expect(res.data).toMatchObject({ url: '/system/role/list', method: 'get', params });
  });

  it('fetchCreateRole should POST /system/role', async () => {
    const data: Api.System.RoleOperateParams = { roleName: '测试角色', roleKey: 'test' };
    const res = await fetchCreateRole(data);
    expect(res.data).toMatchObject({ url: '/system/role', method: 'post', data });
  });

  it('fetchUpdateRole should PUT /system/role', async () => {
    const data: Api.System.RoleOperateParams = { roleId: 1, roleName: '改名角色' };
    const res = await fetchUpdateRole(data);
    expect(res.data).toMatchObject({ url: '/system/role', method: 'put', data });
  });

  it('fetchUpdateRoleStatus should PUT /system/role/changeStatus', async () => {
    const data: Api.System.RoleOperateParams = { roleId: 1, status: 'NORMAL' };
    const res = await fetchUpdateRoleStatus(data);
    expect(res.data).toMatchObject({ url: '/system/role/changeStatus', method: 'put', data });
  });

  it('fetchUpdateRoleDataScope should PUT /system/role/dataScope', async () => {
    const data: Api.System.RoleOperateParams = { roleId: 1, dataScope: '2' };
    const res = await fetchUpdateRoleDataScope(data);
    expect(res.data).toMatchObject({ url: '/system/role/dataScope', method: 'put', data });
  });

  it('fetchBatchDeleteRole should DELETE /system/role/:ids (joined)', async () => {
    const res = await fetchBatchDeleteRole([1, 2]);
    expect(res.data).toMatchObject({ url: '/system/role/1,2', method: 'delete' });
  });

  it('fetchGetRoleSelect should GET /system/role/optionselect', async () => {
    const res = await fetchGetRoleSelect([1, 2]);
    expect(res.data).toMatchObject({ url: '/system/role/optionselect', method: 'get' });
  });

  it('fetchGetRoleDeptTreeSelect should GET /system/role/deptTree/:roleId', async () => {
    const res = await fetchGetRoleDeptTreeSelect(1);
    expect(res.data).toMatchObject({ url: '/system/role/deptTree/1', method: 'get' });
  });

  it('fetchGetRoleUserList should GET /system/role/authUser/allocatedList', async () => {
    const params: Api.System.UserSearchParams = { pageNum: 1, pageSize: 10, roleId: 1 };
    const res = await fetchGetRoleUserList(params);
    expect(res.data).toMatchObject({ url: '/system/role/authUser/allocatedList', method: 'get', params });
  });

  it('fetchUpdateRoleAuthUser should PUT /system/role/authUser/selectAll with joined userIds', async () => {
    const res = await fetchUpdateRoleAuthUser(1, [10, 20]);
    expect(res.data).toMatchObject({
      url: '/system/role/authUser/selectAll',
      method: 'put',
      params: expect.objectContaining({ roleId: 1, userIds: '10,20' }),
    });
  });

  it('fetchUpdateRoleAuthUserCancel should PUT /system/role/authUser/cancelAll', async () => {
    const res = await fetchUpdateRoleAuthUserCancel(1, [10]);
    expect(res.data).toMatchObject({
      url: '/system/role/authUser/cancelAll',
      method: 'put',
      params: expect.objectContaining({ roleId: 1, userIds: '10' }),
    });
  });
});
