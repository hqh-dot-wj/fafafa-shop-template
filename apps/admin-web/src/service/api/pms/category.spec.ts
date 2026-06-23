// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchAddCategory,
  fetchDeleteCategory,
  fetchGetCategory,
  fetchGetCategoryList,
  fetchGetCategoryTree,
  fetchUpdateCategory,
} from './category';

// Mock request
vi.mock('@/service/request', () => ({
  request: vi.fn((config) => Promise.resolve({ data: config })),
}));

describe('PMS Category API', () => {
  it('fetchGetCategoryTree should have correct config', async () => {
    const res = await fetchGetCategoryTree();
    expect(res.data).toMatchObject({
      url: '/admin/pms/category/tree',
      method: 'get',
    });
  });

  it('fetchGetCategoryList should have correct config', async () => {
    const params: Api.Pms.CategorySearchParams = { parentId: 0 };
    const res = await fetchGetCategoryList(params);
    expect(res.data).toMatchObject({
      url: '/admin/pms/category/list',
      method: 'get',
      params,
    });
  });

  it('fetchGetCategory should have correct config', async () => {
    const id = 1;
    const res = await fetchGetCategory(id);
    expect(res.data).toMatchObject({
      url: `/admin/pms/category/${id}`,
      method: 'get',
    });
  });

  it('fetchAddCategory should have correct config', async () => {
    const data: Api.Pms.CategoryWriteBody = {
      parentId: 0,
      name: 'NewCategory',
      sort: 0,
    };
    const res = await fetchAddCategory(data);
    expect(res.data).toMatchObject({
      url: '/admin/pms/category',
      method: 'post',
      data,
    });
  });

  it('fetchUpdateCategory should have correct config', async () => {
    const catId = 1;
    const data: Api.Pms.CategoryWriteBody = {
      parentId: 0,
      name: 'UpdatedCategory',
      sort: 0,
    };
    const res = await fetchUpdateCategory(catId, data);
    expect(res.data).toMatchObject({
      url: `/admin/pms/category/${catId}`,
      method: 'put',
      data,
    });
  });

  it('fetchDeleteCategory should have correct config', async () => {
    const id = 1;
    const res = await fetchDeleteCategory(id);
    expect(res.data).toMatchObject({
      url: `/admin/pms/category/${id}`,
      method: 'delete',
    });
  });
});
