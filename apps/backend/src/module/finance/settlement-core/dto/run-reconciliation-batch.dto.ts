import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationBizScope } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class RunReconciliationBatchDto {
  @ApiProperty({ description: '对账日期', example: '2026-04-23' })
  @IsDateString()
  batchDate: string;

  @ApiProperty({ description: '业务范围', enum: ReconciliationBizScope })
  @IsEnum(ReconciliationBizScope)
  bizScope: ReconciliationBizScope;

  @ApiProperty({ description: '通道类型', example: 'WECHAT_PAY' })
  @IsString()
  @Length(1, 30)
  channelType: string;

  @ApiProperty({ required: false, description: '是否强制重跑' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
