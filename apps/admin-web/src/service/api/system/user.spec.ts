// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchAuthUserRole,
  fetchBatchDeleteUser,
  fetchCreateUser,
  fetchGetAuthRole,
  fetchGetDeptTree,
  fetchGetDeptUserList,
  fetchGetUserInfo,
  fetchGetUserList,
  fetchGetUserSelect,
  fetchResetUserPassword,
  fetchUpdateUser,
  fetchUpdateUserAvatar,
  fetchUpdateUserPassword,
  fetchUpdateUserProfile,
  fetchUpdateUserStatus,
} from './user';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('System User API', () => {
  it('fetchGetUserList should GET /system/user/list', async () => {
    const params: Api.System.UserSearchParams = { pageNum: 1, pageSize: 10 };
    const res = await fetchGetUserList(params);
    expect(res.data).toMatchObject({ url: '/system/user/list', method: 'get', params });
  });

  it('fetchGetDeptUserList should GET /system/user/list/dept/:deptId', async () => {
    const res = await fetchGetDeptUserList(5);
    expect(res.data).toMatchObject({ url: '/system/user/list/dept/5', method: 'get' });
  });

  it('fetchCreateUser should POST /system/user', async () => {
    const data: Api.System.UserOperateParams = { userName: 'user1', nickName: '用户1' };
    const res = await fetchCreateUser(data);
    expect(res.data).toMatchObject({ url: '/system/user', method: 'post', data });
  });

  it('fetchUpdateUser should PUT /system/user', async () => {
    const data: Api.System.UserOperateParams = { userId: 1, nickName: '用户1改' };
    const res = await fetchUpdateUser(data);
    expect(res.data).toMatchObject({ url: '/system/user', method: 'put', data });
  });

  it('fetchGetUserSelect should GET /system/user/optionselect', async () => {
    const res = await fetchGetUserSelect();
    expect(res.data).toMatchObject({ url: '/system/user/optionselect', method: 'get' });
  });

  it('fetchUpdateUserStatus should PUT /system/user/changeStatus', async () => {
    const data: Api.System.UserOperateParams = { userId: 1, status: '1' };
    const res = await fetchUpdateUserStatus(data);
    expect(res.data).toMatchObject({ url: '/system/user/changeStatus', method: 'put', data });
  });

  it('fetchBatchDeleteUser should DELETE /system/user/:ids (joined)', async () => {
    const res = await fetchBatchDeleteUser([1, 2, 3]);
    expect(res.data).toMatchObject({ url: '/system/user/1,2,3', method: 'delete' });
  });

  it('fetchGetUserInfo should GET /system/user/:userId', async () => {
    const res = await fetchGetUserInfo(1);
    expect(res.data).toMatchObject({ url: '/system/user/1', method: 'get' });
  });

  it('fetchGetDeptTree should GET /system/user/deptTree', async () => {
    const res = await fetchGetDeptTree();
    expect(res.data).toMatchObject({ url: '/system/user/deptTree', method: 'get' });
  });

  it('fetchResetUserPassword should PUT /system/user/resetPwd with isEncrypt', async () => {
    const res = await fetchResetUserPassword(1, 'newpass');
    expect(res.data).toMatchObject({
      url: '/system/user/resetPwd',
      method: 'put',
      headers: expect.objectContaining({ isEncrypt: true }),
      data: { userId: 1, password: 'newpass' },
    });
  });

  it('fetchGetAuthRole should GET /system/user/authRole/:userId', async () => {
    const res = await fetchGetAuthRole(1);
    expect(res.data).toMatchObject({ url: '/system/user/authRole/1', method: 'get' });
  });

  it('fetchAuthUserRole should PUT /system/user/authRole', async () => {
    const res = await fetchAuthUserRole(1, [10, 20]);
    expect(res.data).toMatchObject({
      url: '/system/user/authRole',
      method: 'put',
      data: { userId: 1, roleIds: [10, 20] },
    });
  });

  it('fetchUpdateUserProfile should PUT /system/user/profile', async () => {
    const data: Api.System.UserProfileOperateParams = { nickName: '新昵称' };
    const res = await fetchUpdateUserProfile(data);
    expect(res.data).toMatchObject({ url: '/system/user/profile', method: 'put', data });
  });

  it('fetchUpdateUserPassword should PUT /system/user/profile/updatePwd with isEncrypt', async () => {
    const data: Api.System.UserPasswordOperateParams = { oldPassword: 'old', newPassword: 'new' };
    const res = await fetchUpdateUserPassword(data);
    expect(res.data).toMatchObject({
      url: '/system/user/profile/updatePwd',
      method: 'put',
      headers: expect.objectContaining({ isEncrypt: true }),
      data,
    });
  });

  it('fetchUpdateUserAvatar should POST /system/user/profile/avatar', async () => {
    const formData = new FormData();
    const res = await fetchUpdateUserAvatar(formData);
    expect(res.data).toMatchObject({ url: '/system/user/profile/avatar', method: 'post' });
  });
});
