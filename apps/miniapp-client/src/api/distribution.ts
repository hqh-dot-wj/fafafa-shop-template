/**
 * 分销相关 API
 * 类型来自 @libs/common-types（由 backend openApi.json 生成）
 * Share token / 小程序码等本地 payload 与结果对象仍保留 view-model，字段变更时需回看 backend distribution DTO/VO。
 * @expires backend 导出 distribution share-token DTO/VO 后切换至 generate-types。
 */
import type {
  CommissionPreview,
  DistributionCapability,
  PendingReward,
  QualificationApplication,
  QualificationEvidence,
  SubmitQualificationApplicationDto,
} from '@libs/common-types';
import { httpGet, httpPost } from '@/http/http';

/** 佣金预估 */
export function getCommissionPreview(params: { tenantId: string; shareUserId?: string }) {
  return httpPost<CommissionPreview>('/store/distribution/commission/preview', params);
}

export type DistributionBizType = 'PRODUCT' | 'ACTIVITY' | 'PAGE';
export type DistributionShareEventType =
  | 'CLICK'
  | 'BIND'
  | 'EXPIRED_HIT'
  | 'LIMIT_HIT'
  | 'INVALID_HIT'
  | 'MANUAL_DISABLE';

export interface CreateShareTokenPayload {
  bizType: DistributionBizType;
  bizId: string;
  linkExpireMinutes?: number;
  maxClickCount?: number;
  maxBindCount?: number;
  maxOrderCount?: number;
  targetPath?: string;
  metadata?: Record<string, unknown>;
}

export interface ShareTokenInfo {
  sid: string;
  tenantId?: string;
  status?: 'ACTIVE' | 'DISABLED' | 'EXPIRED';
  bizType?: DistributionBizType;
  bizId?: string;
  shareUserId?: string;
  maxClickCount?: number;
  maxBindCount?: number;
  maxOrderCount?: number;
  clickCount?: number;
  bindCount?: number;
  orderCount?: number;
  sharePath?: string;
  targetPath?: string;
  shareUrl?: string;
  expireAt?: string;
  remainClicks?: number;
  remainBinds?: number;
  remainOrders?: number;
  available?: boolean;
  code?: string;
  message?: string;
  metadata?: Record<string, unknown> | null;
}

export interface MiniappQrcodePayload {
  sid: string;
  page?: string;
  width?: number;
  envVersion?: 'develop' | 'trial' | 'release';
}

export interface MiniappQrcodeInfo {
  sid: string;
  qrcodeUrl: string;
  scene?: string;
}

export interface TrackShareEventPayload {
  sid: string;
  eventType: DistributionShareEventType;
  orderId?: string;
  ext?: Record<string, unknown>;
}

/** 创建分销分享凭证 */
export function createShareToken(payload: CreateShareTokenPayload) {
  return httpPost<ShareTokenInfo>('/client/distribution/share-token', payload);
}

/** 生成小程序码 */
export function createMiniappQrcode(payload: MiniappQrcodePayload) {
  return httpPost<MiniappQrcodeInfo>('/client/distribution/share-token/qrcode', payload);
}

/** 解析分销分享凭证 */
export function resolveShareToken(params: { sid: string }) {
  return httpGet<ShareTokenInfo>('/client/distribution/share/resolve', params, undefined, { hideErrorToast: true });
}

/** 记录分销分享事件 */
export function trackShareEvent(payload: TrackShareEventPayload) {
  return httpPost<{ bound?: boolean; code?: string; message?: string }>(
    '/client/distribution/share/event',
    payload,
    undefined,
    undefined,
    { hideErrorToast: true },
  );
}

/** 我的分销资格能力 */
export function getDistributionCapability() {
  return httpGet<DistributionCapability>('/client/distribution/capability');
}

/** 我的资格材料 */
export function getMyQualificationEvidence(params?: { pageNum?: number; pageSize?: number; evidenceStatus?: string }) {
  return httpGet<{ rows?: QualificationEvidence[]; total?: number }>('/client/distribution/evidence', params);
}

/** 最近一次资格申请 */
export function getMyQualificationApplication() {
  return httpGet<QualificationApplication | null>('/client/distribution/application');
}

/** 提交资格申请 */
export function submitQualificationApplication(payload: SubmitQualificationApplicationDto) {
  return httpPost<QualificationApplication>('/client/distribution/application', payload as Record<string, any>);
}

/** 我的待激活收益 */
export function getMyPendingRewards(params?: { pageNum?: number; pageSize?: number; status?: string }) {
  return httpGet<{ rows?: PendingReward[]; total?: number }>('/client/distribution/pending-rewards', params);
}
