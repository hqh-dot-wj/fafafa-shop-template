<script setup lang="ts">
import { reactive } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSelect, NSpace } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'ScenePreviewSearch' });

type PreviewChannel = 'MINIAPP' | 'H5' | 'ADMIN_PREVIEW';

const sceneCode = defineModel<string>('sceneCode', { required: true });
const channel = defineModel<PreviewChannel>('channel', { required: true });
const memberId = defineModel<string>('memberId', { required: true });
const clientVersion = defineModel<string>('clientVersion', { required: true });

defineProps<{
  sceneLoading: boolean;
  previewLoading: boolean;
  sceneOptions: Array<{ label: string; value: string }>;
  channelOptions: Array<{ label: string; value: PreviewChannel }>;
}>();

const emit = defineEmits<{
  sceneChange: [];
  reset: [];
  search: [];
}>();

const formModel = reactive({
  get sceneCode() {
    return sceneCode.value;
  },
  set sceneCode(v: string) {
    sceneCode.value = v;
  },
  get channel() {
    return channel.value;
  },
  set channel(v: PreviewChannel) {
    channel.value = v;
  },
  get memberId() {
    return memberId.value;
  },
  set memberId(v: string) {
    memberId.value = v;
  },
  get clientVersion() {
    return clientVersion.value;
  },
  set clientVersion(v: string) {
    clientVersion.value = v;
  },
});

const { formRef, validate, restoreValidation } = useNaiveForm();

type RuleKey = 'sceneCode' | 'channel' | 'memberId' | 'clientVersion';

const rules: Record<RuleKey, App.Global.FormRule[]> = {
  sceneCode: [],
  channel: [],
  memberId: [],
  clientVersion: [],
};

async function reset() {
  await restoreValidation();
  emit('reset');
}

async function search() {
  await validate();
  emit('search');
}
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['scene-preview-search']">
      <NCollapseItem :title="$t('common.search')" name="scene-preview-search">
        <!-- 搜索条件：场景决定发布快照，模拟上下文决定会员受众和版本差异。 -->
        <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" :label-width="88">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:10" label="场景" path="sceneCode" class="min-w-0 pr-24px">
              <NSelect
                v-model:value="formModel.sceneCode"
                :loading="sceneLoading"
                :options="sceneOptions"
                class="max-w-full w-full"
                filterable
                clearable
                placeholder="请选择场景"
                @update:value="emit('sceneChange')"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:7" label="渠道" path="channel" class="min-w-0 pr-24px">
              <NSelect
                v-model:value="formModel.channel"
                class="max-w-full w-full"
                :options="channelOptions"
                placeholder="请选择渠道"
                @update:value="emit('sceneChange')"
              />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:7" label="会员ID" path="memberId" class="min-w-0 pr-24px">
              <NInput v-model:value="formModel.memberId" clearable placeholder="请输入会员ID" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:7" label="客户端版本" path="clientVersion" class="min-w-0 pr-24px">
              <NInput v-model:value="formModel.clientVersion" clearable placeholder="如 1.2.0" />
            </NFormItemGi>
            <NFormItemGi span="24">
              <NSpace class="w-full" justify="end">
                <NButton :loading="sceneLoading" @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh class="text-icon" />
                  </template>
                  {{ $t('common.reset') }}
                </NButton>
                <NButton type="primary" ghost :loading="previewLoading" @click="search">
                  <template #icon>
                    <icon-ic-round-search class="text-icon" />
                  </template>
                  {{ $t('common.search') }}
                </NButton>
              </NSpace>
            </NFormItemGi>
          </NGrid>
        </NForm>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

<style scoped></style>
