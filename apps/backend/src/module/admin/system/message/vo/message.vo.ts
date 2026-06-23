import { ApiProperty } from '@nestjs/swagger';

export class MessageVo {
  @ApiProperty({ description: '消息ID' })
  id: number;

  @ApiProperty({ description: '标题' })
  title: string;

  @ApiProperty({ description: '内容' })
  content?: string;

  @ApiProperty({ description: '类型' })
  type: string;

  @ApiProperty({
    description: '站内信接收目标。纯数字字符串表示后台 userId；与 tenantId 相同表示租户级广播。',
  })
  receiverId: string;

  @ApiProperty({ description: '是否已读' })
  isRead: boolean;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;
}
