import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * 租户配置
 */
export class TenantConfig {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @IsNotEmpty()
  superTenantId: string;

  @IsString()
  @IsNotEmpty()
  defaultTenantId: string;

  /**
   * 未带 tenant-id 时仍按「全局 exempt」处理的路径前缀（去掉 API 全局 prefix 后的路径）。
   * 用于第三方服务器回调等无法在 Header 固定带租户的场景；须配合业务侧签名校验。
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exemptPathPrefixes?: string[];
}
