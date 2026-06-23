import type { TenantAwarePrismaClient } from 'src/prisma/prisma-tenant.types';

declare module 'src/prisma/prisma.service' {
  /** 运行时为 Proxy，访问 model 时转发至 prismaInner */
  interface PrismaService extends TenantAwarePrismaClient {}
}

export {};
