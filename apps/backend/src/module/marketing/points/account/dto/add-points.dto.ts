import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PointsTransactionTypeApi } from '../../constants/points-transaction-type-api.enum';

/**
 * 增加积分 DTO
 *
 * @description 用于增加用户积分
 */
export class AddPointsDto {
  @ApiProperty({ description: '用户ID' })
  @IsString()
  memberId: string;

  @ApiProperty({ description: '积分数量', example: 100 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: '交易类型', enum: PointsTransactionTypeApi })
  @IsEnum(PointsTransactionTypeApi)
  type: string;

  @ApiProperty({ description: '关联ID（订单ID、任务ID等）', required: false })
  @IsOptional()
  @IsString()
  relatedId?: string;

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;

  /**
   * 过期时间显式语义：
   * - 未携带该字段（undefined）：由 PointsAccountService 按租户 `MktPointsRule` 推导
   * - 显式传 null：覆盖规则，标记为永久有效
   * - 显式传 Date：直接采用
   */
  @ApiProperty({
    description: '过期时间。不传则按租户积分规则推导；显式传 null 表示永久；显式传 Date 直接采用',
    required: false,
    nullable: true,
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  expireTime?: Date | null;
}
