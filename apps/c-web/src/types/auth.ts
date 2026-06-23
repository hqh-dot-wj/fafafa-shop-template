/** C 绔璇佺被鍨嬶紱涓?miniapp `api/types/login` 瀛楁瀵归綈锛屽緟 common-types 瀵煎嚭鍚庡彲杩佸洖鍏变韩鍖呫€?*/

export interface DoubleTokenRes {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  refresh_expire_in: number;
  token: string;
  expiresIn: number;
}

export type AuthLoginRes = DoubleTokenRes & {
  userInfo?: UserInfoRes;
  isNew?: boolean;
};

export interface UserInfoRes {
  userId: number;
  username: string;
  nickname: string;
  avatar?: string;
  levelId?: number | null;
  mobile?: string | null;
  [key: string]: unknown;
}

export interface SmsLoginParams {
  mobile: string;
  code: string;
  tenantId?: string;
  referrerId?: string;
}

export interface PasswordLoginParams {
  mobile: string;
  password: string;
  tenantId?: string;
}
