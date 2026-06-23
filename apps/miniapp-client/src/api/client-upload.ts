import type { IResponse } from '@/http/types';
import { ResultEnum } from '@/http/tools/enum';
import { useTokenStore } from '@/store/token';
import { navigateAfterSessionExpired } from '@/utils/session-expired-navigate';

export interface ClientUploadFileResult {
  ossId: string;
  url: string;
  size: number;
  mimeType: string;
  storageType: string;
}

/**
 * 会员登录态通用单文件上传（multipart，字段名 `file`）
 */
export async function uploadClientFile(filePath: string): Promise<ClientUploadFileResult> {
  const base = import.meta.env.VITE_SERVER_BASEURL as string;
  const tokenStore = useTokenStore();
  const token = await tokenStore.tryGetValidToken();
  const url = `${base.replace(/\/+$/u, '')}/client/upload/file`;

  if (!token) {
    await tokenStore.logout();
    navigateAfterSessionExpired();
    throw new Error('登录已过期，请重新登录');
  }

  return new Promise((resolve, reject) => {
    const rejectSessionExpired = () => {
      void tokenStore.logout().finally(() => {
        navigateAfterSessionExpired();
      });
      reject(new Error('登录已过期，请重新登录'));
    };

    uni.uploadFile({
      url,
      filePath,
      name: 'file',
      header: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      success: (res) => {
        if (res.statusCode === 401) {
          rejectSessionExpired();
          return;
        }

        try {
          const body = JSON.parse(res.data as string) as IResponse<ClientUploadFileResult>;
          if (body.code === 401) {
            rejectSessionExpired();
            return;
          }
          if (body.code !== ResultEnum.Success0 && body.code !== ResultEnum.Success200) {
            reject(new Error(body.msg ?? body.message ?? '上传失败'));
            return;
          }
          if (body.data === null || body.data === undefined) {
            reject(new Error('上传响应无数据'));
            return;
          }
          resolve(body.data);
        } catch {
          reject(new Error('解析上传响应失败'));
        }
      },
      fail: (err) => reject(err),
    });
  });
}
