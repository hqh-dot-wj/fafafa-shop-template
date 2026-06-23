import { NTag } from 'naive-ui';
import type { ScenePreviewCard } from '@/service/api/marketing';

function formatActivityTypeLabel(value: string | null | undefined) {
  if (!value) return '-';
  if (value === 'COURSE_GROUP') return '拼课活动';
  return value;
}

function formatShelfStatusLabel(value: string | null | undefined) {
  if (!value) return '-';
  if (value === 'ON_SHELF') return '上架';
  if (value === 'OFF_SHELF') return '下架';
  return value;
}

export function createScenePreviewTableColumns(): NaiveUI.TableColumn<ScenePreviewCard>[] {
  return [
    {
      key: 'moduleName',
      title: '模块名称',
      align: 'center',
      minWidth: 140,
    },
    {
      key: 'productId',
      title: '商品编号',
      align: 'center',
      minWidth: 150,
      render: (row) => <span class="text-xs font-mono">{row.productId}</span>,
    },
    {
      key: 'productName',
      title: '商品名称',
      align: 'center',
      minWidth: 180,
    },
    {
      key: 'displayPrice',
      title: '展示价',
      align: 'center',
      width: 120,
      render: (row) => `￥${Number(row.displayPrice ?? 0).toFixed(2)}`,
    },
    {
      key: 'originalPrice',
      title: '原价',
      align: 'center',
      width: 120,
      render: (row) => `￥${Number(row.originalPrice ?? 0).toFixed(2)}`,
    },
    {
      key: 'activityType',
      title: '活动类型',
      align: 'center',
      width: 130,
      render: (row) => formatActivityTypeLabel(row.activityType),
    },
    {
      key: 'activityContextKey',
      title: '上下文键',
      align: 'center',
      minWidth: 200,
      render: (row) => <span class="text-xs font-mono">{row.activityContextKey || '-'}</span>,
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 120,
      render: (row) => {
        const onShelf = row.status === 'ON_SHELF';
        return (
          <NTag size="small" type={onShelf ? 'success' : 'warning'}>
            {formatShelfStatusLabel(row.status)}
          </NTag>
        );
      },
    },
  ];
}
