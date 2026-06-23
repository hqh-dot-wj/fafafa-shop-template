import { ApiProperty } from '@nestjs/swagger';
import { SettlementChannelType, SettlementProfileStatus, SettlementReceiverType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class UpdateTenantSettlementProfileDto {
  @ApiProperty({ required: false, description: '是否启用结算', default: false })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ required: false, description: '默认结算通道', enum: SettlementChannelType })
  @IsOptional()
  @IsEnum(SettlementChannelType)
  defaultChannel?: SettlementChannelType;

  @ApiProperty({ required: false, description: '接收方类型', enum: SettlementReceiverType })
  @IsOptional()
  @IsEnum(SettlementReceiverType)
  receiverType?: SettlementReceiverType;

  @ApiProperty({ required: false, description: '接收方账号' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  receiverAccount?: string;

  @ApiProperty({ required: false, description: '接收方名称' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  receiverName?: string;

  @ApiProperty({ required: false, description: '银行名称' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  bankName?: string;

  @ApiProperty({ required: false, description: '银行卡号' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  bankAccountNo?: string;

  @ApiProperty({ required: false, description: '是否人工审核', default: true })
  @IsOptional()
  @IsBoolean()
  needManualReview?: boolean;

  @ApiProperty({ required: false, description: '配置状态', enum: SettlementProfileStatus })
  @IsOptional()
  @IsEnum(SettlementProfileStatus)
  status?: SettlementProfileStatus;

  @ApiProperty({ required: false, description: '备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}
