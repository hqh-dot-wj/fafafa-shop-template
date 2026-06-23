<script setup lang="tsx">
import { ref } from 'vue';
import {
  NButton,
  NCard,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSpace,
  useMessage,
} from 'naive-ui';
import { fetchAdjustPoints, fetchGetPointsAccounts } from '@/service/api/marketing/points';
import { usePickerField } from '@/hooks/business/use-picker-field';
import { useFormRules, useNaiveForm } from '@/hooks/common/form';
import { useTable } from '@/hooks/common/table';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import type { MemberPickerSelection } from '@/components/business/entity-picker.shared';
import PointsAssetLedgerPanel from './modules/points-asset-ledger-panel.vue';

defineOptions({
  name: 'PointsAccounts',
});

// 积分账户页对应 PointsAccountController / PointsManagementController。
// 账户列表是只读资产视图，只有“调整”会写积分账，必须保留会员选择、数量、备注三要素给后端审计。
const message = useMessage();
const { formRef, validate } = useNaiveForm();
const { defaultRequiredRule } = useFormRules();
const drawerVisible = ref(false);
const activeTab = ref<'accounts' | 'assetLedger'>('accounts');
const adjustMemberId = ref('');
const adjustMemberDisplayName = ref('');
const assetMemberId = ref('');
const assetMemberDisplayName = ref('');
const adjustModel = ref({ amount: 0, remark: '' });
const memberPickerVisible = ref(false);

const table = useTable({
  apiFn: fetchGetPointsAccounts,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    memberId: null,
  },
  columns: () => [
    { key: 'index', title: '序号', align: 'center', width: 64, render: (_: any, index: number) => index + 1 },
    {
      key: 'member',
      title: '会员',
      align: 'left',
      minWidth: 200,
      render: (row: any) => {
        const nickname = row.member?.nickname || row.member?.mobile || '未命名会员';
        const mobile = row.member?.mobile;
        const idText = mobile ? `${mobile} / ${row.memberId}` : row.memberId;
        return (
          <div class="flex flex-col items-start">
            <span class="truncate">{nickname}</span>
            <span class="text-xs text-gray-500 font-mono">{idText}</span>
          </div>
        );
      },
    },
    { key: 'availablePoints', title: '可用积分', align: 'center', width: 100 },
    { key: 'totalPoints', title: '累计获得', align: 'center', width: 100 },
    { key: 'usedPoints', title: '已使用', align: 'center', width: 90 },
    { key: 'createTime', title: '创建时间', align: 'center', width: 170 },
    {
      key: 'actions',
      title: '操作',
      align: 'center',
      width: 160,
      fixed: 'right',
      render: (row: any) => (
        <NSpace justify="center" size={8}>
          <NButton size="small" tertiary type="primary" onClick={() => openAssetLedger(row)}>
            资产
          </NButton>
          <NButton size="small" type="primary" onClick={() => openAdjust(row)}>
            调整
          </NButton>
        </NSpace>
      ),
    },
  ],
});

const { columns, data, getData, getDataByPage, loading, searchParams, resetSearchParams, mobilePagination } = table;

const {
  displayValue: memberDisplayValue,
  applySelection: applyMemberSelection,
  clearSelection: clearMemberSelection,
} = usePickerField({
  model: searchParams,
  key: 'memberId',
  emptyValue: null,
});

function openMemberPicker() {
  memberPickerVisible.value = true;
}

function handleMemberSelect(member: MemberPickerSelection) {
  applyMemberSelection({
    value: member.memberId,
    label: member.displayName || member.nickname || member.mobile || member.memberId,
  });
}

function handleMemberClear() {
  clearMemberSelection();
}

function handleSearchReset() {
  clearMemberSelection();
  resetSearchParams();
}

function openAdjust(row: any) {
  // 调整抽屉只从当前行取 memberId，避免运营在表格外手填会员导致调账对象错位。
  adjustMemberId.value = row.memberId;
  adjustMemberDisplayName.value = row.member?.nickname || row.member?.mobile || '会员';
  adjustModel.value = { amount: 0, remark: '' };
  drawerVisible.value = true;
}

function openAssetLedger(row: any) {
  assetMemberId.value = row.memberId;
  assetMemberDisplayName.value = row.member?.nickname || row.member?.mobile || row.memberId;
  activeTab.value = 'assetLedger';
}

const submitLoading = ref(false);
async function handleAdjustSubmit() {
  await validate();
  submitLoading.value = true;
  try {
    // 当前页面只开放后台加积分 EARN_ADMIN；扣减、冻结、退款分摊等账务动作走专门服务链路。
    await fetchAdjustPoints({
      memberId: adjustMemberId.value,
      amount: adjustModel.value.amount,
      type: 'EARN_ADMIN',
      remark: adjustModel.value.remark || undefined,
    });
    message.success('调整成功');
    drawerVisible.value = false;
    getData();
  } catch {
    // message handled by request
  } finally {
    submitLoading.value = false;
  }
}

const rules = {
  amount: defaultRequiredRule,
};
</script>

<template>
  <div class="h-full flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <NCard title="积分账户" :bordered="false" size="small" class="card-wrapper">
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="accounts" tab="账户列表">
          <!-- 查询区：会员选择器只影响账户列表筛选，不直接写入积分账户。 -->
          <NForm inline class="mb-16px" label-placement="left" :label-width="80">
            <NFormItem label="会员名称">
              <NInput
                v-model:value="memberDisplayValue"
                placeholder="点击选择会员"
                clearable
                readonly
                class="w-200px"
                @click="openMemberPicker"
                @clear="handleMemberClear"
              />
            </NFormItem>
            <NSpace>
              <NButton type="primary" @click="getData">查询</NButton>
              <NButton @click="handleSearchReset">重置</NButton>
            </NSpace>
          </NForm>

          <!-- 账户列表：资产按钮进入只读账务解释，不开放 allocation 手工修改。 -->
          <NDataTable
            :columns="columns"
            :data="data"
            :loading="loading"
            :pagination="mobilePagination"
            :row-key="(row: any) => row.id"
            remote
            @update:page="getDataByPage"
          />
        </NTabPane>
        <NTabPane name="assetLedger" tab="资产账">
          <PointsAssetLedgerPanel :member-id="assetMemberId" :member-name="assetMemberDisplayName" />
        </NTabPane>
      </NTabs>
    </NCard>

    <NDrawer v-model:show="drawerVisible" :width="400">
      <NDrawerContent title="调整积分" closable>
        <NForm
          ref="formRef"
          :model="adjustModel"
          :rules="rules"
          label-placement="left"
          label-width="80"
          class="mt-16px"
        >
          <NFormItem label="会员名称">
            <NInput :value="adjustMemberDisplayName" readonly />
          </NFormItem>
          <NFormItem label="调整数量" path="amount" required>
            <NInputNumber v-model:value="adjustModel.amount" :min="1" placeholder="增加积分数量" class="w-full" />
          </NFormItem>
          <NFormItem label="备注" path="remark">
            <NInput v-model:value="adjustModel.remark" type="textarea" placeholder="选填" />
          </NFormItem>
          <NFormItem>
            <NButton type="primary" :loading="submitLoading" @click="handleAdjustSubmit">确定</NButton>
          </NFormItem>
        </NForm>
      </NDrawerContent>
    </NDrawer>

    <MemberSelectModal
      v-model:visible="memberPickerVisible"
      :selected="
        memberDisplayValue && searchParams.memberId
          ? { memberId: searchParams.memberId, displayName: memberDisplayValue }
          : null
      "
      @select="handleMemberSelect"
    />
  </div>
</template>

<style scoped>
.card-wrapper {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
</style>
