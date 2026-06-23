import { ApiProperty } from '@nestjs/swagger';
import { ClientUserVo } from '../../user/vo';

export class LoginResultVo {
  @ApiProperty({ description: '是否已注册(true:已注册且返回Token, false:未注册)' })
  isRegistered: boolean;

  @ApiProperty({ description: '访问令牌', required: false })
  access_token?: string;

  @ApiProperty({ description: '刷新令牌', required: false })
  refresh_token?: string;

  @ApiProperty({ description: '访问令牌过期时间（秒）', required: false })
  expire_in?: number;

  @ApiProperty({ description: '刷新令牌过期时间（秒）', required: false })
  refresh_expire_in?: number;

  @ApiProperty({ description: '登录Token（兼容旧客户端，同 access_token）', required: false })
  token?: string;

  @ApiProperty({ description: '过期秒数（兼容旧字段，同 expire_in）', required: false })
  expiresIn?: number;

  @ApiProperty({ description: '用户信息', required: false })
  userInfo?: ClientUserVo;

  @ApiProperty({ description: '是否新注册用户（微信注册等）', required: false })
  isNew?: boolean;
}
