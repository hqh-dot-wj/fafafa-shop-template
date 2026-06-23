import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class ReportErrorEventDto {
  @ApiProperty({ description: '来源应用', enum: ['admin-web', 'miniapp-client'] })
  @IsIn(['admin-web', 'miniapp-client'])
  app: 'admin-web' | 'miniapp-client';

  @ApiPropertyOptional({ description: '错误级别', enum: ['warn', 'error', 'fatal'] })
  @IsOptional()
  @IsIn(['warn', 'error', 'fatal'])
  level?: 'warn' | 'error' | 'fatal';

  @ApiPropertyOptional({ description: '请求ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  requestId?: string;

  @ApiPropertyOptional({ description: '链路ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  traceId?: string;

  @ApiPropertyOptional({ description: '错误事件ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  errorId?: string;

  @ApiPropertyOptional({ description: '租户ID' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tenantId?: string;

  @ApiPropertyOptional({ description: '用户ID' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @ApiPropertyOptional({ description: '页面路由或接口路径' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  route?: string;

  @ApiPropertyOptional({ description: '请求方法' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  method?: string;

  @ApiPropertyOptional({ description: '前端模块' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  module?: string;

  @ApiPropertyOptional({ description: '业务动作编码' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  operationCode?: string;

  @ApiPropertyOptional({ description: '业务步骤编码' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  stepCode?: string;

  @ApiPropertyOptional({ description: '业务步骤名称' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  stepName?: string;

  @ApiProperty({ description: '错误码' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  errorCode: string;

  @ApiProperty({ description: '安全错误提示' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  safeMessage: string;

  @ApiPropertyOptional({ description: '技术排查信息' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  technicalMessage?: string;

  @ApiPropertyOptional({ description: '堆栈' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  stack?: string;

  @ApiPropertyOptional({ description: '耗时' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  durationMs?: number;

  @ApiPropertyOptional({ description: '脱敏上下文' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
