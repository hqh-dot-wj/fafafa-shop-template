import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';

class PlayTemplateWriteDto {
  @ApiProperty({ description: '模板名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '计量单位' })
  @IsString()
  @IsNotEmpty()
  unitName: string;

  @ApiProperty({ description: '规则 Schema 配置', type: 'object', additionalProperties: true })
  @IsObject()
  @IsNotEmpty()
  ruleSchema: Record<string, unknown>;

  @ApiPropertyOptional({ description: '详情交互模板标识', type: String, nullable: true })
  @IsOptional()
  @IsString()
  uiComponentId?: string;
}

export class CreatePlayTemplateDto extends PlayTemplateWriteDto {}

export class UpdatePlayTemplateDto extends PlayTemplateWriteDto {}

export class ListPlayTemplateDto extends PageQueryDto {
  @ApiProperty({ description: '模板名称', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '模板编码', required: false })
  @IsOptional()
  @IsString()
  code?: string;
}
