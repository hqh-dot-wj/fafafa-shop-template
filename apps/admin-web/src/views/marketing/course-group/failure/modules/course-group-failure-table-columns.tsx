import { NButton, NTag } from 'naive-ui';
import { getCourseGroupTeamStatusMeta } from '@libs/common-constants';
import type { CourseGroupTeamSummary } from '@/service/api/marketing';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';

type CourseGroupFailureTableRow = NaiveUI.TableDataWithIndex<CourseGroupTeamSummary>;

export interface CourseGroupFailureTableActions {
  onOpenDetail: (row: CourseGroupTeamSummary) => void | Promise<void>;
  onCloseTeam: (teamId: string) => void | Promise<void>;
  onGoTeamDetail: (teamId: string) => void;
}

export function createCourseGroupFailureTableColumns(
  actions: CourseGroupFailureTableActions,
): NaiveUI.TableColumn<CourseGroupFailureTableRow>[] {
  return [
    {
      key: 'teamId',
      title: '团编号',
      align: 'center',
      minWidth: 170,
      render: (row) => <span class="text-xs font-mono">{row.teamId}</span>,
    },
    {
      key: 'productName',
      title: '商品名称',
      align: 'center',
      minWidth: 170,
    },
    {
      key: 'tenantName',
      title: '门店',
      align: 'center',
      minWidth: 140,
    },
    {
      key: 'leader',
      title: '团长',
      align: 'center',
      minWidth: 120,
      render: (row) => row.leader?.name || '-',
    },
    {
      key: 'teamStatus',
      title: '状态',
      align: 'center',
      width: 110,
      render: (row) => {
        const meta = getCourseGroupTeamStatusMeta(row.teamStatus);
        return (
          <NTag type={meta.tagType} size="small">
            {meta.label}
          </NTag>
        );
      },
    },
    {
      key: 'currentMembers',
      title: '有效人数',
      align: 'center',
      width: 90,
    },
    {
      key: 'realMemberCount',
      title: '真实人数',
      align: 'center',
      width: 90,
    },
    {
      key: 'virtualMemberCount',
      title: '虚拟人数',
      align: 'center',
      width: 90,
    },
    {
      key: 'paidMembers',
      title: '真实已付费',
      align: 'center',
      width: 110,
    },
    {
      key: 'ruleSummary',
      title: '失败上下文',
      align: 'center',
      minWidth: 180,
      render: (row) => row.ruleSummary || row.revenueHint || '-',
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 280,
      fixed: 'right',
      render: (row) => (
        <div class="flex-center flex-wrap gap-6px">
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent="查看详情"
            icon="material-symbols:visibility-outline"
            onClick={() => {
              Promise.resolve(actions.onOpenDetail(row)).catch(() => {});
            }}
          />
          <NButton
            size="small"
            type="warning"
            ghost
            onClick={() => {
              Promise.resolve(actions.onCloseTeam(row.teamId)).catch(() => {});
            }}
          >
            关闭拼课
          </NButton>
          <NButton size="small" quaternary onClick={() => actions.onGoTeamDetail(row.teamId)}>
            前往团详情
          </NButton>
        </div>
      ),
    },
  ];
}
