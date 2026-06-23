import { ApiProperty } from '@nestjs/swagger';

/** 会员双令牌（access + refresh） */
export class MemberDualTokenVo {
  @ApiProperty({ description: '访问令牌' })
  access_token: string;

  @ApiProperty({ description: '刷新令牌' })
  refresh_token: string;

  @ApiProperty({ description: '访问令牌过期时间（秒）' })
  expire_in: number;

  @ApiProperty({ description: '刷新令牌过期时间（秒）' })
  refresh_expire_in: number;
}
