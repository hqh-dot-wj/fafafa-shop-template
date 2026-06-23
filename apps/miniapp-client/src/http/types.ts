/**
 * 在 uniapp 的 RequestOptions 和 IUniUploadFileOptions 基础上，添加自定义参数
 */
// uni.request 的 query 最终会序列化为普通对象；这里接受对象类型，避免把具名查询 DTO 强制要求成索引签名。
export type RequestQuery = object;

export type CustomRequestOptions = UniApp.RequestOptions & {
  query?: RequestQuery;
  /** 出错时是否隐藏错误提示 */
  hideErrorToast?: boolean;
  /** 业务动作编码 */
  operationCode?: string;
  /** 业务步骤编码 */
  stepCode?: string;
  /** 业务步骤名称 */
  stepName?: string;
  /** 链路 ID */
  traceId?: string;
  /** 请求 ID */
  requestId?: string;
  /** 脱敏上下文 */
  metadata?: Record<string, unknown>;
} & IUniUploadFileOptions; // 添加uni.uploadFile参数类型

/** 主要提供给 openapi-ts-request 生成的代码使用 */
export type CustomRequestOptions_ = Omit<CustomRequestOptions, 'url'>;

export interface HttpRequestResult<T> {
  promise: Promise<T>;
  requestTask: UniApp.RequestTask;
}

// 通用响应格式（兼容 msg + message 字段）
export interface IResponse<T = unknown> {
  code: number;
  data: T;
  message?: string;
  msg?: string;
  [key: string]: unknown;
}

// 分页请求参数
export interface PageParams {
  page: number;
  pageSize: number;
  [key: string]: unknown;
}

// 分页响应数据
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
