import type { Ref } from 'vue';
import { NButton, NTag } from 'naive-ui';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';

interface CreateSceneTableColumnsOptions {
  precheckingSceneCode: Ref<string | null>;
  publishingSceneCode: Ref<string | null>;
  onEdit: (row: Api.Marketing.MarketingScene) => void;
  onPrecheck: (sceneCode: string) => void;
  onPublish: (sceneCode: string) => void;
}

export function createSceneTableColumns(
  options: CreateSceneTableColumnsOptions,
): NaiveUI.TableColumn<Api.Marketing.MarketingScene>[] {
  const { precheckingSceneCode, publishingSceneCode, onEdit, onPrecheck, onPublish } = options;
  const statusMeta = {
    ACTIVE: { label: '启用', type: 'success' },
    DRAFT: { label: '草稿', type: 'warning' },
  } as const;

  return [
    {
      key: 'sceneCode',
      title: '场景编码',
      align: 'center',
      minWidth: 140,
      render: (row) => (
        <NTag type="info" bordered={false} class="font-mono">
          {row.sceneCode}
        </NTag>
      ),
    },
    { key: 'sceneName', title: '场景名称', align: 'center', minWidth: 160 },
    { key: 'sceneType', title: '场景类型', align: 'center', minWidth: 120 },
    {
      key: 'channelScope',
      title: '渠道',
      align: 'center',
      minWidth: 140,
      render: (row) => (Array.isArray(row.channelScope) ? row.channelScope.join(', ') : '-'),
    },
    { key: 'pageRoute', title: '路由', align: 'center', minWidth: 180 },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 100,
      render: (row) => (
        <NTag type={statusMeta[row.status as keyof typeof statusMeta]?.type ?? 'default'} size="small">
          {statusMeta[row.status as keyof typeof statusMeta]?.label ?? '停用'}
        </NTag>
      ),
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 280,
      render: (row) => (
        <div class="flex-center gap-8px">
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent={$t('common.edit')}
            icon="material-symbols:edit-square-outline"
            onClick={() => onEdit(row)}
          />
          <NButton
            type="info"
            ghost
            size="small"
            loading={precheckingSceneCode.value === row.sceneCode}
            onClick={() => onPrecheck(row.sceneCode)}
          >
            预检
          </NButton>
          <NButton
            type="primary"
            ghost
            size="small"
            loading={publishingSceneCode.value === row.sceneCode}
            onClick={() => onPublish(row.sceneCode)}
          >
            发布
          </NButton>
        </div>
      ),
    },
  ];
}
