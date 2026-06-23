export interface IDoubleTokenRes {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  refresh_expire_in: number;
  token: string;
  expiresIn: number;
}

export type IAuthLoginRes = IDoubleTokenRes & {
  userInfo?: IUserInfoRes;
  isNew?: boolean;
};

export interface IUserInfoRes {
  userId: number;
  username: string;
  nickname: string;
  avatar?: string;
  levelId?: number | null;
  mobile?: string | null;
  [key: string]: unknown;
}

export interface ICaptcha {
  captchaEnabled: boolean;
  uuid: string;
  image: string;
}

export interface IUploadSuccessInfo {
  fileId: number;
  originalName: string;
  fileName: string;
  storagePath: string;
  fileHash: string;
  fileType: string;
  fileBusinessType: string;
  fileSize: number;
}

export interface IUpdateInfo {
  id: number;
  name: string;
  sex: string;
}

export interface IUpdatePassword {
  id: number;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ICheckLoginRes {
  isRegistered: boolean;
  access_token?: string;
  refresh_token?: string;
  expire_in?: number;
  refresh_expire_in?: number;
  token?: string;
  expiresIn?: number;
  userInfo?: IUserInfoRes;
}

export interface IRegisterMobileParams {
  loginCode: string;
  phoneCode: string;
  tenantId: string;
  referrerId?: string;
  userInfo?: {
    nickName: string;
    avatarUrl: string;
  };
  /** 注册用头像 data URL，服务端上传 OSS 后写入会员头像 */
  avatarImageBase64?: string;
}

export interface IWxRegisterParams {
  loginCode: string;
  tenantId?: string;
  referrerId?: string;
  userInfo?: {
    nickName: string;
    avatarUrl: string;
  };
  /** 注册用头像 data URL，服务端上传 OSS 后写入会员头像 */
  avatarImageBase64?: string;
}

export interface ISmsLoginParams {
  mobile: string;
  code: string;
  tenantId?: string;
  referrerId?: string;
}

export interface IPasswordLoginParams {
  mobile: string;
  password: string;
  tenantId?: string;
}

export interface IResetPasswordParams {
  mobile: string;
  code: string;
  newPassword: string;
  tenantId?: string;
}

export interface ISetPasswordParams {
  newPassword: string;
}
