import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateContentDto {
  @ApiProperty({ description: '平台标识', example: 'XIAOHONGSHU' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  platformCode: string;

  @ApiProperty({ description: '用户输入的主题/关键词', example: '周末咖啡探店' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  userInput: string;
}
