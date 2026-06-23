import { ApiProperty } from '@nestjs/swagger';

/** C 端店铺品牌展示（只读，不含域名与后台敏感字段） */
export class ClientShopBrandingVo {
  @ApiProperty({ description: '店铺名称' })
  companyName: string;

  @ApiProperty({ required: false, description: 'Logo URL' })
  logoUrl?: string;

  @ApiProperty({ required: false, description: '主题色' })
  themeColor?: string;

  @ApiProperty({ required: false, description: '客服联系人' })
  contactUserName?: string;

  @ApiProperty({ required: false, description: '客服电话' })
  contactPhone?: string;

  @ApiProperty({ required: false, description: '用户服务协议' })
  userAgreement?: string;

  @ApiProperty({ required: false, description: '隐私政策' })
  privacyAgreement?: string;
}
