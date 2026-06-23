import { defineComponent, nextTick } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SceneDefinitionMetricsPanel from './definition/modules/scene-definition-metrics-panel.vue';
import SceneDefinitionSearch from './definition/modules/scene-definition-search.vue';
import ScenePreviewSearch from './preview/modules/scene-preview-search.vue';
import ScenePreviewTableCard from './preview/modules/scene-preview-table-card.vue';
import NavigationPage from './navigation/index.vue';

const pushMock = vi.hoisted(() => vi.fn());
const fetchNavigationTreeMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { nodes: [] } }));

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();

  return {
    ...actual,
    useRouter: () => ({
      push: pushMock,
    }),
  };
});

vi.mock('@/service/api/marketing', async () => {
  const actual = await vi.importActual<object>('@/service/api/marketing');

  return {
    ...actual,
    fetchNavigationTree: fetchNavigationTreeMock,
    fetchCreateNavigationNode: vi.fn(),
    fetchSortNavigationNode: vi.fn(),
    fetchUpdateNavigationNode: vi.fn(),
  };
});

vi.mock('@/store/modules/app', () => ({
  useAppStore: () => ({
    isMobile: false,
  }),
}));

vi.mock('naive-ui', async () => {
  const { defineComponent: createStub } = await import('vue');

  const card = createStub({
    props: { title: { type: String, default: '' } },
    template:
      '<section><h3 v-if="title">{{ title }}</h3><slot name="header" /><slot name="header-extra" /><slot /></section>',
  });
  const collapse = createStub({ template: '<div><slot /></div>' });
  const collapseItem = createStub({
    props: { title: { type: String, default: '' } },
    template: '<section><h4>{{ title }}</h4><slot /></section>',
  });
  const form = createStub({ template: '<form><slot /></form>' });
  const formItem = createStub({
    props: { label: { type: String, default: '' } },
    template: '<label><span>{{ label }}</span><slot /></label>',
  });
  const grid = createStub({ template: '<div><slot /></div>' });
  const input = createStub({
    props: { placeholder: { type: String, default: '' } },
    template: '<input :placeholder="placeholder" />',
  });
  const select = createStub({
    props: {
      placeholder: { type: String, default: '' },
      options: { type: Array, default: () => [] },
    },
    template:
      '<select :data-placeholder="placeholder"><option v-for="option in options" :key="String(option.value)">{{ option.label }}</option></select>',
  });
  const button = createStub({ template: '<button><slot /></button>' });
  const empty = createStub({
    props: { description: { type: String, default: '' } },
    template: '<div>{{ description }}</div>',
  });
  const tag = createStub({ template: '<span><slot /></span>' });
  const alert = createStub({
    props: { title: { type: String, default: '' } },
    template: '<div><strong v-if="title">{{ title }}</strong><slot /></div>',
  });
  const dataTable = createStub({ template: '<div><slot name="empty" /></div>' });
  const tree = createStub({ template: '<div><slot name="empty" /></div>' });

  return {
    NButton: button,
    NCard: card,
    NCollapse: collapse,
    NCollapseItem: collapseItem,
    NForm: form,
    NFormItem: formItem,
    NFormItemGi: formItem,
    NGrid: grid,
    NGi: grid,
    NInput: input,
    NInputNumber: input,
    NSelect: select,
    NSpace: grid,
    NStatistic: createStub({
      props: { label: { type: String, default: '' } },
      template: '<div><span>{{ label }}</span><slot /></div>',
    }),
    NDescriptions: grid,
    NDescriptionsItem: formItem,
    NTag: tag,
    NAlert: alert,
    NDataTable: dataTable,
    NEmpty: empty,
    NSpin: grid,
    NTree: tree,
  };
});

vi.mock('@/components/advanced/table-sider-layout.vue', async () => {
  const { defineComponent: createStub } = await import('vue');

  return {
    default: createStub({
      props: {
        siderTitle: {
          type: String,
          default: '',
        },
      },
      template: `
        <section>
          <h2>{{ siderTitle }}</h2>
          <slot name="header-extra" />
          <slot name="sider" />
          <slot />
        </section>
      `,
    }),
  };
});

vi.mock('@/components/business/miniapp-route-target-editor.vue', async () => {
  const { defineComponent: createStub } = await import('vue');

  return {
    default: createStub({
      template: '<div>MiniappRouteTargetEditor</div>',
    }),
  };
});

const cardStub = defineComponent({
  name: 'NCardStub',
  props: {
    title: {
      type: String,
      default: '',
    },
  },
  template: `
    <section>
      <h3 v-if="title">{{ title }}</h3>
      <slot name="header" />
      <slot name="header-extra" />
      <slot />
    </section>
  `,
});

const tableSiderLayoutStub = defineComponent({
  name: 'TableSiderLayoutStub',
  props: {
    siderTitle: {
      type: String,
      default: '',
    },
  },
  template: `
    <section>
      <h2>{{ siderTitle }}</h2>
      <slot name="header-extra" />
      <slot name="sider" />
      <slot />
    </section>
  `,
});

const statisticStub = defineComponent({
  name: 'NStatisticStub',
  props: {
    label: {
      type: String,
      default: '',
    },
  },
  template: `<div><span>{{ label }}</span><slot /></div>`,
});

const formItemGiStub = defineComponent({
  name: 'NFormItemGiStub',
  props: {
    label: {
      type: String,
      default: '',
    },
  },
  template: `<label><span>{{ label }}</span><slot /></label>`,
});

const alertStub = defineComponent({
  name: 'NAlertStub',
  props: {
    title: {
      type: String,
      default: '',
    },
  },
  template: `
    <div>
      <strong v-if="title">{{ title }}</strong>
      <slot />
    </div>
  `,
});

const collapseItemStub = defineComponent({
  name: 'NCollapseItemStub',
  props: {
    title: {
      type: String,
      default: '',
    },
  },
  template: `
    <section>
      <h4>{{ title }}</h4>
      <slot />
    </section>
  `,
});

const emptyStub = defineComponent({
  name: 'NEmptyStub',
  props: {
    description: {
      type: String,
      default: '',
    },
  },
  template: '<div>{{ description }}</div>',
});

const inputStub = defineComponent({
  name: 'NInputStub',
  props: {
    placeholder: {
      type: String,
      default: '',
    },
  },
  template: '<input :placeholder="placeholder" />',
});

const selectStub = defineComponent({
  name: 'NSelectStub',
  props: {
    placeholder: {
      type: String,
      default: '',
    },
    options: {
      type: Array,
      default: () => [],
    },
  },
  template:
    '<select :data-placeholder="placeholder"><option v-for="option in options" :key="String(option.value)">{{ option.label }}</option></select>',
});

const buttonStub = defineComponent({
  name: 'NButtonStub',
  template: '<button><slot /></button>',
});

const tagStub = defineComponent({
  name: 'NTagStub',
  template: '<span><slot /></span>',
});

const dataTableStub = defineComponent({
  name: 'NDataTableStub',
  template: '<div><slot name="empty" /></div>',
});

function createGlobalStubs(extra: Record<string, unknown> = {}) {
  return {
    NCard: cardStub,
    NStatistic: statisticStub,
    NFormItemGi: formItemGiStub,
    NAlert: alertStub,
    NCollapse: defineComponent({ template: '<div><slot /></div>' }),
    NCollapseItem: collapseItemStub,
    NForm: defineComponent({ template: '<form><slot /></form>' }),
    NGrid: defineComponent({ template: '<div><slot /></div>' }),
    NGi: defineComponent({ template: '<div><slot /></div>' }),
    NSpace: defineComponent({ template: '<div><slot /></div>' }),
    NInput: inputStub,
    NSelect: selectStub,
    NButton: buttonStub,
    NDataTable: dataTableStub,
    NDescriptions: defineComponent({ template: '<div><slot /></div>' }),
    NDescriptionsItem: defineComponent({
      props: { label: { type: String, default: '' } },
      template: '<div><span>{{ label }}</span><slot /></div>',
    }),
    NTag: tagStub,
    NSpin: defineComponent({ template: '<div><slot /></div>' }),
    NTree: defineComponent({ template: '<div><slot name="empty" /></div>' }),
    NEmpty: emptyStub,
    NInputNumber: defineComponent({ template: '<input type="number" />' }),
    TableSiderLayout: tableSiderLayoutStub,
    'table-sider-layout': tableSiderLayoutStub,
    MiniappRouteTargetEditor: defineComponent({ template: '<div>MiniappRouteTargetEditor</div>' }),
    iconIcRoundRefresh: true,
    iconIcRoundSearch: true,
    iconIcRoundPlus: true,
    iconIcRoundLink: true,
    ...extra,
  };
}

async function flushMountedState() {
  await Promise.resolve();
  await nextTick();
}

describe('scene-placement 组件语义', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('definition 相关组件应渲染明确的中文指标和筛选语义', async () => {
    const metricsWrapper = shallowMount(SceneDefinitionMetricsPanel, {
      props: { total: 10, active: 4, draft: 3, inactive: 3 },
      global: { stubs: createGlobalStubs() },
    });
    const searchWrapper = shallowMount(SceneDefinitionSearch, {
      props: {
        model: {
          sceneName: '',
          sceneCode: '',
          sceneType: null,
          status: null,
          activityType: null,
        },
        sceneTypeOptions: [],
        statusOptions: [],
      },
      global: { stubs: createGlobalStubs() },
    });

    expect(metricsWrapper.text()).toContain('场景定义概览');
    expect(metricsWrapper.text()).toContain('全部');
    expect(metricsWrapper.text()).toContain('启用');
    expect(metricsWrapper.text()).toContain('草稿');
    expect(metricsWrapper.text()).toContain('停用');

    expect(searchWrapper.text()).toContain('场景名称');
    expect(searchWrapper.text()).toContain('场景编码');
    expect(searchWrapper.text()).toContain('场景类型');
    expect(searchWrapper.text()).toContain('活动类型');
    expect(searchWrapper.text()).toContain('状态');
    expect(searchWrapper.text()).toContain('搜索');
    expect(searchWrapper.text()).toContain('重置');
    expect(searchWrapper.html()).toContain('placeholder="如 COURSE_GROUP"');
  });

  it('preview 相关组件应渲染后台预览上下文和中文错误提示', async () => {
    const searchWrapper = shallowMount(ScenePreviewSearch, {
      props: {
        sceneCode: 'SCENE_HOME',
        channel: 'ADMIN_PREVIEW',
        memberId: '',
        clientVersion: '',
        sceneLoading: false,
        previewLoading: false,
        sceneOptions: [{ label: '首页场景 (SCENE_HOME)', value: 'SCENE_HOME' }],
        channelOptions: [
          { label: '后台预览', value: 'ADMIN_PREVIEW' },
          { label: '小程序', value: 'MINIAPP' },
        ],
      },
      global: { stubs: createGlobalStubs() },
    });

    const tableWrapper = shallowMount(ScenePreviewTableCard, {
      props: {
        columns: [],
        data: [],
        loading: false,
        pagination: { page: 1, pageSize: 20, itemCount: 0 },
        flexHeight: false,
        scrollX: 1200,
        total: 0,
        previewError: '预览卡片加载失败',
      },
      global: { stubs: createGlobalStubs() },
    });

    expect(searchWrapper.text()).toContain('场景');
    expect(searchWrapper.text()).toContain('渠道');
    expect(searchWrapper.text()).toContain('会员ID');
    expect(searchWrapper.text()).toContain('客户端版本');
    expect(searchWrapper.text()).toContain('搜索');
    expect(searchWrapper.text()).toContain('重置');

    expect(tableWrapper.text()).toContain('场景投放预览');
    expect(tableWrapper.text()).toContain('预览卡片加载失败');
    expect(tableWrapper.text()).toContain('预览接口可能缺少后台权限');
  });

  it('navigation 页面应渲染场景投放导航树、编辑区与预览区标题', async () => {
    const wrapper = shallowMount(NavigationPage, {
      global: {
        stubs: createGlobalStubs(),
      },
    });

    await flushMountedState();

    expect(fetchNavigationTreeMock).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('场景投放导航树');
    expect(wrapper.text()).toContain('场景投放节点编辑');
    expect(wrapper.text()).toContain('场景投放导航预览');
    expect(wrapper.text()).toContain('暂无导航节点');
    expect(wrapper.text()).toContain('仅保存排序');
    expect(wrapper.text()).toContain('保存');
  });
});
