<script setup lang="tsx">
import { computed, reactive } from 'vue';
import { NButton, NCard, NForm, NFormItem, NSelect, useMessage } from 'naive-ui';
import {
  fetchCouponDistributeManual,
  fetchGetCouponTemplateList,
  fetchGetUserCoupons,
} from '@/service/api/marketing/coupon';
import { fetchGetMemberList } from '@/service/api/member/member';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { $t } from '@/locales';
import CouponRecordSearch from './modules/coupon-record-search.vue';

defineOptions({
  name: 'CouponDistribution',
});

type UserCouponRow = Api.Marketing.UserCoupon & {
  index: number;
  nickname?: string;
  mobile?: string;
  memberName?: string;
  memberNickname?: string;
  member?: {
    nickname?: string;
    mobile?: string;
  };
};

const message = useMessage();
const appStore = useAppStore();
const { formRef, validate } = useNaiveForm();
const { defaultRequiredRule } = useFormRules();

const model = reactive({
  templateId: null as string | null,
  memberIds: [] as string[],
});

const rules = {
  templateId: defaultRequiredRule,
  memberIds: [
    {
      required: true,
      type: 'array' as const,
      trigger: ['blur', 'change'],
      message: '请至少选择一个会员',
    },
  ],
};

const { data: templateData, loading: templateLoading } = useTable({
  apiFn: fetchGetCouponTemplateList,
  apiParams: {
    pageNum: 1,
    pageSize: 100,
    status: 'ACTIVE',
  },
  columns: () => [],
});

const { data: memberData, loading: memberLoading } = useTable({
  apiFn: fetchGetMemberList,
  apiParams: {
    pageNum: 1,
    pageSize: 100,
  },
  columns: () => [],
});

const templateOptions = computed(() => {
  return (templateData.value || []).map((t) => ({
    label: `${t.name} (面值: ${t.value}${t.type === 'CASH' ? '元' : '%'})`,
    value: t.id,
  }));
});

const memberOptions = computed(() => {
  return (memberData.value || []).map((m) => ({
    label: `${m.nickname} (${m.mobile})`,
    value: m.memberId,
  }));
});

const {
  columns: recordColumns,
  data: recordData,
  getData: getRecordData,
  getDataByPage,
  loading: recordLoading,
  searchParams,
  resetSearchParams,
  mobilePagination,
  scrollX,
} = useTable({
  apiFn: fetchGetUserCoupons,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    memberId: null,
    status: null,
  },
  columns: () => [
    {
      key: 'index',
      title: $t('common.index'),
      align: 'center',
      width: 64,
      render: (row: UserCouponRow) => row.index,
    },
    {
      key: 'couponName',
      title: '优惠券名称',
      align: 'center',
      minWidth: 140,
      ellipsis: { tooltip: true },
      render: (row: UserCouponRow) => row.couponName ?? row.templateName ?? '-',
    },
    {
      key: 'typeValue',
      title: '类型/面值',
      align: 'center',
      width: 100,
      render: (row: UserCouponRow) => {
        const type = row.couponType ?? row.type;
        if (type === 'PERCENTAGE' && row.discountPercent != null) return `${row.discountPercent}%`;
        if (row.discountAmount != null) return `¥${row.discountAmount}`;
        return row.value != null ? `${row.value}` : '-';
      },
    },
    {
      key: 'member',
      title: '会员',
      align: 'left',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row: UserCouponRow) => {
        const nickname =
          row.member?.nickname || row.memberNickname || row.memberName || row.nickname || row.mobile || '未命名会员';
        const mobile = row.member?.mobile || row.mobile;
        const idText = mobile ? `${mobile} / ${row.memberId}` : row.memberId;
        return (
          <div class="flex flex-col items-start">
            <span class="truncate">{nickname}</span>
            <span class="font-mono text-xs text-gray-500">{idText}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 88,
      render: (row: UserCouponRow) => {
        const map: Record<string, string> = {
          UNUSED: '未使用',
          USED: '已使用',
          EXPIRED: '已过期',
          LOCKED: '已锁定',
        };
        return map[row.status] ?? row.status;
      },
    },
    {
      key: 'distributionType',
      title: '发放方式',
      align: 'center',
      width: 88,
      render: (row: UserCouponRow) => {
        const map: Record<string, string> = {
          MANUAL: '手动发放',
          ACTIVITY: '活动领取',
          ORDER: '订单赠送',
        };
        return map[row.distributionType ?? ''] ?? '-';
      },
    },
    {
      key: 'receiveTime',
      title: '领取时间',
      align: 'center',
      width: 170,
      render: (row: UserCouponRow) =>
        (row.receiveTime ?? row.createTime ?? '-').toString().replace('T', ' ').slice(0, 19),
    },
    {
      key: 'usedTime',
      title: '使用时间',
      align: 'center',
      width: 170,
      render: (row: UserCouponRow) =>
        row.usedTime ? row.usedTime.toString().replace('T', ' ').slice(0, 19) : '-',
    },
  ],
});

async function handleDistribute() {
  await validate();
  if (!model.templateId || model.memberIds.length === 0) return;
  try {
    const { data } = await fetchCouponDistributeManual({
      templateId: model.templateId,
      memberIds: model.memberIds,
    });
    const list = Array.isArray(data) ? data : [];
    const count = list.filter((r) => r.success).length;
    message.success(`成功向 ${count} 名会员发放了优惠券`);
    model.templateId = null;
    model.memberIds = [];
    getRecordData();
  } catch {
    // 错误提示由 request 层处理
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="手动发放" :bordered="false" size="small" class="card-wrapper">
      <NForm
        ref="formRef"
        :model="model"
        :rules="rules"
        label-placement="left"
        :label-width="120"
        class="mx-auto mt-24px max-w-800px"
      >
        <NFormItem label="选择优惠券" path="templateId">
          <NSelect
            v-model:value="model.templateId"
            :options="templateOptions"
            :loading="templateLoading"
            placeholder="请选择要发放的优惠券模板"
            filterable
          />
        </NFormItem>

        <NFormItem label="目标会员" path="memberIds">
          <NSelect
            v-model:value="model.memberIds"
            multiple
            :options="memberOptions"
            :loading="memberLoading"
            placeholder="请选择目标会员 (可多选)"
            filterable
            class="min-h-120px"
          />
        </NFormItem>

        <div class="mt-32px flex justify-center">
          <NButton type="primary" size="large" class="px-64px" @click="handleDistribute">开始发放</NButton>
        </div>
      </NForm>
    </NCard>

    <NCard title="发放记录" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <div class="flex flex-col gap-12px sm:min-h-0 sm:flex-1">
        <CouponRecordSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
        <NDataTable
          :columns="recordColumns"
          :data="recordData"
          :loading="recordLoading"
          :pagination="mobilePagination"
          :row-key="(row: UserCouponRow) => row.id"
          remote
          :flex-height="!appStore.isMobile"
          :scroll-x="scrollX"
          class="sm:h-full"
        />
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.min-h-120px {
  min-height: 120px;
}
</style>
