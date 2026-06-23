import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';

export const SCENE_RELEASE_CACHE_KEY_PREFIX = 'marketing:scene:release';

const SCENE_RELEASE_CACHE_TTL_MS = 60 * 1000;

export interface SceneReleaseSnapshot {
  id: string;
  sceneCode: string;
  releaseNo: number;
  modules: Array<{
    moduleCode: string;
    moduleName: string;
    moduleType: string;
    title?: string | null;
    subTitle?: string | null;
    uiConfig?: Record<string, unknown> | null;
    limitSize: number;
    sourcePolicyCode: string;
    resolverPolicyCode: string;
    sortPolicyCode?: string | null;
    audiencePolicyCode?: string | null;
    cardTemplateCode: string;
    attributionPolicyCode?: string | null;
  }>;
}

@Injectable()
export class SceneReleaseRepository {
  private readonly logger = new Logger(SceneReleaseRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findPublishedRelease(sceneCode: string, tenantId: string, channel?: string): Promise<SceneReleaseSnapshot | null> {
    const cacheKey = this.buildCacheKey(tenantId, sceneCode, channel);
    const cached = await this.redis.get(cacheKey);
    if (this.isSceneReleaseSnapshot(cached)) {
      return cached;
    }

    const release = await this.prisma.mktSceneRelease.findFirst({
      where: { tenantId, sceneCode, releaseStatus: 'PUBLISHED' },
      orderBy: { releaseNo: 'desc' },
    });
    if (!release) return null;

    const snapshot = release.releaseSnapshot as Record<string, unknown>;
    const modules = (Array.isArray(snapshot.modules) ? snapshot.modules : []) as SceneReleaseSnapshot['modules'];

    if (modules.length === 0) {
      this.logger.warn(`场景 ${sceneCode} 的发布快照不含模块，请重新发布场景`);
    }

    // Filter by channel — normalise both sides to uppercase for case-insensitive comparison
    if (channel && Array.isArray(snapshot.channelScope)) {
      const scope = (snapshot.channelScope as string[]).map((s) => s.toUpperCase());
      if (scope.length > 0 && !scope.includes(channel.toUpperCase())) return null;
    }

    const result: SceneReleaseSnapshot = {
      id: release.id,
      sceneCode,
      releaseNo: release.releaseNo,
      modules,
    };
    await this.redis.set(cacheKey, result, SCENE_RELEASE_CACHE_TTL_MS);
    return result;
  }

  private buildCacheKey(tenantId: string, sceneCode: string, channel?: string): string {
    const safeChannel = String(channel ?? 'ALL').trim().toUpperCase() || 'ALL';
    return `${SCENE_RELEASE_CACHE_KEY_PREFIX}:${tenantId}:${sceneCode}:${safeChannel}`;
  }

  private isSceneReleaseSnapshot(value: unknown): value is SceneReleaseSnapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const candidate = value as SceneReleaseSnapshot;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.sceneCode === 'string' &&
      typeof candidate.releaseNo === 'number' &&
      Array.isArray(candidate.modules)
    );
  }
}
