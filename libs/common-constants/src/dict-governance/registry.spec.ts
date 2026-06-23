import { DICT_GOVERNANCE_REGISTRY } from './registry';

describe('DICT_GOVERNANCE_REGISTRY', () => {
  it('dictType 必须唯一', () => {
    const dictTypes = DICT_GOVERNANCE_REGISTRY.map((item) => item.dictType);
    expect(new Set(dictTypes).size).toBe(dictTypes.length);
  });

  it('enumName 必须唯一', () => {
    const enumNames = DICT_GOVERNANCE_REGISTRY.map((item) => item.enumName);
    expect(new Set(enumNames).size).toBe(enumNames.length);
  });

  it('sourcePath 和 consumerSurfaces 不能为空', () => {
    DICT_GOVERNANCE_REGISTRY.forEach((item) => {
      expect(item.sourcePath.trim()).not.toBe('');
      expect(item.consumerSurfaces.length).toBeGreaterThan(0);
      expect(item.consumerSurfaces.every((surface) => surface.trim() !== '')).toBe(true);
    });
  });

  it('包含关键业务 dictType', () => {
    expect(DICT_GOVERNANCE_REGISTRY.some((item) => item.dictType === 'pms_publish_status')).toBe(true);
  });
});
