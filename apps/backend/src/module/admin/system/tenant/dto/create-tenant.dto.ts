import { IsString, IsEnum, Length, IsOptional, IsNumber, IsDate } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { StatusEnum, StatusEnumSchema } from 'src/common/enum';
import { IsStrongPassword } from 'src/common/validators/password.validator';
import { SettlementChannelType, SettlementProfileStatus, SettlementReceiverType } from '@prisma/client';

export class CreateTenantDto {
  @ApiProperty({ required: false, description: '租户ID（不传则自动生成）' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  tenantId?: string;

  @ApiProperty({ required: false, description: '联系人' })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  contactUserName?: string;

  @ApiProperty({ required: false, description: '联系电话' })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  contactPhone?: string;

  @ApiProperty({ required: true, description: '企业名称' })
  @IsString()
  @Length(1, 100)
  companyName: string;

  @ApiProperty({ required: false, description: '统一社会信用代码' })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  licenseNumber?: string;

  @ApiProperty({ required: false, description: '地址' })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  address?: string;

  @ApiProperty({ required: false, description: '企业简介' })
  @IsOptional()
  @IsString()
  intro?: string;

  @ApiProperty({ required: false, description: '域名' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  domain?: string;

  @ApiProperty({ required: false, description: '租户套餐ID' })
  @IsOptional()
  @IsNumber()
  packageId?: number;

  @ApiProperty({ required: false, description: '过期时间' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expireTime?: Date;

  @ApiProperty({ required: false, description: '账号数量(-1不限制)' })
  @IsOptional()
  @IsNumber()
  accountCount?: number;

  @ApiProperty({
    type: String,
    enum: StatusEnum,
    enumName: 'StatusEnum',
    enumSchema: StatusEnumSchema,
    required: false,
  })
  @IsOptional()
  @IsEnum(StatusEnum)
  @Type(() => String)
  @Transform(({ value }) => {
    if (value === '0') return StatusEnum.NORMAL;
    if (value === '1') return StatusEnum.STOP;
    return value;
  })
  status?: string;

  @ApiProperty({ required: false, description: '备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;

  @ApiProperty({ required: true, description: '管理员账号' })
  @IsString()
  @Length(1, 30)
  username: string;

  @ApiProperty({ required: true, description: '管理员密码' })
  @IsString()
  @IsStrongPassword()
  @Length(6, 20)
  password: string;

  @ApiProperty({ required: false, description: '经度' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ required: false, description: '纬度' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ required: false, description: '电子围栏 (GeoJSON Polygon)' })
  @IsOptional()
  fence?: {
    type: 'Polygon';
    coordinates: number[][][];
  };

  @ApiProperty({ required: false, description: '行政区划代码' })
  @IsOptional()
  @IsString()
  regionCode?: string;

  @ApiProperty({ required: false, description: '是否直营', default: true })
  @IsOptional()
  isDirect?: boolean;

  @ApiProperty({ required: false, description: '服务半径(米)', default: 3000 })
  @IsOptional()
  @IsNumber()
  serviceRadius?: number;

  @ApiProperty({ required: false, description: '是否启用结算配置' })
  @IsOptional()
  settlementEnabled?: boolean;

  @ApiProperty({ required: false, description: '默认结算通道', enum: SettlementChannelType })
  @IsOptional()
  @IsEnum(SettlementChannelType)
  settlementChannel?: SettlementChannelType;

  @ApiProperty({ required: false, description: '接收方类型', enum: SettlementReceiverType })
  @IsOptional()
  @IsEnum(SettlementReceiverType)
  settlementReceiverType?: SettlementReceiverType;

  @ApiProperty({ required: false, description: '接收方账号' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  settlementReceiverAccount?: string;

  @ApiProperty({ required: false, description: '接收方名称' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  settlementReceiverName?: string;

  @ApiProperty({ required: false, description: '银行名称' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  settlementBankName?: string;

  @ApiProperty({ required: false, description: '银行卡号' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  settlementBankAccountNo?: string;

  @ApiProperty({ required: false, description: '是否人工审核', default: true })
  @IsOptional()
  settlementNeedManualReview?: boolean;

  @ApiProperty({ required: false, description: '结算配置状态', enum: SettlementProfileStatus })
  @IsOptional()
  @IsEnum(SettlementProfileStatus)
  settlementStatus?: SettlementProfileStatus;

  @ApiProperty({ required: false, description: '结算备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  settlementRemark?: string;
}
