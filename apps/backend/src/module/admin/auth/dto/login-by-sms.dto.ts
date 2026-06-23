import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { TenantContext } from 'src/common/tenant/tenant.context';

export class AdminLoginBySmsDto {
  @ApiProperty({ description: '手机号' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  mobile: string;

  @ApiProperty({ description: '短信验证码' })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString()
  code: string;

  @ApiProperty({ description: '租户 ID', required: false, default: TenantContext.SUPER_TENANT_ID })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '客户端ID', required: false, default: 'pc' })
  @IsOptional()
  @IsString()
  clientId?: string;
}
