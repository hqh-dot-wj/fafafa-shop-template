import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class ListTemplateVersionDto {
  @ApiProperty({ description: '分类ID' })
  @Type(() => Number)
  @IsInt()
  categoryId: number;
}
