import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from 'src/common/dto';

export class ListErrorEventDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '来源应用' })
  @IsOptional()
  @IsString()
  app?: string;

  @ApiPropertyOptional({ description: '错误级别' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: '链路ID' })
  @IsOptional()
  @IsString()
  traceId?: string;

  @ApiPropertyOptional({ description: '请求ID' })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({ description: '错误事件ID' })
  @IsOptional()
  @IsString()
  errorId?: string;

  @ApiPropertyOptional({ description: '业务动作编码' })
  @IsOptional()
  @IsString()
  operationCode?: string;

  @ApiPropertyOptional({ description: '业务步骤编码' })
  @IsOptional()
  @IsString()
  stepCode?: string;

  @ApiPropertyOptional({ description: '错误码' })
  @IsOptional()
  @IsString()
  errorCode?: string;

  @ApiPropertyOptional({ description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class ListStepEventDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '链路ID' })
  @IsOptional()
  @IsString()
  traceId?: string;

  @ApiPropertyOptional({ description: '业务动作编码' })
  @IsOptional()
  @IsString()
  operationCode?: string;

  @ApiPropertyOptional({ description: '错误事件ID' })
  @IsOptional()
  @IsString()
  errorId?: string;

  @ApiPropertyOptional({ description: '业务步骤编码' })
  @IsOptional()
  @IsString()
  stepCode?: string;

  @ApiPropertyOptional({ description: '步骤状态' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
