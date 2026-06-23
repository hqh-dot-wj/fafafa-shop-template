/**
 * fafafa.app 模板部署 - 品牌与初始管理员覆写
 *
 * 在 seed pipeline 末尾按需运行。读取 TEMPLATE_BRAND_* / TEMPLATE_ADMIN_* 环境变量，
 * 覆写超级租户 000000 的品牌字段与默认 admin 账号。
 *
 * 设计原则：
 *   - 向后兼容：未设任何 TEMPLATE_* 环境变量时 no-op，行为与现状一致
 *   - 幂等：可重复执行；同样的环境变量产生同样的最终状态
 *   - 安全：明文密码经 bcrypt 10 轮 hash 后再写入；明文不入日志
 *   - 边界：仅覆写 tenantId=000000 / userId=1 一行，不动其他租户与用户
 *
 * 被调用方：apps/backend/prisma/seeds/run-prod-bootstrap.ts 末尾
 * 触发场景：fafafa GitLab Pipeline 在 migrate 步骤一次性容器中执行 seed
 */

import { PrismaClient, DelFlag } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const TEMPLATE_ADMIN_DEFAULT_USER_ID = 1;
const SUPER_TENANT_ID = '000000';
const BCRYPT_ROUNDS = 10;

export interface TemplateBrandingEnv {
  companyName?: string;
  logoUrl?: string;
  contactPhone?: string;
  domain?: string;
  adminUsername?: string;
  adminPassword?: string;
}

/**
 * 从进程环境变量收集模板品牌配置。
 * 仅去除前后空白；空字符串视作未提供。
 */
export function readTemplateBrandingEnv(env: NodeJS.ProcessEnv = process.env): TemplateBrandingEnv {
  const pick = (key: string): string | undefined => {
    const raw = env[key];
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  return {
    companyName: pick('TEMPLATE_BRAND_COMPANY_NAME'),
    logoUrl: pick('TEMPLATE_BRAND_LOGO_URL'),
    contactPhone: pick('TEMPLATE_BRAND_CONTACT_PHONE'),
    domain: pick('TEMPLATE_BRAND_DOMAIN'),
    adminUsername: pick('TEMPLATE_ADMIN_USERNAME'),
    adminPassword: pick('TEMPLATE_ADMIN_PASSWORD'),
  };
}

/**
 * 按给定品牌配置覆写超级租户与默认 admin。
 * 返回是否实际有改动，便于上层日志判断。
 *
 * 注意：本函数不抛错于"用户不存在/租户不存在"的场景——seed pipeline 可能在
 * 已存在 admin 时跳过 platform-bootstrap，但此时品牌字段仍可能需要刷新。
 * 找不到目标行时仅 warn，不影响主流程。
 */
export async function applyTemplateBranding(
  prisma: PrismaClient,
  envSnapshot?: TemplateBrandingEnv,
): Promise<{ tenantUpdated: boolean; adminUpdated: boolean }> {
  const env = envSnapshot ?? readTemplateBrandingEnv();

  const tenantPatch: Record<string, unknown> = {};
  if (env.companyName) tenantPatch.companyName = env.companyName;
  if (env.contactPhone) tenantPatch.contactPhone = env.contactPhone;
  if (env.domain) tenantPatch.domain = env.domain;
  if (env.logoUrl) tenantPatch.logoUrl = env.logoUrl;

  const adminPatch: Record<string, unknown> = {};
  if (env.adminUsername) adminPatch.userName = env.adminUsername;
  if (env.adminPassword) adminPatch.password = bcrypt.hashSync(env.adminPassword, BCRYPT_ROUNDS);

  if (Object.keys(tenantPatch).length === 0 && Object.keys(adminPatch).length === 0) {
    console.log('[Template-Branding] 未提供任何 TEMPLATE_* 环境变量，跳过覆写');
    return { tenantUpdated: false, adminUpdated: false };
  }

  let tenantUpdated = false;
  let adminUpdated = false;

  if (Object.keys(tenantPatch).length > 0) {
    const result = await prisma.sysTenant.updateMany({
      where: { tenantId: SUPER_TENANT_ID, delFlag: DelFlag.NORMAL },
      data: { ...tenantPatch, updateBy: 'template-branding' },
    });
    if (result.count > 0) {
      tenantUpdated = true;
      console.log(
        `[Template-Branding] 已覆写 sys_tenant(${SUPER_TENANT_ID}) 字段: ${Object.keys(tenantPatch).join(', ')}`,
      );
    } else {
      console.warn(`[Template-Branding] 未找到超级租户 ${SUPER_TENANT_ID}，跳过租户覆写`);
    }
  }

  if (Object.keys(adminPatch).length > 0) {
    const admin = await prisma.sysUser.findFirst({
      where: { userId: TEMPLATE_ADMIN_DEFAULT_USER_ID, delFlag: DelFlag.NORMAL },
      select: { userId: true, userName: true },
    });
    if (admin) {
      await prisma.sysUser.update({
        where: { userId: admin.userId },
        data: { ...adminPatch, updateBy: 'template-branding' },
      });
      adminUpdated = true;
      const changed = Object.keys(adminPatch)
        .map((k) => (k === 'password' ? 'password(bcrypt)' : k))
        .join(', ');
      console.log(`[Template-Branding] 已覆写默认 admin (userId=${admin.userId}) 字段: ${changed}`);
    } else {
      console.warn(`[Template-Branding] 未找到默认 admin (userId=${TEMPLATE_ADMIN_DEFAULT_USER_ID})，跳过账号覆写`);
    }
  }

  return { tenantUpdated, adminUpdated };
}
