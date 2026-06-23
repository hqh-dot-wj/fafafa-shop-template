import { ApiProperty } from '@nestjs/swagger';
import { PaymentRecordStatus } from '@prisma/client';
import { PageQueryDto } from 'src/common/dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListPaymentRecordDto extends PageQueryDto {
  @ApiProperty({ required: false, description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ required: false, description: '订单号' })
  @IsOptional()
  @IsString()
  orderSn?: string;

  @ApiProperty({ required: false, description: '交易流水号' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ required: false, description: '支付状态', enum: PaymentRecordStatus })
  @IsOptional()
  @IsEnum(PaymentRecordStatus)
  status?: PaymentRecordStatus;
}
