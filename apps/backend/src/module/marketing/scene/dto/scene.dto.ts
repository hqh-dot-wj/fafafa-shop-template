import { ArrayNotEmpty, IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageQueryDto } from 'src/common/dto/base.dto';

export class ListSceneDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() sceneCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class ListSceneTemplateDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() templateCode?: string;
  @ApiPropertyOptional({ description: '是否只查询启用模板，true/false 字符串' })
  @IsOptional()
  @IsString()
  isActive?: string;
}

export class SaveSceneDto {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;
  @ApiProperty() @IsString() sceneCode: string;
  @ApiProperty() @IsString() sceneName: string;
  @ApiProperty() @IsString() sceneType: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  channelScope: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() pageRoute?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() defaultCardTemplateCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() defaultResolverPolicyCode?: string;
  @ApiPropertyOptional({
    description: '场景投放配置（如 activityTypeFilter / storeMatchMode / sortMode），与 admin 场景定义页一致',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  placementConfig?: Record<string, unknown>;
  @ApiProperty() @IsIn(['ACTIVE', 'INACTIVE', 'DRAFT']) status: string;
}

export class CreateSceneFromTemplateDto {
  @ApiProperty() @IsString() templateCode: string;
  @ApiProperty() @IsString() sceneCode: string;
  @ApiProperty() @IsString() sceneName: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'DRAFT']) status?: string;
  @ApiPropertyOptional({
    description: '模板继承覆盖项，支持 scene 字段和 modules.{moduleSlot} 覆盖',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  overrides?: Record<string, unknown>;
}

export class SyncSceneFromTemplateDto {
  @ApiProperty({ type: [String], description: '同步字段，如 placementConfig 或 modules.*.cardTemplateCode' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  fields: string[];
}
