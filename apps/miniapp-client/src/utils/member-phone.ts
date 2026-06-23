/** 会员资料里可能携带的手机号字段（后端权威字段为 mobile） */
export interface MemberPhoneSource {
  mobile?: string | null;
  phone?: string | null;
}

/** 读取已绑定的手机号（优先 mobile，兼容历史 phone 缓存） */
export function getMemberPhone(source?: MemberPhoneSource | null): string {
  if (!source) return '';
  const raw = source.mobile ?? source.phone;
  if (raw == null) return '';
  const trimmed = String(raw).trim();
  return trimmed;
}

/** 是否已绑定手机号 */
export function hasBoundPhone(source?: MemberPhoneSource | null): boolean {
  return getMemberPhone(source).length > 0;
}
