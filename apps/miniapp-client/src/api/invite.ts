import { httpGet } from '@/http/http';

/** 邀请统计 */
export interface InviteStats {
  /** 全部邀请人数 */
  totalInvited: number;
  /** 下单成功人数 */
  orderedCount: number;
}

/** 邀请记录项 */
export interface InviteRecord {
  id: string;
  /** 被邀请人昵称 */
  nickname: string;
  /** 被邀请人头像 */
  avatar: string;
  /** 邀请时间 */
  inviteTime: string;
  /** 是否已下单 */
  hasOrdered: boolean;
  /** 下单时间 */
  orderTime?: string;
}

/** 团队成员项 */
export interface TeamMember {
  id: string;
  nickname: string;
  avatar: string;
  /** 加入时间 */
  joinTime: string;
  /** 角色/等级文本 */
  roleText: string;
  /** 等级 ID：0=普通会员 1=团长 2=股东 */
  levelId: number;
}

/** 获取邀请统计 */
export function getInviteStats() {
  return httpGet<InviteStats>('/client/invite/stats');
}

/** 获取邀请记录列表 */
export function getInviteRecords(params: {
  /** all=全部, ordered=下单成功 */
  filter: 'all' | 'ordered';
  pageNum: number;
  pageSize: number;
}) {
  return httpGet<{ rows: InviteRecord[]; total: number }>('/client/invite/records', params);
}

/** 获取团队成员列表 */
export function getInviteTeamMembers(params: { pageNum: number; pageSize: number }) {
  return httpGet<{ rows: TeamMember[]; total: number }>('/client/invite/team', params);
}

/** 获取邀请二维码 */
export function getInviteQrCode() {
  return httpGet<{ qrcodeUrl: string }>('/client/invite/qrcode');
}
