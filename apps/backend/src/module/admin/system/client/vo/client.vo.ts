import { ApiProperty } from '@nestjs/swagger';

/** OAuth 客户端列表项（与后台管理端约定字段） */
export class ClientVo {
  @ApiProperty({ description: '主键' })
  id: number;

  @ApiProperty({ description: '客户端业务 ID' })
  clientId: string;

  @ApiProperty({ description: '客户端 key' })
  clientKey: string;

  @ApiProperty({ description: '客户端秘钥' })
  clientSecret: string;

  @ApiProperty({ description: '主授权类型（取列表首项）' })
  grantType: string;

  @ApiProperty({ description: '授权类型列表', type: [String] })
  grantTypeList: string[];

  @ApiProperty({ description: '设备类型' })
  deviceType: string;

  @ApiProperty({ description: '活跃超时（秒）' })
  activeTimeout: number;

  @ApiProperty({ description: '固定超时（秒）' })
  timeout: number;

  @ApiProperty({ description: '状态 0 正常 1 停用' })
  status: string;

  @ApiProperty({ description: '删除标志 0 正常 1 删除' })
  delFlag: string;
}

export class ClientListVo {
  @ApiProperty({ type: [ClientVo] })
  rows: ClientVo[];

  @ApiProperty()
  total: number;

  @ApiProperty({ required: false })
  pageNum?: number;

  @ApiProperty({ required: false })
  pageSize?: number;

  @ApiProperty({ required: false })
  pages?: number;
}
