import { selectDemoReadonlyMenuIds } from './hunan-platform-demo-menu-filter';

describe('selectDemoReadonlyMenuIds', () => {
  it('包含目录与页面，且仅包含 list/query 按钮', () => {
    const ids = selectDemoReadonlyMenuIds([
      { menuId: 1, menuType: 'M', perms: '' },
      { menuId: 2, menuType: 'C', perms: 'a:b:list' },
      { menuId: 3, menuType: 'F', perms: 'a:b:query' },
      { menuId: 4, menuType: 'F', perms: 'a:b:add' },
      { menuId: 5, menuType: 'F', perms: '' },
    ]);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('结果按 menuId 升序', () => {
    expect(
      selectDemoReadonlyMenuIds([
        { menuId: 30, menuType: 'M', perms: '' },
        { menuId: 10, menuType: 'C', perms: '' },
      ]),
    ).toEqual([10, 30]);
  });
});
