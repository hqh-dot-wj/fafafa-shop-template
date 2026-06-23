import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, WorkerApplicationSource, WorkerApplicationStatus, WorkerSource, WorkerStatus } from '@prisma/client';

export class WorkerAddressVo {
  @ApiPropertyOptional({ description: '省编码' })
  provinceCode?: string;

  @ApiPropertyOptional({ description: '省名称' })
  provinceName?: string;

  @ApiPropertyOptional({ description: '市编码' })
  cityCode?: string;

  @ApiPropertyOptional({ description: '市名称' })
  cityName?: string;

  @ApiPropertyOptional({ description: '区县编码' })
  districtCode?: string;

  @ApiPropertyOptional({ description: '区县名称' })
  districtName?: string;

  @ApiPropertyOptional({ description: '详细地址' })
  addressDetail?: string;

  @ApiPropertyOptional({ description: '纬度' })
  lat?: number;

  @ApiPropertyOptional({ description: '经度' })
  lng?: number;

  @ApiPropertyOptional({ description: '格式化地址' })
  formattedAddress?: string;
}

export class WorkerCertificateVo {
  @ApiProperty({ description: '证书名称' })
  name: string;

  @ApiPropertyOptional({ description: '证书编号' })
  certNo?: string;

  @ApiPropertyOptional({ description: '证书图片 URL 列表', type: [String] })
  images?: string[];
}

export class WorkerProfileVo {
  @ApiProperty({ description: '工作者 ID' })
  workerId: number;

  @ApiProperty({ description: '会员 ID' })
  memberId: string;

  @ApiProperty({ description: '所属租户 ID' })
  tenantId: string;

  @ApiProperty({ description: '所属租户名称' })
  tenantName: string;

  @ApiProperty({ description: '工作者姓名' })
  name: string;

  @ApiPropertyOptional({ description: '昵称' })
  nickName?: string;

  @ApiPropertyOptional({ description: '头像 URL' })
  avatar?: string;

  @ApiProperty({ description: '手机号' })
  phone: string;

  @ApiProperty({ description: '性别', enum: Gender })
  gender: Gender;

  @ApiPropertyOptional({ description: '联系地址', type: WorkerAddressVo })
  address?: WorkerAddressVo;

  @ApiProperty({ description: '服务类目 ID', type: [Number] })
  serviceCategoryIds: number[];

  @ApiProperty({ description: '服务类目名称', type: [String] })
  serviceCategoryNames: string[];

  @ApiProperty({ description: '技能标签', type: [String] })
  skillTags: string[];

  @ApiPropertyOptional({ description: '服务地区', type: WorkerAddressVo })
  serviceArea?: WorkerAddressVo;

  @ApiProperty({ description: '接单状态', enum: WorkerStatus })
  status: WorkerStatus;

  @ApiProperty({ description: '在线状态' })
  isOnline: boolean;

  @ApiProperty({ description: '服务半径（米）' })
  serviceRadius: number;

  @ApiProperty({ description: '来源', enum: WorkerSource })
  source: WorkerSource;

  @ApiProperty({ description: '资料完整度' })
  completionScore: number;

  @ApiPropertyOptional({ description: '工作年限' })
  experienceYears?: number;

  @ApiPropertyOptional({ description: '个人简介' })
  intro?: string;

  @ApiProperty({ description: '证书/资质', type: [WorkerCertificateVo] })
  certificates: WorkerCertificateVo[];

  @ApiPropertyOptional({ description: '后台备注' })
  remark?: string;

  @ApiProperty({ description: '入驻时间' })
  createTime: Date;

  @ApiProperty({ description: '最近更新时间' })
  updateTime: Date;
}

export class WorkerApplicationVo {
  @ApiProperty({ description: '申请 ID' })
  applicationId: number;

  @ApiProperty({ description: '目标租户 ID' })
  tenantId: string;

  @ApiProperty({ description: '目标租户名称' })
  tenantName: string;

  @ApiPropertyOptional({ description: '生成的工作者 ID' })
  workerId?: number;

  @ApiProperty({ description: '申请人姓名' })
  name: string;

  @ApiPropertyOptional({ description: '昵称' })
  nickName?: string;

  @ApiProperty({ description: '手机号' })
  phone: string;

  @ApiPropertyOptional({ description: '头像 URL' })
  avatar?: string;

  @ApiProperty({ description: '性别', enum: Gender })
  gender: Gender;

  @ApiPropertyOptional({ description: '联系地址', type: WorkerAddressVo })
  address?: WorkerAddressVo;

  @ApiProperty({ description: '服务类目 ID', type: [Number] })
  serviceCategoryIds: number[];

  @ApiProperty({ description: '服务类目名称', type: [String] })
  serviceCategoryNames: string[];

  @ApiProperty({ description: '技能标签', type: [String] })
  skillTags: string[];

  @ApiPropertyOptional({ description: '服务地区', type: WorkerAddressVo })
  serviceArea?: WorkerAddressVo;

  @ApiProperty({ description: '接单状态', enum: WorkerStatus })
  status: WorkerStatus;

  @ApiProperty({ description: '在线状态' })
  isOnline: boolean;

  @ApiPropertyOptional({ description: '服务半径（米）' })
  serviceRadius?: number;

  @ApiPropertyOptional({ description: '工作年限' })
  experienceYears?: number;

  @ApiPropertyOptional({ description: '个人简介' })
  intro?: string;

  @ApiProperty({ description: '证书/资质', type: [WorkerCertificateVo] })
  certificates: WorkerCertificateVo[];

  @ApiPropertyOptional({ description: '后台备注' })
  remark?: string;

  @ApiProperty({ description: '申请来源', enum: WorkerApplicationSource })
  applicationSource: WorkerApplicationSource;

  @ApiProperty({ description: '申请状态', enum: WorkerApplicationStatus })
  applicationStatus: WorkerApplicationStatus;

  @ApiPropertyOptional({ description: '审核人' })
  reviewBy?: string;

  @ApiPropertyOptional({ description: '审核时间' })
  reviewTime?: Date;

  @ApiPropertyOptional({ description: '审核备注/拒绝原因' })
  reviewRemark?: string;

  @ApiProperty({ description: '提交时间' })
  createTime: Date;

  @ApiProperty({ description: '最近更新时间' })
  updateTime: Date;
}
