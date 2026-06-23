import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * 管理员调整会员积分 DTO
 */
export class AdjustMemberPointsDto {
  @ApiProperty({ description: '会员 ID' })
  @IsNotEmpty({ message: '会员 ID 不能为空' })
  @IsString()
  memberId: string;

  @ApiProperty({ description: '变动积分（正数增加，负数扣减，不能为 0）' })
  @IsNotEmpty({ message: '变动积分不能为空' })
  @IsInt()
  amount: number;

  @ApiPropertyOptional({ description: '备注/调整原因' })
  @IsOptional()
  @IsString()
  remark?: string;

  /**
   * 过期时间显式语义同 AddPointsDto.expireTime；
   * 仅在 amount>0（EARN_ADMIN）时生效，扣减场景由消费分摊推导，传入会被忽略。
   */
  @ApiPropertyOptional({
    description: '加分场景的过期时间。不传按租户积分规则推导；null 表示永久；Date 直接采用',
    nullable: true,
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  expireTime?: Date | null;
}
