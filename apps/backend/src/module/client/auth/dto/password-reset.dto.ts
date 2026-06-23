import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class SendMemberResetCodeDto {
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

export class MemberResetPasswordDto {
  @ApiProperty({ description: '手机号' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  mobile: string;

  @ApiProperty({ description: '短信验证码' })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString()
  code: string;

  @ApiProperty({ description: '新密码' })
  @IsNotEmpty({ message: '新密码不能为空' })
  @IsString()
  newPassword: string;

  @ApiProperty({ description: '租户 ID', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class MemberSetPasswordDto {
  @ApiProperty({ description: '新密码' })
  @IsNotEmpty({ message: '新密码不能为空' })
  @IsString()
  newPassword: string;
}
