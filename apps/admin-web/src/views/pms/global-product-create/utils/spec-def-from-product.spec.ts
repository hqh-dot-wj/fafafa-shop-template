import { describe, expect, it } from 'vitest';
import {
  buildSpecDefFromGlobalSkus,
  normalizeSpecDefFromApi,
  resolveProductSpecDefForForm,
} from './spec-def-from-product';

describe('normalizeSpecDefFromApi', () => {
  it('忽略嵌套空数组等非对象项', () => {
    expect(normalizeSpecDefFromApi([[], [], []])).toEqual([]);
  });

  it('保留合法 { name, values }', () => {
    expect(
      normalizeSpecDefFromApi([
        { name: '容量', values: ['500ml'] },
        { name: '口味', values: ['原味', '柠檬'] },
      ]),
    ).toEqual([
      { name: '容量', values: ['500ml'] },
      { name: '口味', values: ['原味', '柠檬'] },
    ]);
  });
});

describe('buildSpecDefFromGlobalSkus', () => {
  it('从 specValues 聚合规格名与取值', () => {
    expect(
      buildSpecDefFromGlobalSkus([
        {
          specValues: {
            口味: '原味',
            容量: '500ml',
            包装形态: 'PET瓶装',
          },
        },
      ]),
    ).toEqual([
      { name: '口味', values: ['原味'] },
      { name: '容量', values: ['500ml'] },
      { name: '包装形态', values: ['PET瓶装'] },
    ]);
  });
});

describe('resolveProductSpecDefForForm', () => {
  it('specDef 无效时回退 globalSkus', () => {
    const specDef = resolveProductSpecDefForForm([[], []], [
      { specValues: { 容量: '500ml', 口味: '原味' } },
    ]);
    expect(specDef).toEqual([
      { name: '容量', values: ['500ml'] },
      { name: '口味', values: ['原味'] },
    ]);
  });
});
