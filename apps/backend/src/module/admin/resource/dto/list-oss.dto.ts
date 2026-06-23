import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 管理端「对象存储」列表查询（与 admin-web /resource/oss/list 对齐）
 */
export class ListOssDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageNum?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  orderByColumn?: string;

  @ApiProperty({ required: false, enum: ['ascending', 'descending'] })
  @IsOptional()
  @IsIn(['ascending', 'descending'])
  isAsc?: 'ascending' | 'descending';

  @ApiProperty({ required: false, description: '文件名（匹配存储名或原名）' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({ required: false, description: '原名' })
  @IsOptional()
  @IsString()
  originalName?: string;

  @ApiProperty({ required: false, description: '后缀，如 .png' })
  @IsOptional()
  @IsString()
  fileSuffix?: string;

  @ApiProperty({ required: false, description: '服务商：本地 / 阿里云' })
  @IsOptional()
  @IsString()
  service?: string;
}
