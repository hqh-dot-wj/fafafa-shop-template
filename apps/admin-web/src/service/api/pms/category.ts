import { request } from '@/service/request';

/** Get Category Tree */
export function fetchGetCategoryTree() {
  return request<Api.Pms.CategoryTree>({
    url: '/admin/pms/category/tree',
    method: 'get',
  });
}

/** 获取分类列表 (平级) */
export function fetchGetCategoryList(params?: Api.Pms.CategorySearchParams) {
  return request<Api.Pms.CategoryList>({
    url: '/admin/pms/category/list',
    method: 'get',
    params,
  });
}

/** Get Category Detail */
export function fetchGetCategory(id: number) {
  return request<Api.Pms.Category>({
    url: `/admin/pms/category/${id}`,
    method: 'get',
  });
}

/** Add Category */
export function fetchAddCategory(data: Api.Pms.CategoryWriteBody) {
  return request<Api.Pms.Category>({
    url: '/admin/pms/category',
    method: 'post',
    data,
  });
}

/** Update Category（路径参数与 body 分离，避免把 catId/level/status 等 VO 字段提交到 DTO） */
export function fetchUpdateCategory(catId: number, data: Api.Pms.CategoryWriteBody) {
  return request<Api.Pms.Category>({
    url: `/admin/pms/category/${catId}`,
    method: 'put',
    data,
  });
}

/** Delete Category */
export function fetchDeleteCategory(id: number) {
  return request<boolean>({
    url: `/admin/pms/category/${id}`,
    method: 'delete',
  });
}
