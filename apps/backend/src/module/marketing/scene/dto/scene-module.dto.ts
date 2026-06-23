import { IsIn, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageQueryDto } from 'src/common/dto/base.dto';

export class SaveSceneModuleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() id?: string;
  @ApiProperty() @IsString() moduleCode: string;
  @ApiProperty() @IsString() moduleName: string;
  @ApiProperty() @IsString() moduleType: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() subTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) displayOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) limitSize?: number;
  @ApiProperty() @IsString() sourcePolicyCode: string;
  @ApiProperty() @IsString() resolverPolicyCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sortPolicyCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() audiencePolicyCode?: string;
  @ApiProperty() @IsString() cardTemplateCode: string;
  @ApiPropertyOptional() @IsOptional() @IsString() attributionPolicyCode?: string;
  @ApiPropertyOptional() @IsOptional() uiConfig?: Record<string, unknown>;
  @ApiProperty() @IsIn(['ACTIVE', 'INACTIVE', 'DRAFT']) status: string;
}

export class ListSceneModuleDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() sceneCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() moduleCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'DRAFT']) status?: string;
}
