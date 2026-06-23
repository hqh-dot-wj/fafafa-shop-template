import { request } from '@/service/request';

/** 批量接口用的 OSS 主键列表（过滤空值，避免拼出 `/resource/oss/` 触发 404） */
export function normalizeOssIdsForBatch(ossIds: CommonType.IdType[]): string[] {
  return ossIds.map((id) => String(id ?? '').trim()).filter((id) => id.length > 0);
}

/** 获取文件管理列表 */
export function fetchGetOssList(params?: Api.System.OssSearchParams) {
  return request<Api.System.OssList>({
    url: '/resource/oss/list',
    method: 'get',
    params,
  });
}

/** 批量删除文件管理 */
export function fetchBatchDeleteOss(ossIds: CommonType.IdType[]) {
  const ids = normalizeOssIdsForBatch(ossIds);
  if (ids.length === 0) {
    return Promise.resolve({ data: true as boolean, error: null });
  }
  return request<boolean>({
    url: `/resource/oss/${ids.join(',')}`,
    method: 'delete',
  });
}

/** 查询OSS对象基于id串 */
export function fetchGetOssListByIds(ossIds: CommonType.IdType[]) {
  const ids = normalizeOssIdsForBatch(ossIds);
  if (ids.length === 0) {
    return Promise.resolve({ data: [] as Api.System.Oss[], error: null });
  }
  return request<Api.System.Oss[]>({
    url: `/resource/oss/listByIds/${ids.join(',')}`,
    method: 'get',
  });
}

/** 上传文件 */
export function fetchUploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return request<Api.System.Oss>({
    url: '/resource/oss/upload',
    method: 'post',
    data: formData,
    headers: {
      /**
       * FormData 经 JSON.stringify 恒为 `{}`，批量选图会在 500ms 内被误判为「重复提交」而直接抛错，
       * 编辑器侧 Promise 异常后易一直停在「上传中」。
       */
      repeatSubmit: false,
    },
  });
}
