import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationBatchStatus, ReconciliationBizScope } from '@prisma/client';
import { PageQueryDto } from 'src/common/dto';
import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ListReconciliationBatchDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '对账日期', example: '2026-04-23' })
  @IsOptional()
  @IsDateString()
  batchDate?: string;

  @ApiProperty({ required: false, description: '业务范围', enum: ReconciliationBizScope })
  @IsOptional()
  @IsEnum(ReconciliationBizScope)
  bizScope?: ReconciliationBizScope;

  @ApiProperty({ required: false, description: '通道类型', example: 'WECHAT_PAY' })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  channelType?: string;

  @ApiProperty({ required: false, description: '批次状态', enum: ReconciliationBatchStatus })
  @IsOptional()
  @IsEnum(ReconciliationBatchStatus)
  status?: ReconciliationBatchStatus;
}
