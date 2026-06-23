import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ResolveShareTokenDto {
  @ApiProperty({ description: '分享凭证 sid', example: 'DST_ABCD1234' })
  @IsString()
  @MaxLength(64)
  sid: string;
}
