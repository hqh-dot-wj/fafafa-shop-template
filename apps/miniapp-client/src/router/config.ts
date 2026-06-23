import { getAllPages } from '@/utils';

export const LOGIN_STRATEGY_MAP = {
  DEFAULT_NO_NEED_LOGIN: 0, // 黑名单策略，默认可以进入APP
  DEFAULT_NEED_LOGIN: 1, // 白名单策略，默认不可以进入APP，需要强制登录
};

// 当前项目以“小程序授权弹窗 + 指定受保护页面黑名单”作为默认登录策略。
// 若后续切换到“默认全站登录”的白名单模式，只需要调整这里的策略常量。
export const LOGIN_STRATEGY = LOGIN_STRATEGY_MAP.DEFAULT_NO_NEED_LOGIN;
export const isNeedLoginMode = LOGIN_STRATEGY === LOGIN_STRATEGY_MAP.DEFAULT_NEED_LOGIN;

export const LOGIN_PAGE = '/pages-auth/login';
export const REGISTER_PAGE = '/pages-auth/register';

export const LOGIN_PAGE_LIST = [LOGIN_PAGE, REGISTER_PAGE];

// 在 definePage 里面配置了 excludeLoginPath 的页面，功能与 EXCLUDE_LOGIN_PATH_LIST 相同
export const excludeLoginPathList = getAllPages('excludeLoginPath').map((page) => page.path);

// 排除列表由页面元数据 `excludeLoginPath` 提供，避免手写示例值长期残留。
// 白名单策略下：这里表示“允许匿名访问”的页面。
// 黑名单策略下：这里表示“必须先登录”的页面。
export const EXCLUDE_LOGIN_PATH_LIST = [...excludeLoginPathList];

// 在小程序里面是否使用H5的登录页，默认为 false
// 当前项目在 MP 端统一使用平台授权弹窗，不复用 H5 登录页跳转。
export const LOGIN_PAGE_ENABLE_IN_MP = false;
