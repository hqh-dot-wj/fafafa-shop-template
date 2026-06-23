import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationBizScope, ReconciliationResultStatus } from '@prisma/client';
import { PageQueryDto } from 'src/common/dto';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ListReconciliationResultDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '对账批次ID' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiProperty({ required: false, description: '业务范围', enum: ReconciliationBizScope })
  @IsOptional()
  @IsEnum(ReconciliationBizScope)
  bizScope?: ReconciliationBizScope;

  @ApiProperty({ required: false, description: '通道类型', example: 'WECHAT_PAY' })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  channelType?: string;

  @ApiProperty({ required: false, description: '结果状态', enum: ReconciliationResultStatus })
  @IsOptional()
  @IsEnum(ReconciliationResultStatus)
  status?: ReconciliationResultStatus;

  @ApiProperty({ required: false, description: '原因编码' })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  reasonCode?: string;

  @ApiProperty({ required: false, description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ required: false, description: '本地业务单号' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  localBizNo?: string;

  @ApiProperty({ required: false, description: '渠道业务单号' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  channelBizNo?: string;
}
