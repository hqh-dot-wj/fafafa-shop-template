import { ApiProperty } from '@nestjs/swagger';
import { SettlementChannelType, SettlementProfileStatus, SettlementReceiverType } from '@prisma/client';

export class TenantVo {
  @ApiProperty({ description: '租户ID' })
  id: number;

  @ApiProperty({ description: '租户编号' })
  tenantId: string;

  @ApiProperty({ description: '联系人' })
  contactUserName?: string;

  @ApiProperty({ description: '联系电话' })
  contactPhone?: string;

  @ApiProperty({ description: '企业名称' })
  companyName: string;

  @ApiProperty({ description: '统一社会信用代码' })
  licenseNumber?: string;

  @ApiProperty({ description: '地址' })
  address?: string;

  @ApiProperty({ description: '企业简介' })
  intro?: string;

  @ApiProperty({ description: '域名' })
  domain?: string;

  @ApiProperty({ description: '租户套餐ID' })
  packageId?: number;

  @ApiProperty({ description: '租户套餐名称' })
  packageName?: string;

  @ApiProperty({ description: '过期时间' })
  expireTime?: Date;

  @ApiProperty({ description: '账号数量' })
  accountCount: number;

  @ApiProperty({ description: '状态(0正常 1停用)' })
  status: string;

  @ApiProperty({ description: '创建者' })
  createBy: string;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiProperty({ description: '更新者' })
  updateBy: string;

  @ApiProperty({ description: '更新时间' })
  updateTime: Date;

  @ApiProperty({ description: '备注' })
  remark?: string;

  @ApiProperty({ description: '是否启用结算配置', required: false })
  settlementEnabled?: boolean;

  @ApiProperty({ description: '默认结算通道', enum: SettlementChannelType, required: false })
  settlementChannel?: SettlementChannelType;

  @ApiProperty({ description: '接收方类型', enum: SettlementReceiverType, required: false })
  settlementReceiverType?: SettlementReceiverType;

  @ApiProperty({ description: '接收方账号', required: false })
  settlementReceiverAccount?: string;

  @ApiProperty({ description: '接收方名称', required: false })
  settlementReceiverName?: string;

  @ApiProperty({ description: '银行名称', required: false })
  settlementBankName?: string;

  @ApiProperty({ description: '银行卡号', required: false })
  settlementBankAccountNo?: string;

  @ApiProperty({ description: '是否需要人工审核', required: false })
  settlementNeedManualReview?: boolean;

  @ApiProperty({ description: '结算配置状态', enum: SettlementProfileStatus, required: false })
  settlementStatus?: SettlementProfileStatus;

  @ApiProperty({ description: '结算备注', required: false })
  settlementRemark?: string;
}

export class TenantListVo {
  @ApiProperty({ type: [TenantVo] })
  rows: TenantVo[];

  @ApiProperty({ description: '总数' })
  total: number;
}
