/** 会员注册头像（Base64 data URL）最大解码后体积 */
export const MAX_MEMBER_AVATAR_IMAGE_BYTES = 2_500_000;

export interface ParsedMemberAvatarImage {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg';
  fileName: string;
}

/**
 * 解析小程序提交的注册头像 data URL，校验格式、体积与魔数
 *
 * @param raw - 形如 `data:image/png;base64,...` 或 `data:image/jpeg;base64,...`
 * @returns 解析结果；不合法时返回 null（不抛错，由调用方决定提示）
 */
export function parseMemberAvatarDataUrl(raw: string): ParsedMemberAvatarImage | null {
  const trimmed = raw.trim();
  const m = /^data:(image\/(?:png|jpeg|jpg));base64,(\S+)$/i.exec(trimmed);
  if (!m?.[2]) {
    return null;
  }

  const mimeRaw = m[1].toLowerCase();
  const mimeType: 'image/png' | 'image/jpeg' = mimeRaw === 'image/jpg' || mimeRaw === 'image/jpeg' ? 'image/jpeg' : 'image/png';

  let buffer: Buffer;
  try {
    buffer = Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }

  if (buffer.length === 0 || buffer.length > MAX_MEMBER_AVATAR_IMAGE_BYTES) {
    return null;
  }

  if (mimeType === 'image/png') {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length < sig.length || !buffer.subarray(0, sig.length).equals(sig)) {
      return null;
    }
  } else {
    if (buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return null;
    }
  }

  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  return { buffer, mimeType, fileName: `member-avatar.${ext}` };
}
