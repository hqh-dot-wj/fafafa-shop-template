import { httpGet } from '@/http/http';

interface MyCouponsPage {
  rows: unknown[];
  total: number;
}

/** 对应 backend ClientCouponController.my-coupons，当前只取 total 作为购物车等入口角标。 */
export async function fetchUnusedCouponTotal(): Promise<number> {
  try {
    const data = await httpGet<MyCouponsPage>(
      '/client/marketing/coupon/my-coupons',
      { status: 'UNUSED', pageNum: 1, pageSize: 1 },
      undefined,
      { hideErrorToast: true },
    );
    return typeof data?.total === 'number' ? data.total : 0;
  } catch {
    // 角标不是主流程，失败时静默归零，避免优惠券服务抖动阻断购物车页面。
    return 0;
  }
}
