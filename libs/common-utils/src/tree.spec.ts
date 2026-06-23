import { listToTree, isEmpty, isNotEmpty } from './tree';

/** 为树节点附加 children 字段的辅助类型 */
type WithChildren<T, C extends string = 'children'> = T & { [K in C]?: WithChildren<T, C>[] };

describe('listToTree', () => {
  const flatDepts = [
    { deptId: 1, parentId: 0, name: '总公司' },
    { deptId: 2, parentId: 1, name: '研发部' },
    { deptId: 3, parentId: 1, name: '市场部' },
    { deptId: 4, parentId: 2, name: '前端组' },
    { deptId: 5, parentId: 2, name: '后端组' },
    { deptId: 6, parentId: 3, name: '品牌组' },
  ];

  it('Given 扁平数组, When listToTree, Then 返回正确的树结构', () => {
    const tree = listToTree(flatDepts, { idField: 'deptId' }) as WithChildren<(typeof flatDepts)[0]>[];

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('总公司');
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children![0].children).toHaveLength(2);
    expect(tree[0].children![1].children).toHaveLength(1);
  });

  it('Given 空数组, When listToTree, Then 返回空数组', () => {
    expect(listToTree([], { idField: 'deptId' })).toEqual([]);
  });

  it('Given null/undefined, When listToTree, Then 返回空数组', () => {
    expect(listToTree(null as any, { idField: 'deptId' })).toEqual([]);
    expect(listToTree(undefined as any, { idField: 'deptId' })).toEqual([]);
  });

  it('Given 自定义 parentIdField 和 childrenField, When listToTree, Then 使用自定义字段', () => {
    const data = [
      { id: 1, pid: 0, label: 'root' },
      { id: 2, pid: 1, label: 'child' },
    ];
    const tree = listToTree(data, {
      idField: 'id',
      parentIdField: 'pid',
      childrenField: 'items',
      rootValue: 0,
    }) as WithChildren<(typeof data)[0], 'items'>[];

    expect(tree).toHaveLength(1);
    expect(tree[0].items).toHaveLength(1);
    expect(tree[0].items![0].label).toBe('child');
  });

  it('Given 字符串类型 rootValue, When listToTree, Then 正确识别根节点', () => {
    const data = [
      { id: 'a', parentId: 'root', name: 'A' },
      { id: 'b', parentId: 'a', name: 'B' },
    ];
    const tree = listToTree(data, { idField: 'id', rootValue: 'root' }) as WithChildren<(typeof data)[0]>[];

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('A');
    expect(tree[0].children).toHaveLength(1);
  });

  it('Given filterFn, When listToTree, Then 仅包含通过过滤的节点', () => {
    const data = [
      { deptId: 1, parentId: 0, name: '总公司', status: '0' },
      { deptId: 2, parentId: 1, name: '研发部', status: '0' },
      { deptId: 3, parentId: 1, name: '已停用部门', status: '1' },
    ];
    const tree = listToTree(data, {
      idField: 'deptId',
      filterFn: (item) => item.status === '0',
    }) as WithChildren<(typeof data)[0]>[];

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].name).toBe('研发部');
  });

  it('Given 多个根节点, When listToTree, Then 返回多棵树', () => {
    const data = [
      { id: 1, parentId: 0, name: 'root1' },
      { id: 2, parentId: 0, name: 'root2' },
      { id: 3, parentId: 1, name: 'child1' },
    ];
    const tree = listToTree(data, { idField: 'id' });

    expect(tree).toHaveLength(2);
  });

  it('Given 无根节点匹配, When listToTree, Then 返回空数组', () => {
    const data = [{ id: 1, parentId: 999, name: 'orphan' }];
    const tree = listToTree(data, { idField: 'id', rootValue: 0 });

    expect(tree).toHaveLength(0);
  });

  it('Given 深层嵌套, When listToTree, Then 正确构建多层树', () => {
    const data = [
      { id: 1, parentId: 0, name: 'L1' },
      { id: 2, parentId: 1, name: 'L2' },
      { id: 3, parentId: 2, name: 'L3' },
      { id: 4, parentId: 3, name: 'L4' },
    ];
    const tree = listToTree(data, { idField: 'id' }) as WithChildren<(typeof data)[0]>[];

    expect(tree[0].children![0].children![0].children![0].name).toBe('L4');
  });
});

describe('isEmpty', () => {
  it('Given null, When isEmpty, Then 返回 true', () => {
    expect(isEmpty(null)).toBe(true);
  });

  it('Given undefined, When isEmpty, Then 返回 true', () => {
    expect(isEmpty(undefined)).toBe(true);
  });

  it('Given 空字符串, When isEmpty, Then 返回 true', () => {
    expect(isEmpty('')).toBe(true);
  });

  it('Given 0, When isEmpty, Then 返回 false', () => {
    expect(isEmpty(0)).toBe(false);
  });

  it('Given false, When isEmpty, Then 返回 false', () => {
    expect(isEmpty(false)).toBe(false);
  });

  it('Given 非空字符串, When isEmpty, Then 返回 false', () => {
    expect(isEmpty('hello')).toBe(false);
  });

  it('Given 空数组, When isEmpty, Then 返回 false', () => {
    expect(isEmpty([])).toBe(false);
  });

  it('Given 空对象, When isEmpty, Then 返回 false', () => {
    expect(isEmpty({})).toBe(false);
  });
});

describe('isNotEmpty', () => {
  it('Given null, When isNotEmpty, Then 返回 false', () => {
    expect(isNotEmpty(null)).toBe(false);
  });

  it('Given undefined, When isNotEmpty, Then 返回 false', () => {
    expect(isNotEmpty(undefined)).toBe(false);
  });

  it('Given 空字符串, When isNotEmpty, Then 返回 false', () => {
    expect(isNotEmpty('')).toBe(false);
  });

  it('Given 非空字符串, When isNotEmpty, Then 返回 true', () => {
    expect(isNotEmpty('hello')).toBe(true);
  });

  it('Given 0, When isNotEmpty, Then 返回 true', () => {
    expect(isNotEmpty(0)).toBe(true);
  });

  it('Given false, When isNotEmpty, Then 返回 true', () => {
    expect(isNotEmpty(false)).toBe(true);
  });
});
