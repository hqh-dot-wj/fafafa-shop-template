import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class MemberPasswordLoginDto {
  @ApiProperty({ description: '手机号' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsString()
  @Matches(/^1\d{10}$/, { message: '手机号格式不正确' })
  mobile: string;

  @ApiProperty({ description: '密码' })
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  password: string;

  @ApiProperty({ description: '租户 ID', required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
