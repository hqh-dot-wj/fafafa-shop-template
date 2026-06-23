import { DelFlag } from '@prisma/client';
import { mergeSoftDeleteIntoWhere } from './prisma-soft-delete.extension';

describe('mergeSoftDeleteIntoWhere', () => {
  it('OmsOrder 空 where 补 delFlag NORMAL', () => {
    const merged = mergeSoftDeleteIntoWhere('OmsOrder', undefined);
    expect(merged.delFlag).toBe(DelFlag.NORMAL);
  });

  it('OmsOrder 仅有 deleteTime 条件时不叠加 delFlag（兼容旧查询）', () => {
    const w = { deleteTime: { not: null } };
    expect(mergeSoftDeleteIntoWhere('OmsOrder', w)).toEqual(w);
  });

  it('含 delFlag 的模型空 where 补 NORMAL', () => {
    const merged = mergeSoftDeleteIntoWhere('GenTable', {});
    expect(merged.delFlag).toBe(DelFlag.NORMAL);
  });

  it('含 delFlag 的模型已有 delFlag 则不覆盖', () => {
    const w = { delFlag: DelFlag.DELETE };
    expect(mergeSoftDeleteIntoWhere('GenTable', w)).toEqual(w);
  });

  it('SysMessage 不合并（物理删模型）', () => {
    expect(mergeSoftDeleteIntoWhere('SysMessage', { id: 1 })).toEqual({ id: 1 });
  });

  it('无 delFlag 字段的模型不合并', () => {
    const w = { id: 'w1' };
    expect(mergeSoftDeleteIntoWhere('FinWallet', w)).toEqual(w);
  });

  it('顶层 OR 时用 AND 包裹软删条件', () => {
    const w = { OR: [{ id: 'a' }, { id: 'b' }] };
    expect(mergeSoftDeleteIntoWhere('OmsOrder', w)).toEqual({
      AND: [{ delFlag: DelFlag.NORMAL }, w],
    });
  });

  it('已有 AND 数组时追加子句', () => {
    const w = { AND: [{ memberId: 'm1' }], tenantId: 't1' };
    const merged = mergeSoftDeleteIntoWhere('OmsOrder', w);
    expect(merged.AND).toEqual([{ memberId: 'm1' }, { delFlag: DelFlag.NORMAL }]);
    expect(merged.tenantId).toBe('t1');
  });
});
