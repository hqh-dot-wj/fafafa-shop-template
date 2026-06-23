import { FormatDateFields, GenerateUUID, Uniq, isObject, mergeDeep, isEmpty, Paginate } from './index';
import { Decimal } from '@prisma/client/runtime/library';

describe('FormatDateFields', () => {
  it('Given 对象含 Date 字段, When FormatDateFields, Then 格式化为字符串', () => {
    const obj = { name: 'test', createTime: new Date('2026-01-15T10:30:00Z') };
    const result = FormatDateFields(obj);
    expect(typeof result.createTime).toBe('string');
    expect(result.name).toBe('test');
  });

  it('Given 对象含 BigInt, When FormatDateFields, Then 转为字符串', () => {
    const obj = { id: BigInt(12345) };
    const result = FormatDateFields(obj);
    expect(result.id).toBe('12345');
  });

  it('Given 对象含 Decimal, When FormatDateFields, Then 转为数字', () => {
    const obj = { amount: new Decimal('99.99') };
    const result = FormatDateFields(obj);
    expect(result.amount).toBe(99.99);
  });

  it('Given 数组, When FormatDateFields, Then 递归格式化每个元素', () => {
    const arr = [
      { createTime: new Date('2026-01-01'), amount: new Decimal(10) },
      { createTime: new Date('2026-02-01'), amount: new Decimal(20) },
    ];
    const result = FormatDateFields(arr);
    expect(result).toHaveLength(2);
    expect(typeof result[0].createTime).toBe('string');
    expect(result[1].amount).toBe(20);
  });

  it('Given null, When FormatDateFields, Then 返回 null', () => {
    expect(FormatDateFields(null)).toBeNull();
  });

  it('Given undefined, When FormatDateFields, Then 返回 undefined', () => {
    expect(FormatDateFields(undefined)).toBeUndefined();
  });

  it('Given 嵌套对象, When FormatDateFields, Then 递归格式化', () => {
    const obj = {
      order: {
        createTime: new Date('2026-03-01'),
        items: [{ amount: new Decimal(50) }],
      },
    };
    const result = FormatDateFields(obj);
    expect(typeof result.order.createTime).toBe('string');
    expect(result.order.items[0].amount).toBe(50);
  });

  it('Given 自定义日期字段, When FormatDateFields, Then 仅格式化指定字段', () => {
    const obj = { myDate: new Date('2026-01-01'), createTime: new Date('2026-02-01') };
    const result = FormatDateFields(obj, ['myDate']);
    expect(typeof result.myDate).toBe('string');
    expect(typeof result.createTime).toBe('string');
  });

  it('Given 非白名单键下的 Date, When FormatDateFields, Then 仍统一格式化', () => {
    const obj = { publishedAt: new Date(2026, 3, 14, 15, 21, 0) };
    const result = FormatDateFields(obj);
    expect(typeof result.publishedAt).toBe('string');
    expect(result.publishedAt).toBe('2026-04-14 15:21:00');
  });
});

describe('GenerateUUID', () => {
  it('Given 调用, When GenerateUUID, Then 返回32位无连字符字符串', () => {
    const uuid = GenerateUUID();
    expect(uuid).toHaveLength(32);
    expect(uuid).not.toContain('-');
  });

  it('Given 多次调用, When GenerateUUID, Then 每次返回不同值', () => {
    const uuid1 = GenerateUUID();
    const uuid2 = GenerateUUID();
    expect(uuid1).not.toBe(uuid2);
  });
});

describe('Uniq', () => {
  it('Given 有重复的数字数组, When Uniq, Then 返回去重数组', () => {
    expect(Uniq([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
  });

  it('Given 有重复的字符串数组, When Uniq, Then 返回去重数组', () => {
    expect(Uniq(['a', 'b', 'a'])).toEqual(['a', 'b']);
  });

  it('Given 空数组, When Uniq, Then 返回空数组', () => {
    expect(Uniq([])).toEqual([]);
  });
});

describe('isObject', () => {
  it('Given 普通对象, When isObject, Then 返回 true', () => {
    expect(isObject({ a: 1 })).toBe(true);
  });

  it('Given 数组, When isObject, Then 返回 false', () => {
    expect(isObject([1, 2])).toBe(false);
  });

  it('Given null, When isObject, Then 返回 falsy', () => {
    expect(isObject(null)).toBeFalsy();
  });

  it('Given 字符串, When isObject, Then 返回 false', () => {
    expect(isObject('string')).toBe(false);
  });

  it('Given undefined, When isObject, Then 返回 falsy', () => {
    expect(isObject(undefined)).toBeFalsy();
  });
});

describe('mergeDeep', () => {
  it('Given 两个简单对象, When mergeDeep, Then 合并属性', () => {
    const result = mergeDeep({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('Given 嵌套对象, When mergeDeep, Then 深度合并', () => {
    const result = mergeDeep({ config: { host: 'localhost', port: 3000 } }, { config: { port: 8080, debug: true } });
    expect(result).toEqual({ config: { host: 'localhost', port: 8080, debug: true } });
  });

  it('Given 多个源对象, When mergeDeep, Then 依次合并', () => {
    const result = mergeDeep({ a: 1 }, { b: 2 }, { c: 3 });
    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('Given 无源对象, When mergeDeep, Then 返回 target', () => {
    const target = { a: 1 };
    expect(mergeDeep(target)).toBe(target);
  });

  it('Given 覆盖非对象值, When mergeDeep, Then 直接覆盖', () => {
    const result = mergeDeep({ a: 'old' }, { a: 'new' });
    expect(result).toEqual({ a: 'new' });
  });
});

describe('isEmpty (backend)', () => {
  it.each([null, undefined, '', 'NaN'])('Given %s, When isEmpty, Then 返回 true', (value) => {
    expect(isEmpty(value)).toBe(true);
  });

  it.each([0, false, 'hello', [], {}])('Given %s, When isEmpty, Then 返回 false', (value) => {
    expect(isEmpty(value)).toBe(false);
  });
});

describe('Paginate', () => {
  const list = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  it('Given 第1页 pageSize=10, When Paginate, Then 返回前10条', () => {
    const result = Paginate({ list, pageSize: 10, pageNum: 1 }, {});
    expect(result).toHaveLength(10);
    expect(result[0].id).toBe(1);
    expect(result[9].id).toBe(10);
  });

  it('Given 第3页 pageSize=10, When Paginate, Then 返回最后5条', () => {
    const result = Paginate({ list, pageSize: 10, pageNum: 3 }, {});
    expect(result).toHaveLength(5);
    expect(result[0].id).toBe(21);
  });

  it('Given pageSize=0, When Paginate, Then 返回空数组', () => {
    const result = Paginate({ list, pageSize: 0, pageNum: 1 }, {});
    expect(result).toEqual([]);
  });

  it('Given 负数 pageNum, When Paginate, Then 返回空数组', () => {
    const result = Paginate({ list, pageSize: 10, pageNum: -1 }, {});
    expect(result).toEqual([]);
  });
});
