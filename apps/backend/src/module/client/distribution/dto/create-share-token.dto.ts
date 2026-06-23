import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateShareTokenDto as StoreCreateShareTokenDto } from 'src/module/store/distribution/dto/create-share-token.dto';

export class CreateShareTokenDto extends OmitType(StoreCreateShareTokenDto, ['shareUserId'] as const) {
  @ApiPropertyOptional({ description: '分享落地目标路径', example: '/pages/product/detail?id=1001' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  targetPath?: string;
}
