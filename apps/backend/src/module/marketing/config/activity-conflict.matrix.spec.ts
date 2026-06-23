import { checkConflict, CONFLICT_MATRIX, ConflictType, getActivityPriority } from './activity-conflict.matrix';

describe('activity-conflict.matrix', () => {
  it('只保留三种玩法的互斥矩阵', () => {
    expect(Object.keys(CONFLICT_MATRIX).sort()).toEqual(['COURSE_GROUP_BUY', 'FLASH_SALE', 'MEMBER_UPGRADE']);
  });

  it('已删除玩法不应再存在于矩阵中', () => {
    expect(CONFLICT_MATRIX.GROUP_BUY).toBeUndefined();
    expect(CONFLICT_MATRIX.FULL_REDUCTION).toBeUndefined();
  });

  it('COURSE_GROUP_BUY 与 FLASH_SALE 应互斥', () => {
    const result = checkConflict('COURSE_GROUP_BUY', 'FLASH_SALE');
    expect(result.conflict).toBe(true);
    expect(result.rule?.type).toBe(ConflictType.EXCLUSIVE);
  });

  it('会员升级与 FLASH_SALE 应按优先级处理', () => {
    const result = checkConflict('MEMBER_UPGRADE', 'FLASH_SALE');
    expect(result.conflict).toBe(false);
    expect(result.rule?.type).toBe(ConflictType.PRIORITY);
  });

  it('FLASH_SALE 优先级应为最高', () => {
    expect(getActivityPriority('FLASH_SALE')).toBe(1);
    expect(getActivityPriority('COURSE_GROUP_BUY')).toBeGreaterThan(1);
    expect(getActivityPriority('MEMBER_UPGRADE')).toBeGreaterThan(1);
  });
});
