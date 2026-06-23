import { Injectable } from '@nestjs/common';
import { MarketingProtocolDefinitionVo } from './dto/protocol-definition.vo';
import { MARKETING_CUTOVER_REGISTRY } from './cutover-registry';

const CANONICAL_MAPPING = [
  { legacy: 'activity', canonical: 'CampaignDraft/CampaignRelease', owner: 'activity' },
  { legacy: 'approval', canonical: 'CampaignReleaseApproval', owner: 'approval' },
  { legacy: 'scene/sceneRelease', canonical: 'RuntimeProjection', owner: 'scene' },
  { legacy: 'instance/playInstance', canonical: 'JourneyInstance', owner: 'instance' },
];

const STOP_MODES = ['pause-new-entry', 'drain-existing', 'hard-stop', 'archive', 'fuse-off'] as const;

const MUTABILITY_MATRIX = [
  { area: 'basicInfo', draft: 'EDITABLE', pending: 'LIMITED', published: 'WHITELIST_ONLY' },
  { area: 'audience', draft: 'EDITABLE', pending: 'RECHECK_REQUIRED', published: 'NEW_RELEASE_REQUIRED' },
  { area: 'entitlement', draft: 'EDITABLE', pending: 'RECHECK_REQUIRED', published: 'NEW_RELEASE_REQUIRED' },
  { area: 'touchpointMaterial', draft: 'EDITABLE', pending: 'EDITABLE_WITH_AUDIT', published: 'HOTFIX_WHITELIST' },
];

const CUTOVER_PRINCIPLES = ['single-entry', 'single-write-path', 'single-publish-path', 'compat-layer-expiring'];

const REQUIRED_CONTRACTS = [
  'CanonicalMapping',
  'JourneySettings',
  'StopModes',
  'DeleteArchiveMatrix',
  'PostPublishMutability',
  'CutoverDecommission',
];

@Injectable()
export class MarketingProtocolService {
  getDefinition(): MarketingProtocolDefinitionVo {
    return {
      version: '2026-04-19',
      canonicalMapping: CANONICAL_MAPPING,
      stopModes: [...STOP_MODES],
      mutabilityMatrix: MUTABILITY_MATRIX,
      cutoverRegistry: MARKETING_CUTOVER_REGISTRY.map(item => ({ ...item })),
      cutoverPrinciples: CUTOVER_PRINCIPLES,
      requiredContracts: REQUIRED_CONTRACTS,
    } as MarketingProtocolDefinitionVo;
  }
}
