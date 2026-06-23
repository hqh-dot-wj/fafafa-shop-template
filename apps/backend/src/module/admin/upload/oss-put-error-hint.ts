/**
 * 阿里云 OSS PutObject 常见权限类报错后附加中文排查说明（原文仍保留便于检索工单）
 */
export function appendAliyunOssPutDeniedGuidance(raw: string): string {
  const s = raw.trim();
  if (/no right to access this object because of bucket acl/i.test(s)) {
    return `${s}。排查：① 在 RAM 中为该 AccessKey 所属用户授权含目标 Bucket 的 oss:PutObject（按需 oss:GetObject、oss:DeleteObject）；② 核对 OSS_BUCKET、OSS_REGION、OSS_ENDPOINT 与控制台地域一致；③ 密钥须属 Bucket 主账号或已跨账号授权；④ OSS 会同时评估 RAM 与 Bucket Policy，显式 Deny 优先——请在 Bucket「权限控制 > Bucket 授权策略」查看是否有限制 VPC/公网 IP 的拒绝规则（本机上传走公网时会被拒）；也可按官方文档「授予指定 RAM 用户读写权限」在 Bucket Policy 中为该 RAM 用户 UID 增加 Allow（参见 help.aliyun.com 文档《通过 Bucket Policy 设置授权策略》场景 1）。`;
  }
  return s;
}
