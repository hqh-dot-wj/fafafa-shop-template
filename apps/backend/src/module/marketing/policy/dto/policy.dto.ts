import { IsString, IsArray, IsOptional, IsIn, IsObject, IsNotEmpty, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageQueryDto } from 'src/common/dto/base.dto';

const VALID_POLICY_TYPES = ['SOURCE', 'RESOLVER', 'AUDIENCE', 'SORT', 'CARD_TEMPLATE'] as const;

export class SaveSourcePolicyDto {
  @ApiProperty() @IsString() policyCode: string;
  @ApiProperty() @IsString() policyName: string;
  @ApiProperty({ type: [Object] }) @IsArray() clauses: Record<string, unknown>[];
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class SaveResolverPolicyDto {
  @ApiProperty() @IsString() policyCode: string;
  @ApiProperty() @IsString() policyName: string;
  @ApiProperty({ type: [String] }) @IsArray() primaryOfferTypes: string[];
  @ApiProperty() @IsObject() @IsNotEmpty() conflictMatrix: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class SaveAudiencePolicyDto {
  @ApiProperty() @IsString() policyCode: string;
  @ApiProperty() @IsString() policyName: string;
  @ApiProperty() @IsObject() @IsNotEmpty() rules: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class SaveSortPolicyDto {
  @ApiProperty() @IsString() policyCode: string;
  @ApiProperty() @IsString() policyName: string;
  @ApiProperty({ type: [Object] }) @IsArray() @ArrayMinSize(1) sortRules: Record<string, unknown>[];
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class SaveCardTemplateDto {
  @ApiProperty() @IsString() policyCode: string;
  @ApiProperty() @IsString() policyName: string;
  @ApiProperty() @IsObject() @IsNotEmpty() templateConfig: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}

export class ListPolicyDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(VALID_POLICY_TYPES) policyType?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
}
