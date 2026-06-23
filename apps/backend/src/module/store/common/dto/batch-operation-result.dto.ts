import { ApiProperty } from '@nestjs/swagger';

/**
 * 店铺域批量操作单条结果（订单 ID / SKU ID / 选品 productId 等统一用 id）
 */
export class BatchOperationResultItem {
  @ApiProperty({ description: '业务主键（订单 ID、租户 SKU ID、选品 productId 等）' })
  id: string;

  @ApiProperty({ description: '是否成功' })
  success: boolean;

  @ApiProperty({ description: '失败原因', required: false })
  error?: string;
}

/**
 * 店铺域批量操作统一回执（订单核销/退款/备注、商品批量导入调价、库存批量调整等）
 */
export class BatchOperationResult {
  @ApiProperty({ description: '成功数量' })
  successCount: number;

  @ApiProperty({ description: '失败数量' })
  failCount: number;

  @ApiProperty({ description: '逐条明细', type: [BatchOperationResultItem] })
  details: BatchOperationResultItem[];
}
