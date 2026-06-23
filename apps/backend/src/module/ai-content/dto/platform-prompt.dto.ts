import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageQueryDto } from 'src/common/dto/base.dto';

export class CreatePlatformPromptDto {
  @ApiProperty({ description: '平台标识', example: 'XIAOHONGSHU' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  platformCode: string;

  @ApiProperty({ description: '平台名称', example: '小红书' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  platformName: string;

  @ApiPropertyOptional({ description: '平台图标 URL' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  icon?: string;

  @ApiProperty({ description: 'System Prompt 模板' })
  @IsString()
  @IsNotEmpty()
  systemPrompt: string;

  @ApiProperty({ description: 'AI 输出的 JSON 结构描述' })
  @IsObject()
  @IsNotEmpty()
  outputSchema: Record<string, unknown>;

  @ApiPropertyOptional({ description: '建议字数上限' })
  @IsInt()
  @IsOptional()
  @Min(1)
  maxLength?: number;

  @ApiPropertyOptional({ description: '排序', default: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpdatePlatformPromptDto {
  @ApiPropertyOptional({ description: '平台名称' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  platformName?: string;

  @ApiPropertyOptional({ description: '平台图标 URL' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  icon?: string;

  @ApiPropertyOptional({ description: 'System Prompt 模板' })
  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'AI 输出的 JSON 结构描述' })
  @IsObject()
  @IsOptional()
  outputSchema?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '建议字数上限' })
  @IsInt()
  @IsOptional()
  @Min(1)
  maxLength?: number;

  @ApiPropertyOptional({ description: '排序' })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class ListPlatformPromptDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '平台标识' })
  @IsString()
  @IsOptional()
  platformCode?: string;

  @ApiPropertyOptional({ description: '状态：0=停用 1=启用' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  status?: number;
}

export class UpdateStatusDto {
  @ApiProperty({ description: '状态：0=停用 1=启用' })
  @IsInt()
  @Min(0)
  @Max(1)
  status: number;
}
