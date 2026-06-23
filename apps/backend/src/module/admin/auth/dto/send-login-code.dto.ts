import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { TenantContext } from 'src/common/tenant/tenant.context';

export class SendAdminLoginCodeDto {
  @ApiProperty({ description: '手机号' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  mobile: string;

  @ApiProperty({ description: '租户 ID', required: false, default: TenantContext.SUPER_TENANT_ID })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
