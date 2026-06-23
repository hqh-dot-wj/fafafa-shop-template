export type DictGovernanceSourceType = 'prisma' | 'ts-enum';

export interface DictGovernanceRegistryItem {
  domain: string;
  enumName: string;
  sourceType: DictGovernanceSourceType;
  sourcePath: string;
  dictType: string;
  consumerSurfaces: string[];
  migrationPriority: 'high' | 'medium' | 'low';
}
