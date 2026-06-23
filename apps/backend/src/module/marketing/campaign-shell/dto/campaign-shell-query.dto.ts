import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CampaignShellQueryDto {
  @ApiProperty({ description: '营销活动ID' })
  @IsString()
  @MaxLength(64)
  campaignId: string;
}
