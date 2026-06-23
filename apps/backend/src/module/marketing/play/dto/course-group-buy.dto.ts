import { IsNumber, IsOptional, IsString, IsBoolean, IsDateString, Min, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 课程拼团规则 DTO
 */
export class CourseGroupBuyRulesDto {
  @ApiProperty({ description: '拼团价格' })
  @IsNumber()
  @Min(0.01, { message: '价格必须大于0' })
  price: number;

  @ApiProperty({ description: '最小成团人数', default: 2 })
  @IsNumber()
  @Min(2, { message: '最小成团人数不能少于2人' })
  minCount: number;

  @ApiProperty({ description: '最大成团人数' })
  @IsOptional()
  @IsNumber()
  maxCount?: number;

  @ApiProperty({ description: '总课时数' })
  @IsNumber()
  @Min(1, { message: '总课时数必须大于0' })
  totalLessons: number;

  @ApiProperty({ description: '每天课时数', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: '每天课时数必须大于0' })
  dayLessons?: number;

  @ApiProperty({ description: '有效期(天)' })
  @IsOptional()
  @IsNumber()
  validDays?: number;

  @ApiProperty({ description: '报名截止时间' })
  @IsOptional()
  @IsDateString({}, { message: '报名截止时间格式不正确' })
  joinDeadline?: string;

  @ApiProperty({ description: '上课开始时间' })
  @IsOptional()
  @IsDateString({}, { message: '上课开始时间格式不正确' })
  classStartTime?: string;

  @ApiProperty({ description: '上课结束时间' })
  @IsOptional()
  @IsDateString({}, { message: '上课结束时间格式不正确' })
  classEndTime?: string;

  @ApiProperty({ description: '上课地址' })
  @IsOptional()
  @IsString()
  classAddress?: string;

  @ApiProperty({ description: '团长优惠金额' })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: '团长优惠金额不能为负数' })
  leaderDiscount?: number;

  @ApiProperty({ description: '团长是否免单' })
  @IsOptional()
  @IsBoolean()
  leaderFree?: boolean;

  @ApiProperty({ description: '团长必须是分销员' })
  @IsOptional()
  @IsBoolean()
  leaderMustBeDistributor?: boolean;

  @ApiProperty({ description: '是否启用虚拟补位', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  enableVirtualFill?: boolean;

  @ApiProperty({ description: '自动补位触发窗口（分钟）', required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: '自动补位触发窗口不能为负数' })
  virtualFillWindowMinutes?: number;

  @ApiProperty({ description: '是否允许团长手动补位', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  allowLeaderManualFill?: boolean;

  @ApiProperty({ description: '是否允许后台手动补位', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  allowAdminManualFill?: boolean;

  @ApiProperty({ description: '成团后是否继续招募真实用户', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  continueRecruitAfterFormed?: boolean;

  @ApiProperty({ description: '成团后招募模式', required: false, enum: ['REAL_ONLY', 'CLOSE_ALL'] })
  @IsOptional()
  @IsString()
  @IsIn(['REAL_ONLY', 'CLOSE_ALL'], { message: '成团后招募模式不正确' })
  postFormedRecruitMode?: 'REAL_ONLY' | 'CLOSE_ALL';

  @ApiProperty({ description: '团长是否可查看虚拟成员明细', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  leaderCanInspectVirtualMembers?: boolean;
}

/**
 * 课程拼团参与 DTO
 */
export class CourseGroupBuyJoinDto {
  @ApiProperty({ description: '要加入的团ID (父实例ID)', required: false })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({ description: '是否为团长', required: false })
  @IsOptional()
  @IsBoolean()
  isLeader?: boolean;
}
