import { MarketingLifecyclePolicyService } from './lifecycle-policy.service';

describe('MarketingLifecyclePolicyService', () => {
  const service = new MarketingLifecyclePolicyService();

  it('Given 已发布活动, When decideDelete, Then 仅允许归档/停用', () => {
    const decision = service.decideDelete({
      approvalStatus: 'PUBLISHED',
      hasExternalRefs: false,
      participationCount: 0,
    });

    expect(decision).toEqual({
      action: 'ARCHIVE_ONLY',
      reason: '活动已有发布痕迹，请改用停用或归档',
    });
  });

  it('Given 运行中人群变更, When assertMutable, Then 抛出必须创建新版本', () => {
    try {
      service.assertMutable({
        area: 'audience',
        stage: 'PUBLISHED',
      });
      fail('expected assertMutable to throw');
    } catch (error) {
      expect(error).toMatchObject({
        response: expect.objectContaining({
          msg: '当前区域发布后必须创建新版本',
        }),
      });
    }
  });
});
