import { ApiProperty } from '@nestjs/swagger';
import { SettlementChannelType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ExecuteSettlementBillDto {
  @ApiProperty({ description: '结算单ID' })
  @IsString()
  billId: string;

  @ApiProperty({ required: false, description: '执行通道', enum: SettlementChannelType })
  @IsOptional()
  @IsEnum(SettlementChannelType)
  channelType?: SettlementChannelType;

  @ApiProperty({ required: false, description: '外部流水号或回单号' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  externalNo?: string;

  @ApiProperty({ required: false, description: '是否直接记为成功', default: false })
  @IsOptional()
  @IsBoolean()
  markAsSuccess?: boolean;

  @ApiProperty({ required: false, description: '执行备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
