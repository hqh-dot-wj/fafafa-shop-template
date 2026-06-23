import { IsOptional, IsString } from 'class-validator';

/**
 * 阿里云 OSS（与 FILE_IS_LOCAL=false 配合使用）
 */
export class OssConfig {
  @IsOptional()
  @IsString()
  accessKeyId: string;

  @IsOptional()
  @IsString()
  accessKeySecret: string;

  @IsOptional()
  @IsString()
  region: string;

  @IsOptional()
  @IsString()
  bucket: string;

  /** 访问域名，仅主机名或带 https:// 的完整地址，如 oss-cn-beijing.aliyuncs.com */
  @IsOptional()
  @IsString()
  endpoint: string;

  /** 浏览器访问文件的根 URL，须 HTTPS，末尾不要 / */
  @IsOptional()
  @IsString()
  publicBaseUrl: string;

  /** 对象键前缀，如 uploads/，可空 */
  @IsOptional()
  @IsString()
  prefix: string;
}
