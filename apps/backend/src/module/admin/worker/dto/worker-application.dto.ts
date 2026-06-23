import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkerApplicationSource, WorkerApplicationStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';

export class WorkerApplicationQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '目标租户 ID；超级管理员可筛选' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: '申请人姓名/手机号关键词' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: '申请状态', enum: WorkerApplicationStatus })
  @IsOptional()
  @IsEnum(WorkerApplicationStatus)
  applicationStatus?: WorkerApplicationStatus;

  @ApiPropertyOptional({ description: '申请来源', enum: WorkerApplicationSource })
  @IsOptional()
  @IsEnum(WorkerApplicationSource)
  applicationSource?: WorkerApplicationSource;
}

export class ApproveWorkerApplicationDto {
  @ApiPropertyOptional({ description: '审核备注' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewRemark?: string;
}

export class RejectWorkerApplicationDto {
  @ApiProperty({ description: '拒绝原因' })
  @IsNotEmpty({ message: '拒绝原因不能为空' })
  @IsString()
  @MaxLength(500)
  reviewRemark: string;
}
