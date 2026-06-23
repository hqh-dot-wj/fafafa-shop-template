import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BizOperationLogVo {
  @ApiProperty({ description: '日志 ID' })
  id: string;

  @ApiProperty({ description: '操作人账号' })
  operatorName: string;

  @ApiProperty({ description: '动作编码' })
  action: string;

  @ApiProperty({ description: '目标类型 ORDER/MEMBER' })
  targetType: string;

  @ApiProperty({ description: '目标主键' })
  targetId: string;

  @ApiPropertyOptional({ description: '详情 JSON 字符串' })
  detail: string | null;

  @ApiProperty({ description: '操作时间' })
  createTime: string;
}
