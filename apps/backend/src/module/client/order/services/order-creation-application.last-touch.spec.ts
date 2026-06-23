import { OrderCreationApplicationService } from './order-creation-application.service';

/**
 * 单测 OrderCreationApplicationService 的私有方法 resolvePreviewLastTouchShareUserId。
 *
 * 验收设计稿 P0-04 §3.3.2 要求："取 preview.items 中最后一个有 shareUserId 的项"
 * （结算时刻 last-touch），而不是之前 `.find()` 取第一个（first-touch）。
 *
 * 由于本服务依赖 10+ 个 port/service，完整 TestingModule 装配成本高且不必要——
 * 这里只测纯函数语义，用 Object.create 避开构造器，直接访问 private 方法即可。
 */
describe('OrderCreationApplicationService#resolvePreviewLastTouchShareUserId', () => {
  const service = Object.create(OrderCreationApplicationService.prototype) as OrderCreationApplicationService & {
    resolvePreviewLastTouchShareUserId: (preview: { items: Array<{ shareUserId?: string | null }> }) => string | null;
  };

  const resolve = (items: Array<{ shareUserId?: string | null }>): string | null =>
    service.resolvePreviewLastTouchShareUserId({ items } as Parameters<
      typeof service.resolvePreviewLastTouchShareUserId
    >[0]);

  it('returns null when no items', () => {
    expect(resolve([])).toBeNull();
  });

  it('returns null when no items carry shareUserId', () => {
    expect(resolve([{ shareUserId: null }, {}, { shareUserId: '' }])).toBeNull();
  });

  it('returns the LAST item shareUserId, not the first (last-touch semantics)', () => {
    const result = resolve([{ shareUserId: 'share-early' }, { shareUserId: null }, { shareUserId: 'share-late' }]);
    expect(result).toBe('share-late');
  });

  it('skips empty/whitespace shareUserId when traversing from tail', () => {
    const result = resolve([{ shareUserId: 'share-early' }, { shareUserId: '   ' }, { shareUserId: null }]);
    expect(result).toBe('share-early');
  });

  it('trims surrounding whitespace from the matched shareUserId', () => {
    expect(resolve([{ shareUserId: '  share-x  ' }])).toBe('share-x');
  });

  it('does NOT regress to first-touch when only the first item carries shareUserId', () => {
    const result = resolve([{ shareUserId: 'share-only' }, { shareUserId: null }, { shareUserId: '' }]);
    expect(result).toBe('share-only');
  });
});
