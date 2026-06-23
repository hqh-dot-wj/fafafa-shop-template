import { request } from '@/service/request';

/**
 * 优惠券后台接口集合。
 * 模板接口对应 CouponTemplateController，手动发放对应 CouponDistributionController，
 * 用户券、使用记录、统计和导出对应 CouponManagementController。
 */

/** 查询优惠券模板列表，只读分页接口。 */
export function fetchGetCouponTemplateList(params?: Api.Marketing.CouponTemplateSearchParams) {
  return request<Api.Marketing.CouponTemplateList>({
    url: '/admin/marketing/coupon/templates',
    method: 'get',
    params,
  });
}

/** 查询优惠券模板详情，详情可能包含发放量、使用量、核销率等统计字段。 */
export function fetchGetCouponTemplate(id: string) {
  return request<Api.Marketing.CouponTemplate>({
    url: `/admin/marketing/coupon/templates/${id}`,
    method: 'get',
  });
}

/** 创建优惠券模板；库存、门槛、有效期等规则写入后会影响发放和领取链路。 */
export function fetchCreateCouponTemplate(data: Api.Marketing.CouponTemplateCreate) {
  return request<Api.Marketing.CouponTemplate>({
    url: '/admin/marketing/coupon/templates',
    method: 'post',
    data,
  });
}

/** 更新优惠券模板；已发放模板的关键规则由后端控制是否允许修改。 */
export function fetchUpdateCouponTemplate(id: string, data: Api.Marketing.CouponTemplateUpdate) {
  return request<Api.Marketing.CouponTemplate>({
    url: `/admin/marketing/coupon/templates/${id}`,
    method: 'put',
    data,
  });
}

/** 删除入口实际是停用模板，后端将状态置为 INACTIVE，不做物理删除。 */
export function fetchDeleteCouponTemplate(id: string) {
  return request({
    url: `/admin/marketing/coupon/templates/${id}`,
    method: 'delete',
  });
}

/** 快捷启停模板，只改变 ACTIVE/INACTIVE，不修改库存和领取规则。 */
export function fetchUpdateCouponTemplateStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
  return request({
    url: `/admin/marketing/coupon/templates/${id}/status`,
    method: 'patch',
    data: { status },
  });
}

/** 管理端手动发券是批量写入口，后端负责逐个会员的库存、限领和重复领取校验。 */
export function fetchCouponDistributeManual(data: { templateId: string; memberIds: string[] }) {
  return request<Api.Marketing.CouponManualDistributeResultItem[]>({
    url: '/admin/marketing/coupon/distribute/manual',
    method: 'post',
    data,
  });
}

/** 管理端查询用户券实例，只读展示领取、使用、过期状态。 */
export function fetchGetUserCoupons(params?: Api.Marketing.UserCouponListSearchParams) {
  return request<Common.PaginatingQueryRecord<Api.Marketing.UserCoupon>>({
    url: '/admin/marketing/coupon/user-coupons',
    method: 'get',
    params,
  });
}

/** 查询优惠券使用记录，只读审计核销/抵扣事实。 */
export function fetchGetCouponUsageRecords(params?: Api.Marketing.CouponUsageRecordListSearchParams) {
  return request<Common.PaginatingQueryRecord<Api.Marketing.CouponUsageRecord>>({
    url: '/admin/marketing/coupon/usage-records',
    method: 'get',
    params,
  });
}

/** 查询优惠券统计；传 templateId 时返回单模板使用率，否则返回总体概览。 */
export function fetchGetCouponStatistics(params?: { templateId?: string }) {
  return request<Api.Marketing.CouponStatistics>({
    url: '/admin/marketing/coupon/statistics',
    method: 'get',
    params,
  });
}

/** 导出使用记录，返回 xlsx 文件流；筛选条件应与使用记录列表保持同一语义。 */
export function fetchExportCouponUsage(
  params?: Pick<Api.Marketing.CouponUsageRecordListSearchParams, 'memberId' | 'templateId' | 'startTime' | 'endTime'>,
) {
  return request<Blob, 'blob'>({
    url: '/admin/marketing/coupon/export',
    method: 'get',
    params,
    responseType: 'blob',
  });
}
