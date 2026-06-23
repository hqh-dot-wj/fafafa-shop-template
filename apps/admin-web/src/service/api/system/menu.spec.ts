// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchCascadeDeleteMenu,
  fetchCreateMenu,
  fetchDeleteMenu,
  fetchGetMenuList,
  fetchGetMenuTreeSelect,
  fetchGetRoleMenuTreeSelect,
  fetchGetTenantPackageMenuTreeSelect,
  fetchUpdateMenu,
} from './menu';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('System Menu API', () => {
  it('fetchGetMenuList should GET /system/menu/list', async () => {
    const params: Api.System.MenuSearchParams = { menuName: '用户' };
    const res = await fetchGetMenuList(params);
    expect(res.data).toMatchObject({ url: '/system/menu/list', method: 'get', params });
  });

  it('fetchGetMenuList should pass AbortSignal', async () => {
    const controller = new AbortController();
    const res = await fetchGetMenuList(undefined, controller.signal);
    expect(res.data).toMatchObject({ signal: controller.signal });
  });

  it('fetchCreateMenu should POST /system/menu', async () => {
    const data: Api.System.MenuOperateParams = { menuName: '新菜单', menuType: 'C' };
    const res = await fetchCreateMenu(data);
    expect(res.data).toMatchObject({ url: '/system/menu', method: 'post', data });
  });

  it('fetchUpdateMenu should PUT /system/menu', async () => {
    const data: Api.System.MenuOperateParams = { menuId: 1, menuName: '改名菜单' };
    const res = await fetchUpdateMenu(data);
    expect(res.data).toMatchObject({ url: '/system/menu', method: 'put', data });
  });

  it('fetchDeleteMenu should DELETE /system/menu/:menuId', async () => {
    const res = await fetchDeleteMenu(1);
    expect(res.data).toMatchObject({ url: '/system/menu/1', method: 'delete' });
  });

  it('fetchGetMenuTreeSelect should GET system/menu/treeselect', async () => {
    const res = await fetchGetMenuTreeSelect();
    expect(res.data).toMatchObject({ url: 'system/menu/treeselect', method: 'get' });
  });

  it('fetchGetRoleMenuTreeSelect should GET /system/menu/roleMenuTreeselect/:roleId', async () => {
    const res = await fetchGetRoleMenuTreeSelect(1);
    expect(res.data).toMatchObject({ url: '/system/menu/roleMenuTreeselect/1', method: 'get' });
  });

  it('fetchGetTenantPackageMenuTreeSelect should GET /system/menu/tenantPackageMenuTreeselect/:packageId', async () => {
    const res = await fetchGetTenantPackageMenuTreeSelect(2);
    expect(res.data).toMatchObject({ url: '/system/menu/tenantPackageMenuTreeselect/2', method: 'get' });
  });

  it('fetchCascadeDeleteMenu should DELETE /system/menu/cascade/:ids (joined)', async () => {
    const res = await fetchCascadeDeleteMenu([1, 2, 3]);
    expect(res.data).toMatchObject({ url: '/system/menu/cascade/1,2,3', method: 'delete' });
  });
});
