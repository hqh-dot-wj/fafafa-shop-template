import { defineComponent } from 'vue';
import { NTag } from 'naive-ui';

const applicationStatusMap = {
  PENDING: { label: '待审核', type: 'warning' },
  APPROVED: { label: '已通过', type: 'success' },
  REJECTED: { label: '已拒绝', type: 'error' },
} as const;

type TagType = 'default' | 'error' | 'info' | 'success' | 'warning';

export function getApplicationStatusLabel(status?: string) {
  return status ? applicationStatusMap[status as keyof typeof applicationStatusMap]?.label || '未知状态' : '-';
}

export const ApplicationStatusTag = defineComponent({
  name: 'ApplicationStatusTag',
  props: {
    status: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    return () => {
      const option = applicationStatusMap[props.status as keyof typeof applicationStatusMap];
      return <NTag type={(option?.type || 'default') as TagType}>{option?.label || '未知状态'}</NTag>;
    };
  },
});
