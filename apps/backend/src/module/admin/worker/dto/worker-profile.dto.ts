import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, WorkerSource, WorkerStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';

const optionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

export class WorkerAddressDto {
  @ApiPropertyOptional({ description: '省编码' })
  @IsOptional()
  @IsString()
  provinceCode?: string;

  @ApiPropertyOptional({ description: '省名称' })
  @IsOptional()
  @IsString()
  provinceName?: string;

  @ApiPropertyOptional({ description: '市编码' })
  @IsOptional()
  @IsString()
  cityCode?: string;

  @ApiPropertyOptional({ description: '市名称' })
  @IsOptional()
  @IsString()
  cityName?: string;

  @ApiPropertyOptional({ description: '区县编码' })
  @IsOptional()
  @IsString()
  districtCode?: string;

  @ApiPropertyOptional({ description: '区县名称' })
  @IsOptional()
  @IsString()
  districtName?: string;

  @ApiPropertyOptional({ description: '详细地址' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressDetail?: string;

  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: '格式化地址' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  formattedAddress?: string;
}

export class WorkerServiceAreaDto extends WorkerAddressDto {}

export class WorkerCertificateDto {
  @ApiProperty({ description: '证书名称' })
  @IsNotEmpty({ message: '证书名称不能为空' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ description: '证书编号' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  certNo?: string;

  @ApiPropertyOptional({ description: '证书图片 URL 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  images?: string[];
}

export class WorkerBasicInfoDto {
  @ApiPropertyOptional({ description: '所属租户 ID；仅超级管理员创建时可传' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '真实姓名' })
  @IsNotEmpty({ message: '姓名不能为空' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickName?: string;

  @ApiProperty({ description: '手机号' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsPhoneNumber('CN', { message: '手机号格式不正确' })
  phone: string;

  @ApiPropertyOptional({ description: '头像 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;

  @ApiPropertyOptional({ description: '性别', enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: '联系地址', type: WorkerAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkerAddressDto)
  address?: WorkerAddressDto;

  @ApiPropertyOptional({ description: '后台备注' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class WorkerWorkInfoDto {
  @ApiProperty({ description: '服务类目 ID 列表', type: [Number] })
  @IsArray()
  @ArrayMinSize(1, { message: '服务类目不能为空' })
  @IsInt({ each: true })
  @Type(() => Number)
  serviceCategoryIds: number[];

  @ApiPropertyOptional({ description: '技能标签', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  skillTags?: string[];

  @ApiProperty({ description: '服务地区', type: WorkerServiceAreaDto })
  @ValidateNested()
  @Type(() => WorkerServiceAreaDto)
  serviceArea: WorkerServiceAreaDto;

  @ApiPropertyOptional({ description: '接单状态', enum: WorkerStatus, default: WorkerStatus.RESTING })
  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @ApiPropertyOptional({ description: '是否在线', default: false })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @ApiPropertyOptional({ description: '服务半径（米）', default: 5000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  serviceRadius?: number;
}

export class WorkerExperienceInfoDto {
  @ApiPropertyOptional({ description: '工作年限' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears?: number;

  @ApiPropertyOptional({ description: '个人简介' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  intro?: string;

  @ApiPropertyOptional({ description: '证书/资质', type: [WorkerCertificateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkerCertificateDto)
  @ArrayMaxSize(20)
  certificates?: WorkerCertificateDto[];

  @ApiPropertyOptional({ description: '审核备注/内部备注' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class CreateWorkerProfileDto {
  @ApiProperty({ description: '基础资料', type: WorkerBasicInfoDto })
  @ValidateNested()
  @Type(() => WorkerBasicInfoDto)
  basicInfo: WorkerBasicInfoDto;

  @ApiProperty({ description: '工作资料', type: WorkerWorkInfoDto })
  @ValidateNested()
  @Type(() => WorkerWorkInfoDto)
  workInfo: WorkerWorkInfoDto;

  @ApiProperty({ description: '工作经历', type: WorkerExperienceInfoDto })
  @ValidateNested()
  @Type(() => WorkerExperienceInfoDto)
  experienceInfo: WorkerExperienceInfoDto;
}

export class UpdateWorkerProfileDto extends CreateWorkerProfileDto {}

export class WorkerProfileQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '所属租户 ID；超级管理员可筛选' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: '姓名/昵称/手机号关键词' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: '接单状态', enum: WorkerStatus })
  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @ApiPropertyOptional({ description: '在线状态' })
  @IsOptional()
  @Transform(optionalBoolean)
  @IsBoolean()
  isOnline?: boolean;

  @ApiPropertyOptional({ description: '来源', enum: WorkerSource })
  @IsOptional()
  @IsEnum(WorkerSource)
  source?: WorkerSource;

  @ApiPropertyOptional({ description: '服务类目 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceCategoryId?: number;
}

export class UpdateWorkerStatusDto {
  @ApiPropertyOptional({ description: '接单状态', enum: WorkerStatus })
  @IsOptional()
  @IsEnum(WorkerStatus)
  status?: WorkerStatus;

  @ApiPropertyOptional({ description: '在线状态' })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;
}
