import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export const TOUCHPOINT_KIND_VALUES = ['MESSAGE', 'SHARE'] as const;
export type TouchpointKind = (typeof TOUCHPOINT_KIND_VALUES)[number];

export class UpsertTouchpointDto {
  @ApiProperty({ description: 'touchpoint kind', enum: TOUCHPOINT_KIND_VALUES })
  @IsString()
  @IsIn(TOUCHPOINT_KIND_VALUES)
  kind: TouchpointKind;

  @ApiProperty({ description: 'touchpoint code', maxLength: 60 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  code: string;

  @ApiProperty({ description: 'touchpoint name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'touchpoint config JSON' })
  @IsObject()
  config: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'whether touchpoint is enabled' })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
