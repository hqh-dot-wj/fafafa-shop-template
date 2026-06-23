import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { TOUCHPOINT_KIND_VALUES, type TouchpointKind } from './upsert-touchpoint.dto';

export class ListTouchpointDto {
  @ApiPropertyOptional({ description: 'touchpoint kind', enum: TOUCHPOINT_KIND_VALUES })
  @IsOptional()
  @IsIn(TOUCHPOINT_KIND_VALUES)
  kind?: TouchpointKind;

  @ApiPropertyOptional({ description: 'enabled state filter' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isEnabled?: boolean;
}
