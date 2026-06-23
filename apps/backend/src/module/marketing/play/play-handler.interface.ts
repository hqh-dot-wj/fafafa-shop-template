import { MktCampaign, MktCampaignKind, PlayInstance, StorePlayConfig } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface PlayDraftCampaign {
  id?: string;
  tenantId?: string;
  type?: string;
  code?: string;
  kind?: MktCampaignKind | 'POLICY' | 'HANDLER';
  name?: string;
  audienceJson?: unknown;
  rightsJson?: unknown;
  stagesJson?: unknown;
  policyJson?: unknown;
  rules?: unknown;
  stockMode?: string;
}

export type PlaySubject = MktCampaign | StorePlayConfig | PlayDraftCampaign;

export interface PlayContext {
  campaign: PlaySubject;
  memberId: string;
  skuId?: string;
  instance?: PlayInstance;
  params?: Record<string, unknown>;
}

export interface PlayHandlerReward {
  type: string;
  payload: Record<string, unknown>;
}

export interface PlayHandlerResult {
  eligible: boolean;
  price?: Decimal;
  displayData?: Record<string, unknown>;
  rewards?: PlayHandlerReward[];
  reason?: string;
}

export interface IPlayHandler {
  readonly code: string;
  checkEligibility(ctx: PlayContext): Promise<boolean>;
  resolvePrice(ctx: PlayContext): Promise<Decimal | null>;
  applyRewards(ctx: PlayContext): Promise<void>;
  onStatusChange?(instance: PlayInstance, oldStatus: string, newStatus: string): Promise<void>;
  validateConfig(campaign: PlaySubject): Promise<void>;
  getDisplayData?(ctx: PlayContext): Promise<Record<string, unknown>>;
}

export function getPlaySubjectCode(subject: PlaySubject): string {
  if ('templateCode' in subject && typeof subject.templateCode === 'string') {
    return subject.templateCode;
  }
  if ('code' in subject && typeof subject.code === 'string') {
    return subject.code;
  }
  if ('type' in subject && typeof subject.type === 'string') {
    return subject.type;
  }
  throw new Error('玩法上下文缺少 code/type/templateCode');
}

export function isStorePlaySubject(subject: PlaySubject): subject is StorePlayConfig {
  return 'templateCode' in subject && 'serviceId' in subject && 'rules' in subject;
}

export function getPlaySubjectRules(subject: PlaySubject): unknown {
  if ('templateCode' in subject && 'rules' in subject) {
    return subject.rules;
  }
  if ('stagesJson' in subject) {
    return subject.stagesJson;
  }
  if ('rules' in subject) {
    return subject.rules;
  }
  return undefined;
}

export function getPlaySubjectStockMode(subject: PlaySubject): string | undefined {
  if ('stockMode' in subject && subject.stockMode) {
    return String(subject.stockMode);
  }
  return undefined;
}

export function assertStorePlaySubject(subject: PlaySubject): StorePlayConfig {
  if (isStorePlaySubject(subject)) {
    return subject;
  }
  throw new Error(`玩法 ${getPlaySubjectCode(subject)} 需要 StorePlayConfig 上下文`);
}
