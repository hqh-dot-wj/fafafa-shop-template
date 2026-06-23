import { buildMenus } from './utils';

describe('buildMenus', () => {
  it('目录下仅有按钮(F)时不生成空 path 的子路由', () => {
    const flat = [
      {
        menuId: 1,
        parentId: 0,
        menuName: '系统管理',
        orderNum: 1,
        path: 'system',
        component: null,
        query: '',
        menuType: 'M',
        visible: '0',
        isFrame: '1',
        isCache: '0',
        icon: 'system',
      },
      {
        menuId: 99001,
        parentId: 1,
        menuName: '仅按钮子级目录',
        orderNum: 99,
        path: 'finance-placeholder',
        component: null,
        query: '',
        menuType: 'M',
        visible: '0',
        isFrame: '1',
        isCache: '0',
        icon: 'money',
      },
      {
        menuId: 99002,
        parentId: 99001,
        menuName: '某按钮',
        orderNum: 1,
        path: '',
        component: '',
        query: '',
        menuType: 'F',
        visible: '0',
        isFrame: '1',
        isCache: '0',
        icon: '#',
        perms: 'x:y:stats',
      },
    ];

    const tree = buildMenus(flat as never[]);
    const system = tree.find((r) => r.path === '/system');
    expect(system).toBeDefined();
    const dirOnlyButtons = system?.children?.find((c) => c.path === 'finance-placeholder');
    expect(dirOnlyButtons).toBeDefined();
    expect(dirOnlyButtons?.children ?? []).toEqual([]);
    expect(dirOnlyButtons?.alwaysShow).toBeUndefined();
  });

  it('目录下混合 C 与 F 时仅 C 进入子路由', () => {
    const flat = [
      {
        menuId: 1,
        parentId: 0,
        menuName: '根',
        orderNum: 1,
        path: 'root',
        component: null,
        query: '',
        menuType: 'M',
        visible: '0',
        isFrame: '1',
        isCache: '0',
        icon: 'x',
      },
      {
        menuId: 2,
        parentId: 1,
        menuName: '子目录',
        orderNum: 1,
        path: 'sub',
        component: null,
        query: '',
        menuType: 'M',
        visible: '0',
        isFrame: '1',
        isCache: '0',
        icon: 'x',
      },
      {
        menuId: 3,
        parentId: 2,
        menuName: '页面',
        orderNum: 1,
        path: 'page',
        component: 'system/user/index',
        query: '',
        menuType: 'C',
        visible: '0',
        isFrame: '1',
        isCache: '0',
        icon: 'x',
      },
      {
        menuId: 4,
        parentId: 2,
        menuName: '按钮',
        orderNum: 2,
        path: '',
        component: '',
        query: '',
        menuType: 'F',
        visible: '0',
        isFrame: '1',
        isCache: '0',
        icon: '#',
        perms: 'x:y:add',
      },
    ];

    const tree = buildMenus(flat as never[]);
    const root = tree[0];
    const sub = root?.children?.[0];
    expect(sub?.children?.length).toBe(1);
    expect(sub?.children?.[0]?.path).toBe('page');
  });

  it('外链菜单（isFrame=0）将 path 中的 URL 写入 meta.link', () => {
    const flat = [
      {
        menuId: 10,
        parentId: 0,
        menuName: '其它项目',
        orderNum: 1,
        path: 'https://other.example.com/admin',
        component: 'FrameView',
        query: '',
        menuType: 'C',
        visible: '0',
        isFrame: '0',
        isCache: '1',
        icon: 'link',
      },
    ];

    const tree = buildMenus(flat as never[]);
    expect(tree[0]?.meta?.link).toBe('https://other.example.com/admin');
    expect(tree[0]?.component).toBe('FrameView');
  });
});
