import { EntitlementPoolCompileResultVo } from '../vo/entitlement-compile.vo';
import { CompileEntitlementPoolDto, ProductPoolSourceType } from '../dto/compile-entitlement.dto';
import { ProductActivityViewService } from '../../product-activity-view/product-activity-view.service';

type ProductPoolCompileInput = Pick<
  CompileEntitlementPoolDto,
  'poolType' | 'sourceType' | 'sourceKey' | 'memberId' | 'pageNum' | 'pageSize'
>;

type ProductPoolResultData = {
  rows: unknown[];
  total: number;
};

export class ProductPoolAdapter {
  constructor(private readonly service: ProductActivityViewService) {}

  async compile(input: ProductPoolCompileInput): Promise<EntitlementPoolCompileResultVo> {
    const sourceType = input.sourceType ?? 'SCENE';
    const memberId = input.memberId ?? '';
    const pageNum = this.normalizePageNum(input.pageNum);
    const pageSize = this.normalizePageSize(input.pageSize);

    if (sourceType === 'SCENE') {
      const result = await this.service.getSceneProducts({
        sceneCode: input.sourceKey ?? '',
        memberId,
        pageNum,
        pageSize,
      });
      const preview = this.toPreview(result.data);
      return {
        poolType: 'PRODUCT',
        poolId: this.resolvePoolId(input.sourceType, input.sourceKey),
        compileTarget: {
          owner: 'pms / product-activity-view / resolution',
          runtimeArtifacts: ['scene-candidate', 'activity-card', 'final-display-view'],
          forbiddenFacts: ['marketing-self-wide-product-ledger'],
        },
        preview,
        riskSummary: this.getRiskSummary('SCENE', preview.total),
      };
    }

    if (sourceType === 'CATEGORY') {
      const result = await this.service.getCategoryProducts({
        categoryId: Number(input.sourceKey ?? '0') || 0,
        memberId,
        pageNum,
        pageSize,
      });
      const preview = this.toPreview(result.data);
      return {
        poolType: 'PRODUCT',
        poolId: this.resolvePoolId(input.sourceType, input.sourceKey),
        compileTarget: {
          owner: 'pms / product-activity-view / resolution',
          runtimeArtifacts: ['category-candidate', 'activity-card', 'final-display-view'],
          forbiddenFacts: ['marketing-self-wide-product-ledger'],
        },
        preview,
        riskSummary: this.getRiskSummary('CATEGORY', preview.total),
      };
    }

    const result = await this.service.getRecommendProducts({
      memberId,
      onlyHot: sourceType === 'RECOMMEND',
      pageNum,
      pageSize,
    });
    const preview = this.toPreview(result.data);
    return {
      poolType: 'PRODUCT',
      poolId: this.resolvePoolId(input.sourceType, input.sourceKey),
      compileTarget: {
        owner: 'pms / product-activity-view / resolution',
        runtimeArtifacts: ['recommend-candidate', 'activity-card', 'final-display-view'],
        forbiddenFacts: ['marketing-self-wide-product-ledger'],
      },
      preview,
      riskSummary: this.getRiskSummary('RECOMMEND', preview.total),
    };
  }

  private toPreview(data: unknown): ProductPoolResultData {
    if (!data || typeof data !== 'object') {
      return { rows: [], total: 0 };
    }
    const record = data as Record<string, unknown>;
    const rows = Array.isArray(record.rows) ? (record.rows as unknown[]) : [];
    const total = typeof record.total === 'number' ? record.total : rows.length;
    return { rows, total };
  }

  private getRiskSummary(sourceType: ProductPoolSourceType, total: number): string[] {
    if (sourceType === 'SCENE') {
      return total === 0
        ? ['场景商品池未命中任何商品', '请检查场景码是否有效或商品是否下架']
        : ['场景商品池依赖 resolution 与商品读模型，不改造主数据'];
    }
    if (sourceType === 'CATEGORY') {
      return ['分类商品池采用商品读模型分页扫描，避免二次建模'];
    }
    return ['推荐商品池采用既有 pms 活动候选与热度标记'];
  }

  private resolvePoolId(sourceType?: string, sourceKey?: string) {
    if (!sourceType) return 'product-unknown';
    return sourceKey ? `product-${sourceType.toLowerCase()}-${sourceKey}` : `product-${sourceType.toLowerCase()}`;
  }

  private normalizePageNum(pageNum?: number) {
    const safe = Number(pageNum ?? 1);
    return Number.isFinite(safe) && safe > 0 ? Math.trunc(safe) : 1;
  }

  private normalizePageSize(pageSize?: number) {
    const safe = Number(pageSize ?? 20);
    if (!Number.isFinite(safe) || safe <= 0) {
      return 20;
    }
    return Math.min(50, Math.trunc(safe));
  }
}
