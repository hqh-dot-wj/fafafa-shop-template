import { NButton, NTag } from 'naive-ui';
import { getCourseGroupTeamStatusMeta } from '@libs/common-constants';
import type { CourseGroupTeamSummary } from '@/service/api/marketing';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';

type CourseGroupTeamTableRow = NaiveUI.TableDataWithIndex<CourseGroupTeamSummary>;

export interface CourseGroupTeamTableActions {
  onViewDetail: (teamId: string) => void;
  onOpenMembers: (row: CourseGroupTeamSummary) => void | Promise<void>;
  onCloseTeam: (teamId: string) => void | Promise<void>;
  onGoFailure: (teamId: string) => void;
  onGoCommission: (teamId: string) => void;
}

function readString(source: unknown, key: string): string | null {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}

function formatFillSource(sourceType?: string | null) {
  if (!sourceType) return '-';
  if (sourceType === 'AUTO') return '自动补位';
  if (sourceType === 'LEADER_MANUAL') return '团长补位';
  if (sourceType === 'ADMIN_MANUAL') return '后台补位';
  return '未知来源';
}

function formatOpenMode(openMode?: string | null) {
  if (!openMode) return '自主开团';
  if (openMode === 'SELF_OPEN') return '自主开团';
  if (openMode === 'PROXY_OPEN') return '门店代开';
  return '其他方式';
}

export function createCourseGroupTeamTableColumns(
  actions: CourseGroupTeamTableActions,
): NaiveUI.TableColumn<CourseGroupTeamTableRow>[] {
  return [
    {
      key: 'teamId',
      title: '团编号',
      align: 'center',
      minWidth: 170,
      render: (row) => <span class="text-xs font-mono">{row.teamId}</span>,
    },
    {
      key: 'activityName',
      title: '活动名称',
      align: 'center',
      minWidth: 160,
      render: (row) => readString(row, 'activityName') ?? readString(row, 'activityContextKey') ?? '-',
    },
    {
      key: 'productName',
      title: '商品名称',
      align: 'center',
      minWidth: 160,
    },
    {
      key: 'tenantName',
      title: '门店名称',
      align: 'center',
      minWidth: 140,
    },
    {
      key: 'leader',
      title: '团长昵称',
      align: 'center',
      minWidth: 130,
      render: (row) => row.leader?.name || '-',
    },
    {
      key: 'openMode',
      title: '开团方式',
      align: 'center',
      minWidth: 130,
      render: (row) => formatOpenMode(readString(row, 'openMode')),
    },
    {
      key: 'classAddress',
      title: '上课地址',
      align: 'center',
      minWidth: 180,
      render: (row) => row.classAddress || '-',
    },
    {
      key: 'classStartTime',
      title: '开始时间',
      align: 'center',
      minWidth: 170,
      render: (row) => formatDateTime(row.classStartTime),
    },
    {
      key: 'classEndTime',
      title: '结束时间',
      align: 'center',
      minWidth: 170,
      render: (row) => formatDateTime(row.classEndTime),
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
      key: 'formedByVirtual',
      title: '虚拟促成',
      align: 'center',
      width: 100,
      render: (row) => (row.formedByVirtual ? '是' : '否'),
    },
    {
      key: 'minMembers',
      title: '最低人数',
      align: 'center',
      width: 90,
      render: (row) => row.minCount,
    },
    {
      key: 'maxMembers',
      title: '最高人数',
      align: 'center',
      width: 90,
      render: (row) => row.maxCount,
    },
    {
      key: 'teamStatus',
      title: '状态',
      align: 'center',
      width: 110,
      render: (row) => {
        const mapped = getCourseGroupTeamStatusMeta(row.teamStatus);
        return (
          <NTag type={mapped.tagType} size="small">
            {mapped.label}
          </NTag>
        );
      },
    },
    {
      key: 'createTime',
      title: '创建时间',
      align: 'center',
      minWidth: 170,
      render: (row) => formatDateTime(readString(row, 'createTime')),
    },
    {
      key: 'latestVirtualFillAt',
      title: '最后补位',
      align: 'center',
      minWidth: 180,
      render: (row) => {
        if (!row.latestVirtualFillAt) return '-';
        const source = formatFillSource(row.latestVirtualFillSource);
        return `${formatDateTime(row.latestVirtualFillAt)} / ${source}`;
      },
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 360,
      fixed: 'right',
      render: (row) => (
        <div class="flex-center flex-wrap gap-6px">
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent="查看详情"
            icon="material-symbols:visibility-outline"
            onClick={() => actions.onViewDetail(row.teamId)}
          />
          <NButton
            type="info"
            ghost
            size="small"
            onClick={() => {
              Promise.resolve(actions.onOpenMembers(row)).catch(() => {});
            }}
          >
            查看成员
          </NButton>
          <NButton
            type="warning"
            ghost
            size="small"
            onClick={() => {
              Promise.resolve(actions.onCloseTeam(row.teamId)).catch(() => {});
            }}
          >
            关闭拼课
          </NButton>
          <NButton type="default" quaternary size="small" onClick={() => actions.onGoFailure(row.teamId)}>
            失败处理
          </NButton>
          <NButton type="default" quaternary size="small" onClick={() => actions.onGoCommission(row.teamId)}>
            查看分佣
          </NButton>
        </div>
      ),
    },
  ];
}
