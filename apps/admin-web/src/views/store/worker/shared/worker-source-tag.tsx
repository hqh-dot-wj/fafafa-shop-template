import { defineComponent } from 'vue';
import { NTag } from 'naive-ui';

const workerSourceMap = {
  BACKEND: { label: '后台添加', type: 'info' },
  APPLICATION: { label: '申请入驻', type: 'success' },
} as const;

const applicationSourceMap = {
  MINIAPP: { label: '小程序申请', type: 'info' },
  BACKEND: { label: '后台代提交', type: 'default' },
} as const;

type TagType = 'default' | 'error' | 'info' | 'success' | 'warning';

export function getWorkerSourceLabel(source?: string) {
  return source ? workerSourceMap[source as keyof typeof workerSourceMap]?.label || '未知来源' : '-';
}

export function getApplicationSourceLabel(source?: string) {
  return source ? applicationSourceMap[source as keyof typeof applicationSourceMap]?.label || '未知来源' : '-';
}

export const WorkerSourceTag = defineComponent({
  name: 'WorkerSourceTag',
  props: {
    source: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    return () => {
      const option = workerSourceMap[props.source as keyof typeof workerSourceMap];
      return <NTag type={(option?.type || 'default') as TagType}>{option?.label || '未知来源'}</NTag>;
    };
  },
});

export const ApplicationSourceTag = defineComponent({
  name: 'ApplicationSourceTag',
  props: {
    source: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    return () => {
      const option = applicationSourceMap[props.source as keyof typeof applicationSourceMap];
      return <NTag type={(option?.type || 'default') as TagType}>{option?.label || '未知来源'}</NTag>;
    };
  },
});
