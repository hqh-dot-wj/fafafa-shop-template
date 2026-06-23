<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NGi, NGrid, NSpace, NSpin, NTag } from 'naive-ui';
import type { RouteKey } from '@elegant-router/types';
import { fetchGetDashboardStats } from '@/service/api/main';
import { fetchGetJobLogList } from '@/service/api/monitor/job-log';
import { useAuth } from '@/hooks/business/auth';
import { type WorkbenchRecentItem, getWorkbenchRecent, recordWorkbenchRecent } from '@/utils/workbench-recent';
import { getRoutePath } from '@/router/elegant/transform';

defineOptions({
  name: 'QuickActions',
});

/** 调度日志执行状态：与 Api.Monitor.JobLog 注释一致，1 为失败 */
const JOB_LOG_STATUS_FAIL: Api.Common.EnableStatus = '1';

const router = useRouter();
const { hasAuth } = useAuth();
const canViewJobFailures = computed(() => hasAuth('monitor:job:list'));

// 待办数据（从 dashboard API 读取）
const pendingOrders = ref(0);
const pendingWithdrawals = ref(0);
const pendingUpgrades = ref(0);
const loading = ref(false);

async function loadPendingData() {
  loading.value = true;
  try {
    const { data } = await fetchGetDashboardStats();
    pendingOrders.value = data?.pendingOrderCount ?? 0;
    pendingWithdrawals.value = data?.pendingWithdrawalCount ?? 0;
    pendingUpgrades.value = data?.pendingUpgradeCount ?? 0;
  } catch {
    // 静默失败，不影响首页
  } finally {
    loading.value = false;
  }
}

// 快捷入口定义（route 必须为 elegant-router 路由名）
const shortcuts: Array<{ label: string; icon: string; route: RouteKey; color: string }> = [
  { label: '订单管理', icon: 'ant-design:shopping-cart-outlined', route: 'store_order_list', color: '#5b8ff9' },
  { label: '商品管理', icon: 'ant-design:appstore-outlined', route: 'store_product_list', color: '#5ad8a6' },
  { label: '会员管理', icon: 'ant-design:team-outlined', route: 'member_list', color: '#f6bd16' },
  { label: '优惠券', icon: 'ant-design:gift-outlined', route: 'marketing_coupon_template', color: '#e86452' },
  { label: '分销管理', icon: 'ant-design:share-alt-outlined', route: 'store_distribution_distribution', color: '#6dc8ec' },
  { label: '平台结算', icon: 'ant-design:dollar-outlined', route: 'finance_settlement_bill', color: '#945fb9' },
];

const recentShortcuts = ref<WorkbenchRecentItem[]>([]);

const failedJobLogs = ref<Api.Monitor.JobLog[]>([]);
const jobFailLoading = ref(false);

function refreshRecentShortcuts() {
  recentShortcuts.value = getWorkbenchRecent();
}

async function loadRecentFailedJobLogs() {
  if (!canViewJobFailures.value) return;
  jobFailLoading.value = true;
  try {
    const { data } = await fetchGetJobLogList({
      pageNum: 1,
      pageSize: 5,
      status: JOB_LOG_STATUS_FAIL,
      jobName: null,
      jobGroup: null,
      params: {},
    });
    failedJobLogs.value = data?.rows ?? [];
  } catch {
    failedJobLogs.value = [];
  } finally {
    jobFailLoading.value = false;
  }
}

function goToJobLogFailures() {
  try {
    router.push({
      path: getRoutePath('monitor_job-log'),
      query: { status: JOB_LOG_STATUS_FAIL },
    });
    recordWorkbenchRecent({ routeName: 'monitor_job-log', label: '任务日志' });
    refreshRecentShortcuts();
  } catch {
    window.$message?.warning('暂无权限访问该页面');
  }
}

function navigateTo(routeName: RouteKey, label: string) {
  try {
    router.push({ path: getRoutePath(routeName) });
    recordWorkbenchRecent({ routeName, label });
    refreshRecentShortcuts();
  } catch {
    window.$message?.warning('暂无权限访问该页面');
  }
}

/** localStorage 中的 routeName 需收窄为 elegant 路由键 */
function navigateToRecent(item: WorkbenchRecentItem) {
  navigateTo(item.routeName as RouteKey, item.label);
}

onMounted(() => {
  loadPendingData();
  loadRecentFailedJobLogs();
  refreshRecentShortcuts();
});
</script>

<template>
  <NCard :bordered="false" size="small" class="card-wrapper">
    <template #header>
      <span class="font-semibold">工作台</span>
    </template>
    <NGrid :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
      <!-- 待办事项 -->
      <NGi span="24 s:24 m:10">
        <div class="mb-12px text-14px text-gray-600 font-medium">待办事项</div>
        <NSpace vertical :size="12">
          <div
            class="flex cursor-pointer items-center justify-between rounded-8px bg-gray-50 px-16px py-12px transition-colors hover:bg-blue-50"
            @click="navigateTo('store_order_list', '待处理订单')"
          >
            <div class="flex items-center gap-8px">
              <div class="h-8px w-8px rounded-full bg-orange" />
              <span>待处理订单</span>
            </div>
            <NTag v-if="pendingOrders > 0" type="warning" size="small" round>{{ pendingOrders }}</NTag>
            <NTag v-else size="small" round>0</NTag>
          </div>
          <div
            class="flex cursor-pointer items-center justify-between rounded-8px bg-gray-50 px-16px py-12px transition-colors hover:bg-blue-50"
            @click="navigateTo('finance_distribution_withdrawal', '待审核提现')"
          >
            <div class="flex items-center gap-8px">
              <div class="h-8px w-8px rounded-full bg-red" />
              <span>待审核提现</span>
            </div>
            <NTag v-if="pendingWithdrawals > 0" type="error" size="small" round>{{ pendingWithdrawals }}</NTag>
            <NTag v-else size="small" round>0</NTag>
          </div>
          <div
            class="flex cursor-pointer items-center justify-between rounded-8px bg-gray-50 px-16px py-12px transition-colors hover:bg-blue-50"
            @click="navigateTo('member_upgrade', '待审核升级')"
          >
            <div class="flex items-center gap-8px">
              <div class="h-8px w-8px rounded-full bg-blue" />
              <span>待审核升级</span>
            </div>
            <NTag v-if="pendingUpgrades > 0" type="info" size="small" round>{{ pendingUpgrades }}</NTag>
            <NTag v-else size="small" round>0</NTag>
          </div>
        </NSpace>
      </NGi>

      <!-- 快捷入口 -->
      <NGi span="24 s:24 m:14">
        <div class="mb-12px text-14px text-gray-600 font-medium">快捷入口</div>
        <NGrid :x-gap="12" :y-gap="12" cols="3 s:3 m:3 l:6">
          <NGi v-for="item in shortcuts" :key="item.label">
            <div
              class="flex flex-col cursor-pointer items-center gap-8px rounded-8px py-16px transition-colors hover:bg-gray-50"
              @click="navigateTo(item.route, item.label)"
            >
              <div
                class="h-40px w-40px flex-center rounded-8px text-white"
                :style="{ backgroundColor: item.color }"
              >
                <SvgIcon :icon="item.icon" class="text-20px" />
              </div>
              <span class="text-12px text-gray-600">{{ item.label }}</span>
            </div>
          </NGi>
        </NGrid>
        <div v-if="recentShortcuts.length > 0" class="mt-16px">
          <div class="mb-12px text-14px text-gray-600 font-medium">最近使用</div>
          <NSpace size="small" wrap>
            <NButton
              v-for="r in recentShortcuts"
              :key="r.routeName"
              size="small"
              quaternary
              type="primary"
              @click="navigateToRecent(r)"
            >
              {{ r.label }}
            </NButton>
          </NSpace>
        </div>
      </NGi>
    </NGrid>

    <div v-if="canViewJobFailures" class="mt-20px border-t border-gray-100 pt-16px dark:border-neutral-700">
      <div class="mb-12px flex flex-wrap items-center justify-between gap-8px">
        <span class="text-14px text-gray-600 font-medium">定时任务失败（最近）</span>
        <NButton text type="primary" size="small" @click="goToJobLogFailures">查看全部</NButton>
      </div>
      <NSpin :show="jobFailLoading">
        <div v-if="failedJobLogs.length > 0" class="flex flex-col gap-8px">
          <div
            v-for="row in failedJobLogs"
            :key="String(row.jobLogId)"
            class="flex flex-col cursor-pointer gap-4px rounded-8px bg-gray-50 px-12px py-10px transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-12px dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-neutral-700"
            @click="goToJobLogFailures"
          >
            <div class="min-w-0 flex-1">
              <span class="text-13px font-medium">{{ row.jobName }}</span>
              <p class="mt-2px truncate text-12px text-gray-500" :title="row.jobMessage || undefined">
                {{ row.jobMessage || '—' }}
              </p>
            </div>
            <span class="flex-shrink-0 text-12px text-gray-400">{{ row.createTime }}</span>
          </div>
        </div>
        <div v-else class="text-13px text-gray-400">暂无最近失败记录</div>
      </NSpin>
    </div>
  </NCard>
</template>
