import { NButton, NTag } from 'naive-ui';
import { getCourseGroupTeamStatusMeta } from '@libs/common-constants';
import type { CourseGroupTeamSummary } from '@/service/api/marketing';
import { formatPrice } from '@/utils/money';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';

type CourseGroupCommissionTableRow = NaiveUI.TableDataWithIndex<CourseGroupTeamSummary>;

export interface CourseGroupCommissionTableActions {
  onGoTeamDetail: (teamId: string) => void;
  onGoFailure: (teamId: string) => void;
}

export function createCourseGroupCommissionTableColumns(
  actions: CourseGroupCommissionTableActions,
): NaiveUI.TableColumn<CourseGroupCommissionTableRow>[] {
  return [
    {
      key: 'teamId',
      title: '团编号',
      align: 'center',
      minWidth: 180,
      render: (row) => <span class="text-xs font-mono">{row.teamId}</span>,
    },
    {
      key: 'productName',
      title: '商品名称',
      align: 'center',
      minWidth: 180,
    },
    {
      key: 'tenantName',
      title: '门店',
      align: 'center',
      minWidth: 150,
    },
    {
      key: 'realPaidMemberCount',
      title: '真实已付/有效',
      align: 'center',
      width: 140,
      render: (row) => `${row.realPaidMemberCount}/${row.effectiveMemberCount || row.currentMembers}`,
    },
    {
      key: 'realPaidAmount',
      title: '真实支付金额',
      align: 'center',
      width: 150,
      render: (row) => `¥${formatPrice(row.realPaidAmount)}`,
    },
    {
      key: 'commissionBaseAmount',
      title: '可分佣基数',
      align: 'center',
      width: 180,
      render: (row) => `¥${formatPrice(row.commissionBaseAmount)}`,
    },
    {
      key: 'commissionAmount',
      title: '真实佣金记录',
      align: 'center',
      width: 180,
      render: (row) => `¥${formatPrice(row.commissionAmount)}`,
    },
    {
      key: 'teamStatus',
      title: '状态',
      align: 'center',
      width: 120,
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
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 220,
      fixed: 'right',
      render: (row) => (
        <div class="flex-center flex-wrap gap-6px">
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent="查看详情"
            icon="material-symbols:visibility-outline"
            onClick={() => actions.onGoTeamDetail(row.teamId)}
          />
          <NButton size="small" quaternary onClick={() => actions.onGoFailure(row.teamId)}>
            失败处理
          </NButton>
        </div>
      ),
    },
  ];
}
