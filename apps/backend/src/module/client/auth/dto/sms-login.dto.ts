import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class SendMemberLoginCodeDto {
  @ApiProperty({ description: '手机号' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  mobile: string;

  @ApiProperty({ description: '租户 ID', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class LoginOrRegisterBySmsDto {
  @ApiProperty({ description: '手机号' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  mobile: string;

  @ApiProperty({ description: '短信验证码' })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString()
  code: string;

  @ApiProperty({ description: '租户 ID', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '推荐人会员 ID', required: false })
  @IsOptional()
  @IsString()
  referrerId?: string;
}
