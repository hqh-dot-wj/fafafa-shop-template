import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

/** 单实例店铺设置（读写 sys_tenant 000000 品牌字段） */
export class ShopSettingsDto {
  @ApiProperty({ description: '店铺名称' })
  @IsString()
  @Length(1, 100)
  companyName: string;

  @ApiProperty({ required: false, description: '店铺 Logo URL' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  logoUrl?: string;

  @ApiProperty({ required: false, description: '主题色（如 #1976d2）' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  @Matches(/^$|^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, {
    message: '主题色须为 #RGB / #RRGGBB / #RRGGBBAA 格式',
  })
  themeColor?: string;

  @ApiProperty({ required: false, description: '客服联系人' })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  contactUserName?: string;

  @ApiProperty({ required: false, description: '客服电话' })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  contactPhone?: string;

  @ApiProperty({ required: false, description: '用户服务协议正文' })
  @IsOptional()
  @IsString()
  userAgreement?: string;

  @ApiProperty({ required: false, description: '隐私政策正文' })
  @IsOptional()
  @IsString()
  privacyAgreement?: string;
}

export class ShopSettingsVo extends ShopSettingsDto {
  @ApiProperty({ description: '租户编号（固定 000000）' })
  tenantId: string;

  @ApiProperty({ description: '租户主键' })
  id: number;
}
