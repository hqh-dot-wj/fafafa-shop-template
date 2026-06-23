import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorEventVo {
  @ApiProperty()
  id: string;

  @ApiProperty()
  app: string;

  @ApiProperty()
  level: string;

  @ApiPropertyOptional()
  requestId?: string;

  @ApiPropertyOptional()
  traceId?: string;

  @ApiProperty()
  errorId: string;

  @ApiPropertyOptional()
  tenantId?: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional()
  route?: string;

  @ApiPropertyOptional()
  operationCode?: string;

  @ApiPropertyOptional()
  stepCode?: string;

  @ApiPropertyOptional()
  stepName?: string;

  @ApiProperty()
  errorCode: string;

  @ApiProperty()
  safeMessage: string;

  @ApiPropertyOptional()
  technicalMessage?: string;

  @ApiPropertyOptional()
  durationMs?: number;

  @ApiProperty()
  createTime: Date;
}

export class StepEventVo {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  traceId?: string;

  @ApiPropertyOptional()
  errorId?: string;

  @ApiPropertyOptional()
  tenantId?: string;

  @ApiProperty()
  operationCode: string;

  @ApiProperty()
  stepCode: string;

  @ApiProperty()
  stepName: string;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  durationMs?: number;

  @ApiProperty()
  createTime: Date;
}
