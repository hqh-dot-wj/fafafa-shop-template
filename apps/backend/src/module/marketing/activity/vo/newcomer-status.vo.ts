import { ApiProperty } from '@nestjs/swagger';

export class NewcomerStatusVo {
  @ApiProperty({ description: '是否为新人' })
  isNewcomer: boolean;

  @ApiProperty({ description: '是否已领取礼包' })
  hasClaimed: boolean;

  @ApiProperty({ description: '活动是否启用' })
  activityEnabled: boolean;
}

export class NewcomerStatisticsVo {
  @ApiProperty({ description: '活动ID' })
  activityId: string;

  @ApiProperty({ description: '参与总人数' })
  totalParticipants: number;

  @ApiProperty({ description: '活动是否启用' })
  isEnabled: boolean;
}
