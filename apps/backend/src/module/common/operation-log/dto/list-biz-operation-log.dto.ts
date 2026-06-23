import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';

/** 订单维度查询业务操作日志 */
export class ListOrderBizOperationLogDto extends PageQueryDto {
  @ApiProperty({ description: '订单 ID' })
  @IsNotEmpty({ message: '订单 ID 不能为空' })
  @IsString()
  orderId: string;
}

/** 会员维度查询业务操作日志 */
export class ListMemberBizOperationLogDto extends PageQueryDto {
  @ApiProperty({ description: '会员 ID' })
  @IsNotEmpty({ message: '会员 ID 不能为空' })
  @IsString()
  memberId: string;
}
