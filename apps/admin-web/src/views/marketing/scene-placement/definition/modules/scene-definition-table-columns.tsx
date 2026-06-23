import { NTag } from 'naive-ui';
import type { SceneDefinition } from '@/service/api/marketing';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import {
  formatActivityTypeFilter,
  formatCardTemplate,
  formatSceneType,
} from './scene-definition-labels';

type SceneDefinitionRow = NaiveUI.TableDataWithIndex<SceneDefinition>;

export interface SceneDefinitionTableActions {
  onEdit: (row: SceneDefinition) => void;
}

function readString(source: unknown, key: string): string | null {
  if (!source || typeof source !== 'object') return null;
  const value = (source as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readPlacementString(row: SceneDefinition, key: string): string | null {
  const flat = readString(row, key);
  if (flat) return flat;
  const cfg = row.placementConfig;
  if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
    const v = (cfg as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function getStoreMatchModeLabel(storeMatchMode: string | null | undefined) {
  if (!storeMatchMode) return '-';
  if (storeMatchMode === 'CURRENT_STORE') return '当前定位门店';
  if (storeMatchMode === 'ALL_STORES') return '全门店可见';
  return storeMatchMode;
}

function getSortModeLabel(sortMode: string | null | undefined) {
  if (!sortMode) return '-';
  if (sortMode === 'RECOMMEND_WEIGHT') return '推荐权重';
  if (sortMode === 'UPDATE_TIME') return '更新时间';
  return sortMode;
}

export function createSceneDefinitionTableColumns(
  actions: SceneDefinitionTableActions,
): NaiveUI.TableColumn<SceneDefinitionRow>[] {
  return [
    {
      key: 'sceneName',
      title: '场景名称',
      align: 'center',
      minWidth: 160,
    },
    {
      key: 'sceneCode',
      title: '场景编码',
      align: 'center',
      minWidth: 160,
      render: (row) => <span class="text-xs font-mono">{row.sceneCode}</span>,
    },
    {
      key: 'sceneType',
      title: '场景类型',
      align: 'center',
      width: 140,
      render: (row) => formatSceneType(readString(row, 'sceneType') ?? row.sceneType),
    },
    {
      key: 'activityTypeFilter',
      title: '活动类型过滤',
      align: 'center',
      minWidth: 130,
      render: (row) => formatActivityTypeFilter(readPlacementString(row, 'activityTypeFilter')),
    },
    {
      key: 'storeMatchMode',
      title: '匹配门店方式',
      align: 'center',
      minWidth: 140,
      render: (row) => getStoreMatchModeLabel(readPlacementString(row, 'storeMatchMode')),
    },
    {
      key: 'sortMode',
      title: '排序方式',
      align: 'center',
      minWidth: 120,
      render: (row) => getSortModeLabel(readPlacementString(row, 'sortMode')),
    },
    {
      key: 'cardTemplate',
      title: '卡片模板',
      align: 'center',
      minWidth: 160,
      render: (row) => {
        const code = row.defaultCardTemplateCode?.trim();
        if (!code) {
          return <span class="text-12px text-gray-500">未配置</span>;
        }
        const label = formatCardTemplate(code);
        const showCodeLine = label !== code;
        return (
          <div class="flex flex-col items-center gap-2px px-4px">
            <span class={`max-w-220px truncate text-sm ${showCodeLine ? '' : 'font-mono text-12px text-gray-600'}`}>{label}</span>
            {showCodeLine ? <span class="text-11px text-gray-500 font-mono">{code}</span> : null}
          </div>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 100,
      render: (row) => {
        let type: 'success' | 'warning' | 'default' = 'default';
        let label = '停用';
        if (row.status === 'ACTIVE') {
          type = 'success';
          label = '启用';
        } else if (row.status === 'DRAFT') {
          type = 'warning';
          label = '草稿';
        }
        return (
          <NTag type={type} size="small">
            {label}
          </NTag>
        );
      },
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 100,
      fixed: 'right',
      render: (row) => (
        <div class="flex-center">
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent={$t('common.edit')}
            icon="material-symbols:edit-square-outline"
            onClick={() => actions.onEdit(row)}
          />
        </div>
      ),
    },
  ];
}
