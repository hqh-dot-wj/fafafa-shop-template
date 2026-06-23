import { ApiProperty } from '@nestjs/swagger';
import { MktEntitlementPoolStatus, MktEntitlementPoolType } from '@prisma/client';

export class EntitlementPoolVo {
  @ApiProperty({ description: '权益池ID' })
  id: string;

  @ApiProperty({ description: '权益池名称' })
  name: string;

  @ApiProperty({ description: '权益池类型', enum: MktEntitlementPoolType })
  poolType: MktEntitlementPoolType;

  @ApiProperty({ description: '状态', enum: MktEntitlementPoolStatus })
  status: MktEntitlementPoolStatus;

  @ApiProperty({ description: 'Owner', example: 'marketing coupon' })
  owner: string;

  @ApiProperty({ description: '触点', type: [String] })
  touchpoints: string[];

  @ApiProperty({ description: '商品来源类型', required: false })
  sourceType?: string | null;

  @ApiProperty({ description: '来源标识', required: false })
  sourceKey?: string | null;

  @ApiProperty({ description: '会员ID', required: false })
  memberId?: string | null;

  @ApiProperty({ description: '券模板ID', required: false })
  templateId?: string | null;

  @ApiProperty({ description: '券模板名称', required: false })
  templateName?: string | null;

  @ApiProperty({ description: '积分任务ID', required: false })
  taskId?: string | null;

  @ApiProperty({ description: '积分任务名称', required: false })
  taskName?: string | null;

  @ApiProperty({ description: '编译产物', type: [String] })
  compileArtifacts: string[];

  @ApiProperty({ description: '风险摘要', type: [String] })
  riskSummary: string[];

  @ApiProperty({ description: '编译预览', required: false, type: Object })
  compilePreview?: Record<string, unknown>;

  @ApiProperty({ description: '更新时间' })
  updatedAt: string;

  @ApiProperty({ description: '最近编译时间', required: false })
  lastCompiledAt?: string | null;
}

export class EntitlementPoolPageVo {
  @ApiProperty({ description: '列表', type: [EntitlementPoolVo] })
  rows: EntitlementPoolVo[];

  @ApiProperty({ description: '总数' })
  total: number;

  @ApiProperty({ description: '页码' })
  pageNum: number;

  @ApiProperty({ description: '每页条数' })
  pageSize: number;

  @ApiProperty({ description: '总页数' })
  pages: number;
}

