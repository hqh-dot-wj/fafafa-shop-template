import { DistShareEventType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';

export class ListShareTokenLogDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '分享令牌 sid', example: 'DST_ABC123' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sid?: string;

  @ApiPropertyOptional({ description: '会员ID（命中人）', example: 'member_001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  memberId?: string;

  @ApiPropertyOptional({ description: '事件类型', enum: DistShareEventType })
  @IsOptional()
  @IsEnum(DistShareEventType)
  eventType?: DistShareEventType;
}
