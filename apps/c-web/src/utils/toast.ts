import { showFailToast, showSuccessToast, showToast } from 'vant';

/** 普通提示（表单校验、中性信息） */
export function toastMessage(message: string): void {
  showToast(message);
}

/** 操作成功 */
export function toastSuccess(message: string): void {
  showSuccessToast(message);
}

/** 错误 / 接口失败 */
export function toastFail(message: string): void {
  showFailToast(message);
}

/** 从 unknown 错误提取文案并 toast */
export function toastError(error: unknown, fallback: string): void {
  toastFail(error instanceof Error ? error.message : fallback);
}
