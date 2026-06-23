import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { MarketingStockMode, PlayDefinition } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ResponseCode } from 'src/common/response/response.interface';
import { getErrorMessage } from 'src/common/utils/error';
import { PrismaService } from 'src/prisma/prisma.service';
import { isPolicyCampaign } from '../common/campaign-type';
import { getPlayRuleSchemaMetadata } from './play-rule-schema.catalog';
import { getPlaySubjectCode, IPlayHandler, PlaySubject } from './play-handler.interface';

export interface PlayMetadata {
  code: string;
  name: string;
  hasInstance: boolean;
  hasState: boolean;
  canFail: boolean;
  canParallel: boolean;
  ruleSchema?: new (...args: unknown[]) => unknown;
  defaultStockMode: MarketingStockMode;
  description?: string;
}

const POLICY_EVAL_CODE = 'POLICY_EVAL';

@Injectable()
export class PlayDispatcher implements OnModuleInit {
  private readonly logger = new Logger(PlayDispatcher.name);
  private readonly handlers = new Map<string, IPlayHandler>();
  private readonly definitions = new Map<string, PlayDefinition>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly discoveryService: DiscoveryService,
  ) {}

  async onModuleInit(): Promise<void> {
    const definitions = await this.loadActiveDefinitionsWithRetry();
    this.registerHandlers(definitions);
  }

  resolve(campaign: PlaySubject): IPlayHandler {
    const code = this.resolveDefinitionCode(campaign);
    const handler = this.handlers.get(code);
    if (!handler) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `未找到玩法处理器: ${code}`);
    }
    return handler;
  }

  getMetadata(code: string): PlayMetadata {
    const definition = this.definitions.get(code);
    if (!definition) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `未找到玩法定义: ${code}`);
    }
    return this.toMetadata(definition);
  }

  getAllPlayTypes(): PlayMetadata[] {
    return Array.from(this.definitions.values())
      .filter((definition) => definition.code !== POLICY_EVAL_CODE)
      .map((definition) => this.toMetadata(definition));
  }

  hasInstance(code: string): boolean {
    return this.definitions.get(code)?.hasInstance ?? false;
  }

  hasState(code: string): boolean {
    return this.definitions.get(code)?.hasState ?? false;
  }

  canFail(code: string): boolean {
    return this.definitions.get(code)?.canFail ?? false;
  }

  canParallel(code: string): boolean {
    return this.definitions.get(code)?.canParallel ?? false;
  }

  hasHandler(code: string): boolean {
    return this.handlers.has(code);
  }

  getDefaultStockMode(code: string): MarketingStockMode {
    return this.getMetadata(code).defaultStockMode;
  }

  private async loadActiveDefinitionsWithRetry(): Promise<PlayDefinition[]> {
    let lastError: unknown;
    const retryMs = Number(process.env.PLAY_DISPATCHER_BOOT_RETRY_MS ?? 5_000);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const definitions = await this.prisma.playDefinition.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
        });
        if (definitions.length === 0) {
          throw new Error('play_definition active rows is empty');
        }
        return definitions;
      } catch (error) {
        lastError = error;
        this.logger.warn(`[PlayDispatcher] DB unreachable on boot (attempt ${attempt}/3): ${getErrorMessage(error)}`);
        if (attempt < 3) {
          await this.sleep(retryMs);
        }
      }
    }
    throw new Error(
      `[PlayDispatcher] DB_UNREACHABLE: 3 次重试后仍读不到 play_definition；${getErrorMessage(lastError)}`,
    );
  }

  private registerHandlers(definitions: PlayDefinition[]): void {
    const candidates = new Map<string, IPlayHandler>();
    for (const wrapper of this.discoveryService.getProviders()) {
      const instance = wrapper.instance as Partial<IPlayHandler> | undefined;
      const metatype = wrapper.metatype;
      if (!instance || !metatype) continue;
      if (
        typeof instance.code === 'string' &&
        typeof instance.checkEligibility === 'function' &&
        typeof instance.resolvePrice === 'function' &&
        typeof instance.applyRewards === 'function' &&
        typeof instance.validateConfig === 'function'
      ) {
        candidates.set(metatype.name, instance as IPlayHandler);
      }
    }

    const missing: string[] = [];
    this.handlers.clear();
    this.definitions.clear();

    for (const definition of definitions) {
      this.definitions.set(definition.code, definition);
      const handler = candidates.get(definition.handlerClassName);
      if (!handler) {
        missing.push(`${definition.code}(${definition.handlerClassName})`);
        continue;
      }
      if (handler.code !== definition.code) {
        missing.push(`${definition.code} class.code mismatch (handler.code=${handler.code})`);
        continue;
      }
      this.handlers.set(definition.code, handler);
    }

    if (missing.length > 0) {
      throw new Error(
        `[PlayDispatcher] CONFIG_MISMATCH: play_definition 与 IoC provider 对不上：${missing.join(', ')}`,
      );
    }
  }

  private resolveDefinitionCode(campaign: PlaySubject): string {
    const code = getPlaySubjectCode(campaign);
    if (this.isPolicySubject(campaign, code)) {
      return POLICY_EVAL_CODE;
    }
    return code;
  }

  private isPolicySubject(campaign: PlaySubject, code: string): boolean {
    const kind = 'kind' in campaign ? (campaign as { kind?: unknown }).kind : undefined;
    return isPolicyCampaign({
      kind: typeof kind === 'string' ? kind : undefined,
      type: code,
    });
  }

  private toMetadata(definition: PlayDefinition): PlayMetadata {
    const ruleSchema = getPlayRuleSchemaMetadata(definition.code)?.ruleSchema;
    return {
      code: definition.code,
      name: definition.name,
      hasInstance: definition.hasInstance,
      hasState: definition.hasState,
      canFail: definition.canFail,
      canParallel: definition.canParallel,
      ruleSchema,
      defaultStockMode: definition.defaultStockMode,
      description: definition.description ?? undefined,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }
}
