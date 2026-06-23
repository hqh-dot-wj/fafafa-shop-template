/**
 * 湖南完整演示操作账号：按角色绑定平台菜单子树（menuId 为租户 000000 的 sys_menu）。
 * 与 catalog-operators.ts 中 roleKey 一一对应。
 */
export const HUNAN_OPERATOR_MENU_ROOTS: Record<string, number[]> = {
  /** 商品列表 / 市场 / 草稿 / 审核 */
  'hf:product:ops': [230],
  /** 营销管理全子树（含活动中心 API 所需的 marketing:activity:* 按钮权限） */
  'hf:marketing:ops': [7],
  /** 分销申请、活动分销、优惠券发放等 */
  'hf:distribution:reviewer': [220],
  /**
   * 门店财务（佣金/提现/应结算）+ 平台结算/对账中心（与 hunan-reconciliation-center 种子一致）
   * + 门店订单子树（含 store:order:refund，便于核对 HF-ORDER-* 退款样本）
   */
  'hf:finance:ops': [200, 1300, 212],
  /** 门店商品 + 订单 + 分销 + 财务 + 履约（店长视角） */
  'hf:store:manager': [5],
};
