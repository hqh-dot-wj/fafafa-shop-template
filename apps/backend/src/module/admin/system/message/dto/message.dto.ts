import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PageQueryDto } from 'src/common/dto';

export class ListMessageDto extends PageQueryDto {
  @ApiProperty({ description: '消息类型', required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ description: '读取状态', required: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isRead?: boolean;

  @ApiProperty({
    description: '为 true 时仅返回 receiverId 为当前管理员 userId 或当前租户 ID 的站内信（管理端收件箱）',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  adminInbox?: boolean;
}

export class CreateMessageDto {
  @ApiProperty({ description: '标题' })
  @IsString()
  title: string;

  @ApiProperty({ description: '内容', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: '类型' })
  @IsString()
  type: string;

  @ApiProperty({
    description:
      '站内信接收目标。纯数字字符串表示后台 userId；与 tenantId 相同表示租户级广播，由当前租户下所有在线管理端共同接收。',
  })
  @IsString()
  receiverId: string;

  @ApiProperty({ description: '租户ID' })
  @IsString()
  tenantId: string;
}
