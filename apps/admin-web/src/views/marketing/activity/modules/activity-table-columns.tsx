import { NButton, NTag } from 'naive-ui';
import type { MarketingActivity } from '@/service/api/marketing';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';

export type ActivityStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
export type ActivityTableRow = NaiveUI.TableDataWithIndex<MarketingActivity>;

export interface ActivityStatusMeta {
  value: ActivityStatus;
  label: string;
  type: 'default' | 'success' | 'warning' | 'error';
}

export interface ActivityTableActions {
  onViewDetail: (activityId: string) => void;
  onOpenEdit: (activity: MarketingActivity) => void;
  onDuplicate: (activity: MarketingActivity) => void;
  onChangeStatus: (activityId: string, action: 'publish' | 'pause' | 'archive') => void;
}

/** 与种子和 campaign draft 的活动类型一致，未命中时回退显示原始 type。 */
export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  NEWCOMER_EXCLUSIVE: '新人专享',
  FIRST_ORDER: '首单优惠',
  FULL_REDUCTION: '满减活动',
  MEMBER_DAY: '会员日',
  GROUP_BUY: '拼团活动',
  FLASH_SALE: '限时抢购',
  COURSE_GROUP: '团课拼团',
  COURSE_GROUP_BUY: '团课拼团',
  MEMBER_UPGRADE: '会员升级',
  PROMOTION_PRICE: '促销活动',
  BIRTHDAY: '生日礼遇',
};

const ACTIVITY_STATUS_META_MAP: Record<ActivityStatus, ActivityStatusMeta> = {
  DRAFT: { value: 'DRAFT', label: '草稿', type: 'error' },
  PUBLISHED: { value: 'PUBLISHED', label: '已发布', type: 'success' },
  PAUSED: { value: 'PAUSED', label: '已暂停', type: 'warning' },
  ARCHIVED: { value: 'ARCHIVED', label: '已归档', type: 'default' },
};

function toRecord(source: unknown): Record<string, unknown> {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return source as Record<string, unknown>;
}

function readArray(source: unknown, key: string): unknown[] {
  const value = toRecord(source)[key];
  return Array.isArray(value) ? value : [];
}

function readString(source: unknown, key: string): string | null {
  const value = toRecord(source)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(source: unknown, key: string): boolean {
  const value = toRecord(source)[key];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return false;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}

function formatActivityType(type: string) {
  return ACTIVITY_TYPE_LABEL[type] ?? type;
}

export function resolveActivityStatus(row: MarketingActivity): ActivityStatusMeta {
  return ACTIVITY_STATUS_META_MAP[row.status] ?? ACTIVITY_STATUS_META_MAP.DRAFT;
}

export function createActivityTableColumns(actions: ActivityTableActions): NaiveUI.TableColumn<ActivityTableRow>[] {
  return [
    {
      key: 'name',
      title: '活动名称',
      align: 'center',
      minWidth: 180,
    },
    {
      key: 'id',
      title: '活动 ID',
      align: 'center',
      minWidth: 180,
      render: (row) => <span class="text-xs font-mono">{row.id}</span>,
    },
    {
      key: 'tenant',
      title: '所属租户',
      align: 'left',
      minWidth: 200,
      render: (row) => (
        <div class="flex-col gap-4px">
          <span class="font-medium">{row.tenantName?.trim() || '—'}</span>
          <span class="text-12px text-gray-500 font-mono">tenantId: {row.tenantId}</span>
        </div>
      ),
    },
    {
      key: 'type',
      title: '活动类型',
      align: 'center',
      width: 120,
      render: (row) => formatActivityType(row.type),
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 110,
      render: (row) => {
        const status = ACTIVITY_STATUS_META_MAP[row.status] ?? ACTIVITY_STATUS_META_MAP.DRAFT;
        return (
          <NTag type={status.type} size="small">
            {status.label}
          </NTag>
        );
      },
    },
    {
      key: 'itemCount',
      title: '活动商品',
      align: 'center',
      width: 100,
      render: (row) => readArray(row.rules, 'activityItems').length,
    },
    {
      key: 'sceneCount',
      title: '场景',
      align: 'center',
      width: 100,
      render: (row) => readArray(row.rules, 'sceneBindings').length,
    },
    {
      key: 'startTime',
      title: '开始时间',
      align: 'center',
      minWidth: 170,
      render: (row) => formatDateTime(row.startTime),
    },
    {
      key: 'endTime',
      title: '结束时间',
      align: 'center',
      minWidth: 170,
      render: (row) => formatDateTime(row.endTime),
    },
    {
      key: 'commissionStatus',
      title: '分佣',
      align: 'center',
      width: 100,
      render: (row) => {
        const enabled = readBoolean(row.rules, 'commissionEnabled');
        return (
          <NTag type={enabled ? 'success' : 'default'} size="small">
            {enabled ? '开启' : '关闭'}
          </NTag>
        );
      },
    },
    {
      key: 'publishTime',
      title: '最近发布',
      align: 'center',
      minWidth: 170,
      render: (row) => formatDateTime(readString(row.rules, 'lastPublishTime') ?? row.updateTime),
    },
    {
      key: 'owner',
      title: '负责人',
      align: 'center',
      width: 120,
      render: (row) => readString(row.triggerCondition, 'ownerUserId') ?? '-',
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 320,
      fixed: 'right',
      render: (row) => {
        const status = ACTIVITY_STATUS_META_MAP[row.status] ?? ACTIVITY_STATUS_META_MAP.DRAFT;
        const canPublish = status.value === 'DRAFT' || status.value === 'PAUSED';
        const canPause = status.value === 'PUBLISHED';
        const canArchive = status.value !== 'ARCHIVED';

        return (
          <div class="flex-center flex-wrap gap-6px">
            <ButtonIcon
              type="default"
              class="text-primary"
              tooltipContent="详情"
              icon="material-symbols:visibility-outline"
              onClick={() => actions.onViewDetail(row.id)}
            />
            <ButtonIcon
              type="primary"
              class="text-primary"
              tooltipContent={$t('common.edit')}
              icon="material-symbols:edit-square-outline"
              onClick={() => actions.onOpenEdit(row)}
            />
            <NButton
              type="success"
              ghost
              size="small"
              disabled={!canPublish}
              onClick={() => actions.onChangeStatus(row.id, 'publish')}
            >
              发布
            </NButton>
            <NButton
              type="warning"
              ghost
              size="small"
              disabled={!canPause}
              onClick={() => actions.onChangeStatus(row.id, 'pause')}
            >
              暂停
            </NButton>
            <NButton type="info" ghost size="small" onClick={() => actions.onDuplicate(row)}>
              复制
            </NButton>
            <NButton
              type="error"
              ghost
              size="small"
              disabled={!canArchive}
              onClick={() => actions.onChangeStatus(row.id, 'archive')}
            >
              归档
            </NButton>
          </div>
        );
      },
    },
  ];
}
