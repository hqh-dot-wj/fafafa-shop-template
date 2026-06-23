import { describe, expect, it } from 'vitest';
import { dedupeDictDataByValue } from './dict-dedupe';

describe('dedupeDictDataByValue', () => {
  it('keeps the row with smaller dictCode per dictValue', () => {
    const list = [
      { dictCode: 13088, dictValue: '1', dictLabel: '通知', dictSort: 1 },
      { dictCode: 14, dictValue: '1', dictLabel: '通知', dictSort: 1 },
      { dictCode: 13089, dictValue: '2', dictLabel: '公告', dictSort: 2 },
      { dictCode: 15, dictValue: '2', dictLabel: '公告', dictSort: 2 },
    ] as Api.System.DictData[];

    const result = dedupeDictDataByValue(list);

    expect(result).toHaveLength(2);
    expect(result.map((d) => d.dictCode)).toEqual([14, 15]);
  });
});
