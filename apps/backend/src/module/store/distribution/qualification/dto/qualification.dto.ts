import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  DistDistributorProfileStatus,
  DistLv0RewardMode,
  DistPendingRewardStatus,
  DistQualificationApplicationStatus,
  DistQualificationEvidenceStatus,
  DistRelationStatus,
  DistServicePolicyTargetType,
} from '@prisma/client';
import { PageQueryDto } from 'src/common/dto/base.dto';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

export class ListServicePolicyDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '目标类型', enum: DistServicePolicyTargetType })
  @IsOptional()
  @IsEnum(DistServicePolicyTargetType)
  targetType?: DistServicePolicyTargetType;

  @ApiPropertyOptional({ description: '目标ID' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: '是否可作为资格材料' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  qualificationEligible?: boolean;

  @ApiPropertyOptional({ description: '是否可分佣' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  commissionEligible?: boolean;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertServicePolicyDto {
  @ApiProperty({ description: '目标类型', enum: DistServicePolicyTargetType })
  @IsEnum(DistServicePolicyTargetType)
  targetType: DistServicePolicyTargetType;

  @ApiProperty({ description: '目标ID' })
  @IsString()
  @Length(1, 64)
  targetId: string;

  @ApiProperty({ description: '是否可分佣' })
  @IsBoolean()
  commissionEligible: boolean;

  @ApiProperty({ description: '是否可作为资格材料' })
  @IsBoolean()
  qualificationEligible: boolean;

  @ApiPropertyOptional({ description: '普通用户是否允许分享', default: false })
  @IsOptional()
  @IsBoolean()
  allowLv0Share?: boolean;

  @ApiPropertyOptional({ description: '普通用户待激活收益模式', enum: DistLv0RewardMode })
  @IsOptional()
  @IsEnum(DistLv0RewardMode)
  lv0RewardMode?: DistLv0RewardMode;

  @ApiPropertyOptional({ description: '是否需要风险确认', default: false })
  @IsOptional()
  @IsBoolean()
  requireRiskConfirm?: boolean;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListQualificationRuleDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '目标等级' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  targetLevelId?: number;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertQualificationRuleDto {
  @ApiProperty({ description: '目标等级，1=C1，2=C2' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  targetLevelId: number;

  @ApiPropertyOptional({ description: '所需材料数量', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requiredEvidenceCount?: number;

  @ApiPropertyOptional({ description: '限定服务策略ID', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  requiredServicePolicyIds?: number[];

  @ApiPropertyOptional({ description: '是否需要人工审核', default: true })
  @IsOptional()
  @IsBoolean()
  requireManualReview?: boolean;

  @ApiPropertyOptional({ description: '最低服务订单金额', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({ description: '最小注册天数', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minRegisterDays?: number;

  @ApiPropertyOptional({ description: '是否要求实名', default: false })
  @IsOptional()
  @IsBoolean()
  requireRealName?: boolean;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListEvidenceDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '会员ID' })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional({ description: '订单ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: '材料状态', enum: DistQualificationEvidenceStatus })
  @IsOptional()
  @IsEnum(DistQualificationEvidenceStatus)
  evidenceStatus?: DistQualificationEvidenceStatus;
}

export class ListMyEvidenceDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '材料状态', enum: DistQualificationEvidenceStatus })
  @IsOptional()
  @IsEnum(DistQualificationEvidenceStatus)
  evidenceStatus?: DistQualificationEvidenceStatus;
}

export class SubmitQualificationApplicationDto {
  @ApiProperty({ description: '目标等级，1=C1，2=C2' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  targetLevelId: number;

  @ApiProperty({ description: '用于申请的材料ID', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  evidenceIds: string[];

  @ApiPropertyOptional({ description: '申请说明' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  applyReason?: string;
}

export enum QualificationReviewResult {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class ReviewQualificationApplicationDto {
  @ApiProperty({ description: '审核结果', enum: QualificationReviewResult })
  @IsEnum(QualificationReviewResult)
  result: QualificationReviewResult;

  @ApiPropertyOptional({ description: '审核备注' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}

export class ListQualificationApplicationDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '会员ID' })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional({ description: '目标等级' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  targetLevelId?: number;

  @ApiPropertyOptional({ description: '申请状态', enum: DistQualificationApplicationStatus })
  @IsOptional()
  @IsEnum(DistQualificationApplicationStatus)
  status?: DistQualificationApplicationStatus;
}

export class ListDistributorProfileDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '会员ID' })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional({ description: '等级' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  levelId?: number;

  @ApiPropertyOptional({ description: '档案状态', enum: DistDistributorProfileStatus })
  @IsOptional()
  @IsEnum(DistDistributorProfileStatus)
  status?: DistDistributorProfileStatus;
}

export class UpdateProfileStatusDto {
  @ApiPropertyOptional({ description: '原因' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  reason?: string;
}

export class ListDistributionRelationDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '分销员会员ID' })
  @IsOptional()
  @IsString()
  distributorMemberId?: string;

  @ApiPropertyOptional({ description: '团队归属C2会员ID' })
  @IsOptional()
  @IsString()
  teamOwnerMemberId?: string;

  @ApiPropertyOptional({ description: '邀请人会员ID' })
  @IsOptional()
  @IsString()
  inviterMemberId?: string;

  @ApiPropertyOptional({ description: '关系状态', enum: DistRelationStatus })
  @IsOptional()
  @IsEnum(DistRelationStatus)
  status?: DistRelationStatus;
}

export class ListPendingRewardDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '会员ID' })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional({ description: '订单ID' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional({ description: '待激活收益状态', enum: DistPendingRewardStatus })
  @IsOptional()
  @IsEnum(DistPendingRewardStatus)
  status?: DistPendingRewardStatus;
}
