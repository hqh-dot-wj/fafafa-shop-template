import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class ImportTemplateQueryDto {
  @ApiProperty({ description: '分类ID' })
  @Type(() => Number)
  @IsInt()
  categoryId: number;

  @ApiProperty({ description: '模板版本ID', required: false })
  @IsOptional()
  @IsString()
  templateVersionId?: string;
}
