import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

type QrEnvVersion = 'develop' | 'trial' | 'release';

export class GenerateShareTokenQrcodeDto {
  @ApiProperty({ description: '分享令牌 sid', example: 'DST_ABC123' })
  @IsString()
  @MaxLength(64)
  sid: string;

  @ApiPropertyOptional({ description: '小程序落地页路径', example: 'pages/distribution/entry' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  page?: string;

  @ApiPropertyOptional({ description: '二维码宽度', example: 430, default: 430 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(280)
  width?: number;

  @ApiPropertyOptional({ description: '小程序环境版本', enum: ['develop', 'trial', 'release'], default: 'release' })
  @IsOptional()
  @IsEnum(['develop', 'trial', 'release'])
  envVersion?: QrEnvVersion;
}
