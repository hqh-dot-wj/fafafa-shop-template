import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BusinessDashboardQueryDto {
  @ApiPropertyOptional({ description: '租户 ID（默认使用当前登录租户）' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
