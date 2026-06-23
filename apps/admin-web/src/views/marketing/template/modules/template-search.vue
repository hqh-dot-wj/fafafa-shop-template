<script setup lang="ts">
import { computed } from 'vue';
import { NButton, NCard, NCollapse, NCollapseItem, NForm, NFormItemGi, NGrid, NInput, NSpace } from 'naive-ui';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({ name: 'PlayTemplateSearch' });

interface Emits {
  (e: 'search'): void;
  (e: 'reset'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Marketing.PlayTemplateSearchParams>('model', { required: true });

type RuleKey = Extract<keyof Api.Marketing.PlayTemplateSearchParams, 'name' | 'code'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  name: [],
  code: [],
}));

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
  <!-- 玩法模板搜索区：按玩法编码和名称筛选模板定义。 -->
  <NCard :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['play-template-search']">
      <NCollapseItem :title="$t('common.search')" name="play-template-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="104">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" label="玩法编码" path="code" class="pr-24px">
              <NInput v-model:value="model.code" placeholder="如 GROUP_BUY" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" label="玩法名称" path="name" class="pr-24px">
              <NInput v-model:value="model.name" placeholder="请输入玩法名称" />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:12">
              <NSpace class="w-full" justify="end">
                <NButton @click="reset">
                  <template #icon>
                    <icon-ic-round-refresh class="text-icon" />
                  </template>
                  {{ $t('common.reset') }}
                </NButton>
                <NButton type="primary" ghost @click="search">
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
