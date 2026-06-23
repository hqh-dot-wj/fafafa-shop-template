import { ApiProperty } from '@nestjs/swagger';
import { ReconciliationBizScope } from '@prisma/client';
import { PageQueryDto } from 'src/common/dto';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ListStatementLineDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '账单批次ID' })
  @IsOptional()
  @IsString()
  batchId?: string;

  @ApiProperty({ required: false, description: '对账业务范围', enum: ReconciliationBizScope })
  @IsOptional()
  @IsEnum(ReconciliationBizScope)
  bizScope?: ReconciliationBizScope;

  @ApiProperty({ required: false, description: '通道类型', example: 'WECHAT_PAY' })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  channelType?: string;

  @ApiProperty({ required: false, description: '渠道状态' })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  status?: string;

  @ApiProperty({ required: false, description: '我方业务单号' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  outBizNo?: string;

  @ApiProperty({ required: false, description: '渠道交易流水号' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  transactionId?: string;
}
