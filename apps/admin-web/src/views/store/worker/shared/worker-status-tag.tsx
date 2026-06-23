import { defineComponent } from 'vue';
import { NTag } from 'naive-ui';

const workerStatusMap = {
  WORKING: { label: '接单中', type: 'success' },
  RESTING: { label: '休息中', type: 'warning' },
  DISABLED: { label: '已停用', type: 'error' },
  RESIGNED: { label: '已离职', type: 'default' },
} as const;

const onlineStatusMap = {
  true: { label: '在线', type: 'success' },
  false: { label: '离线', type: 'default' },
} as const;

type TagType = 'default' | 'error' | 'info' | 'success' | 'warning';

export function getWorkerStatusLabel(status?: string) {
  return status ? workerStatusMap[status as keyof typeof workerStatusMap]?.label || '未知状态' : '-';
}

export function getOnlineStatusLabel(isOnline?: boolean) {
  if (typeof isOnline !== 'boolean') return '-';
  return onlineStatusMap[String(isOnline) as keyof typeof onlineStatusMap].label;
}

export const WorkerStatusTag = defineComponent({
  name: 'WorkerStatusTag',
  props: {
    status: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    return () => {
      const option = workerStatusMap[props.status as keyof typeof workerStatusMap];
      return <NTag type={(option?.type || 'default') as TagType}>{option?.label || '未知状态'}</NTag>;
    };
  },
});

export const OnlineStatusTag = defineComponent({
  name: 'OnlineStatusTag',
  props: {
    isOnline: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    return () => {
      const option = onlineStatusMap[String(props.isOnline) as keyof typeof onlineStatusMap];
      return <NTag type={option.type as TagType}>{option.label}</NTag>;
    };
  },
});
