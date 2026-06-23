import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 营销动态表单 Schema 响应（policy / play / scene-template 三个接口共用）。
 *
 * 内部递归结构（properties/items 嵌套）在 OpenAPI 里用 additionalProperties: true
 * 的松散 object 表达：前端只需把整段 schema 透传给表单渲染器，不需要类型层递归推导。
 * 之前 admin-web 手写 `Api.Marketing.JsonSchemaObject` 绕过了契约链路，本 VO 用于
 * 把这三个接口纳入 OpenAPI -> @libs/common-types -> 前端 的标准契约链路。
 */
export class MarketingJsonSchemaVo {
  @ApiProperty({ description: '根节点类型，固定为 object', example: 'object' })
  type: string;

  @ApiPropertyOptional({ description: '表单标题' })
  title?: string;

  @ApiPropertyOptional({ description: '表单描述' })
  description?: string;

  @ApiPropertyOptional({ description: '必填字段列表', type: [String] })
  required?: string[];

  @ApiProperty({
    description: '字段集合：键为字段名，值为单个字段 schema（含 type、title、enum、ui:widget 等）',
    type: 'object',
    additionalProperties: true,
  })
  properties: Record<string, unknown>;

  @ApiPropertyOptional({ description: '是否允许未声明字段', type: Boolean })
  additionalProperties?: boolean;
}
