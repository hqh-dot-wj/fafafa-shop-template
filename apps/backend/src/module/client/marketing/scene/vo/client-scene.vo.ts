import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ProductDisplayTagVo,
  ProductPurchaseStatusVo,
  ProductServiceSummaryVo,
} from 'src/module/client/product/vo/product-display-projection.vo';

export class ClientSceneExplainVo {
  @ApiProperty({ description: '解释域，如 COURSE_GROUP' })
  domain: string;

  @ApiProperty({ description: '解释原因编码' })
  code: string;

  @ApiProperty({ description: '解释文案' })
  message: string;

  @ApiProperty({ description: '解释级别', enum: ['INFO', 'WARN'] })
  severity: 'INFO' | 'WARN';

  @ApiProperty({ description: '解释来源' })
  source: string;
}

export class ClientCourseGroupJoinExplainVo {
  @ApiProperty({ description: '当前用户是否可直接参团' })
  joinable: boolean;

  @ApiProperty({ description: '参团判断原因编码' })
  reasonCode: string;

  @ApiProperty({ description: '参团判断原因文案' })
  reasonText: string;

  @ApiPropertyOptional({ description: '推荐可操作团队 ID' })
  candidateTeamId?: string;

  @ApiPropertyOptional({ description: '团队展示状态' })
  teamStatus?: string;

  @ApiPropertyOptional({ description: '剩余真实名额' })
  remainingSlots?: number;

  @ApiPropertyOptional({ description: '有效成员数' })
  effectiveMemberCount?: number;

  @ApiPropertyOptional({ description: '最小成团人数' })
  minCount?: number;

  @ApiPropertyOptional({ description: '最大容量' })
  maxCount?: number;

  @ApiPropertyOptional({ description: '是否由虚拟补位成团' })
  formedByVirtual?: boolean;

  @ApiPropertyOptional({ description: '团队投影漂移标记', type: [String] })
  driftFlags?: string[];

  @ApiPropertyOptional({ description: '资金投影是否就绪' })
  financeProjectionReady?: boolean;
}

export class ClientSceneProductCardVo {
  @ApiProperty({ description: '商品 ID' })
  productId: string;

  @ApiPropertyOptional({ description: '商品名称' })
  productName?: string;

  @ApiPropertyOptional({ description: '商品主图' })
  productImg?: string;

  @ApiPropertyOptional({ description: '商品图片列表', type: [String] })
  productImages?: string[];

  @ApiPropertyOptional({ description: '主推权益/活动报价快照', type: 'object', additionalProperties: true })
  primaryOffer?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '场景出数解释项', type: [ClientSceneExplainVo] })
  explain?: ClientSceneExplainVo[];

  @ApiPropertyOptional({ description: '拼课参团解释', type: ClientCourseGroupJoinExplainVo })
  courseGroupJoinExplain?: ClientCourseGroupJoinExplainVo;

  @ApiPropertyOptional({ description: '商品展示标签，最多返回3个', type: [ProductDisplayTagVo] })
  displayTags?: ProductDisplayTagVo[];

  @ApiPropertyOptional({ description: '购买状态', type: ProductPurchaseStatusVo })
  purchaseStatus?: ProductPurchaseStatusVo;

  @ApiPropertyOptional({ description: '服务商品摘要', type: ProductServiceSummaryVo })
  serviceSummary?: ProductServiceSummaryVo;

  @ApiPropertyOptional({
    description: '卡片布局提示，前端据此决定渲染 overlay 大卡还是 split 小卡；缺省时由前端按 featuredCount 兜底',
    enum: ['overlay', 'split', 'auto'],
  })
  cardLayout?: 'overlay' | 'split' | 'auto';
}

export class ClientSceneModuleVo {
  @ApiProperty({ description: '模块编码' })
  moduleCode: string;

  @ApiProperty({ description: '模块名称' })
  moduleName: string;

  @ApiProperty({ description: '模块类型' })
  moduleType: string;

  @ApiPropertyOptional({ description: '模块展示标题' })
  title?: string;

  @ApiPropertyOptional({ description: '模块展示副标题' })
  subTitle?: string;

  @ApiPropertyOptional({
    description:
      '模块 UI 配置快照。约定字段：featuredCount?: number —— 前 N 张商品使用 overlay 大卡，其余使用 split 小卡；' +
      '缺省时前端自行决定默认值（如 3）。该字段由场景发布配置透传，admin-web 未来可编辑。',
    type: 'object',
    additionalProperties: true,
  })
  uiConfig?: Record<string, unknown>;

  @ApiProperty({ description: '模块内商品卡片', type: [ClientSceneProductCardVo] })
  products: ClientSceneProductCardVo[];
}

export class ClientSceneViewVo {
  @ApiProperty({ description: '场景编码' })
  sceneCode: string;

  @ApiProperty({ description: '场景发布版本号' })
  releaseNo: number;

  @ApiProperty({ description: '本次场景出数追踪 ID' })
  traceId: string;

  @ApiProperty({ description: '出数来源', enum: ['scene'] })
  source: 'scene';

  @ApiProperty({ description: '场景模块列表', type: [ClientSceneModuleVo] })
  modules: ClientSceneModuleVo[];
}
