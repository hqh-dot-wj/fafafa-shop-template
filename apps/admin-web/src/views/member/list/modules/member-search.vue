<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDatePicker,
  NForm,
  NFormItemGi,
  NGrid,
  NInput,
  NSelect,
  NSpace,
} from 'naive-ui';
import { useDict } from '@/hooks/business/dict';
import { useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';

defineOptions({
  name: 'MemberSearch',
});

interface Emits {
  (e: 'reset'): void;
  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const { formRef, validate, restoreValidation } = useNaiveForm();

const model = defineModel<Api.Member.MemberSearchParams>('model', { required: true });

type RuleKey = Extract<keyof Api.Member.MemberSearchParams, 'nickname' | 'mobile' | 'levelId'>;

const rules = computed<Record<RuleKey, App.Global.FormRule[]>>(() => ({
  nickname: [],
  mobile: [],
  levelId: [],
}));

const { options: memberLevelDictOptions } = useDict('member_level', true);
const levelOptions = computed<CommonType.Option<number, string>[]>(() =>
  memberLevelDictOptions.value.map((item) => ({
    label: item.label,
    value: Number(item.value),
  })),
);

const dateRange = ref<[number, number] | null>(null);

const dateShortcuts = computed<Record<string, () => [number, number]>>(() => ({
  [$t('page.member.search.shortcut7d')]: () => {
    const end = Date.now();
    const start = end - 7 * 24 * 3600 * 1000;
    return [start, end] as [number, number];
  },
  [$t('page.member.search.shortcut30d')]: () => {
    const end = Date.now();
    const start = end - 30 * 24 * 3600 * 1000;
    return [start, end] as [number, number];
  },
  [$t('page.member.search.shortcutMonth')]: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return [start, Date.now()] as [number, number];
  },
}));

function handleDateChange(value: [number, number] | null) {
  dateRange.value = value;
  if (value) {
    model.value['params.beginTime'] = new Date(value[0]).toISOString().slice(0, 10);
    model.value['params.endTime'] = new Date(value[1]).toISOString().slice(0, 10);
  } else {
    model.value['params.beginTime'] = null;
    model.value['params.endTime'] = null;
  }
}

async function reset() {
  dateRange.value = null;
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
    <NCollapse :default-expanded-names="['member-search']">
      <NCollapseItem :title="$t('common.search')" name="member-search">
        <NForm ref="formRef" :model="model" :rules="rules" label-placement="left" :label-width="104">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.member.search.nicknameLabel')" path="nickname" class="pr-24px">
              <NInput v-model:value="model.nickname" :placeholder="$t('page.member.search.nicknamePlaceholder')" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.member.search.mobileLabel')" path="mobile" class="pr-24px">
              <NInput v-model:value="model.mobile" :placeholder="$t('page.member.search.mobilePlaceholder')" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.member.level')" path="levelId" class="pr-24px">
              <NSelect v-model:value="model.levelId" :options="levelOptions" :placeholder="$t('page.member.search.levelPlaceholder')" clearable />
            </NFormItemGi>
            <NFormItemGi span="24 s:12 m:6" :label="$t('page.member.registerTime')" class="pr-24px">
              <NDatePicker
                :value="dateRange"
                type="daterange"
                clearable
                class="w-full"
                :shortcuts="dateShortcuts"
                :start-placeholder="$t('page.member.search.startDatePlaceholder')"
                :end-placeholder="$t('page.member.search.endDatePlaceholder')"
                @update:value="handleDateChange"
              />
            </NFormItemGi>
            <NFormItemGi span="24">
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
