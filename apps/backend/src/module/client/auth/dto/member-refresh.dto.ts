import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MemberRefreshDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsNotEmpty({ message: 'refresh_token 不能为空' })
  @IsString()
  refresh_token: string;
}
