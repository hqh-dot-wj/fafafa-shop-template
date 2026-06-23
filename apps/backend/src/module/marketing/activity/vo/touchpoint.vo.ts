import { ApiProperty } from '@nestjs/swagger';
import { MktTouchpointKind } from '@prisma/client';

export class TouchpointVo {
  @ApiProperty({ description: 'touchpoint id' })
  id: string;

  @ApiProperty({ description: 'tenant id' })
  tenantId: string;

  @ApiProperty({ description: 'activity id' })
  activityId: string;

  @ApiProperty({ description: 'touchpoint kind', enum: ['MESSAGE', 'SHARE'] })
  kind: MktTouchpointKind;

  @ApiProperty({ description: 'touchpoint code' })
  code: string;

  @ApiProperty({ description: 'touchpoint name' })
  name: string;

  @ApiProperty({ description: 'touchpoint config' })
  config: Record<string, unknown>;

  @ApiProperty({ description: 'whether touchpoint is enabled' })
  isEnabled: boolean;

  @ApiProperty({ description: 'created at' })
  createTime: string;

  @ApiProperty({ description: 'updated at' })
  updateTime: string;
}
