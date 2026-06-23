import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

function flushTimers() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

const reloadPage = vi.fn();
const setContentXScrollable = vi.fn();

vi.mock('@sa/materials', () => ({
  LAYOUT_SCROLL_EL_ID: 'layout-scroll',
}));

vi.mock('@/store/modules/app', () => ({
  useAppStore: () => ({
    reloadFlag: true,
    reloadPage,
    setContentXScrollable,
  }),
}));

vi.mock('@/store/modules/theme', () => ({
  useThemeStore: () => ({
    footer: { visible: false },
    page: { animate: false, animateMode: 'fade-slide' },
  }),
}));

vi.mock('@/store/modules/route', () => ({
  useRouteStore: () => ({
    cacheRoutes: [],
    excludeCacheRoutes: [],
  }),
}));

vi.mock('@/store/modules/tab', () => ({
  useTabStore: () => ({
    getTabIdByRoute: () => 'demo-tab',
  }),
}));

vi.mock('vue-router', async () => {
  const { defineComponent } = await import('vue');
  const route = { fullPath: '/demo', name: 'demo', path: '/demo' };

  const ThrowingPage = defineComponent({
    name: 'ThrowingPage',
    render() {
      throw new Error('page setup failed');
    },
  });

  const RouterView = defineComponent({
    name: 'RouterView',
    setup(_, { slots }) {
      return () => slots.default?.({ Component: ThrowingPage, route });
    },
  });

  return {
    RouterView,
    useRoute: () => route,
  };
});

describe('GlobalContent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should show content error fallback when route component throws', async () => {
    const { default: GlobalContent } = await import('./index.vue');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mount(GlobalContent);

    await nextTick();
    await nextTick();
    await flushTimers();
    wrapper.vm.$forceUpdate();
    await nextTick();

    expect(wrapper.text()).toContain('页面加载失败');
    expect(wrapper.text()).toContain('/demo');
    expect(wrapper.find('button').exists()).toBe(true);
    consoleError.mockRestore();
  });
});
