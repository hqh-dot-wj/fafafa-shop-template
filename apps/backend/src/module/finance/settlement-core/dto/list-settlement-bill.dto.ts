import { ApiProperty } from '@nestjs/swagger';
import { SettlementBillStatus, SettlementChannelType } from '@prisma/client';
import { PageQueryDto } from 'src/common/dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListSettlementBillDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ required: false, description: '结算单号' })
  @IsOptional()
  @IsString()
  billNo?: string;

  @ApiProperty({ required: false, description: '订单号' })
  @IsOptional()
  @IsString()
  orderSn?: string;

  @ApiProperty({ required: false, description: '结算状态', enum: SettlementBillStatus })
  @IsOptional()
  @IsEnum(SettlementBillStatus)
  status?: SettlementBillStatus;

  @ApiProperty({ required: false, description: '结算通道', enum: SettlementChannelType })
  @IsOptional()
  @IsEnum(SettlementChannelType)
  channelType?: SettlementChannelType;
}
