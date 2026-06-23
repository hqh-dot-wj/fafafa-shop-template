<script setup lang="ts">
import { computed } from 'vue';
import { useUserStore } from '@/store/user';

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'create', activity: Props['activity']): void;
}>();

const userStore = useUserStore();

interface Props {
  activity: {
    configId: string;
    type: string;
    rules: {
      price: number;
      minCount: number;
      maxCount: number;
      leaderDiscount?: number;
      leaderMustBeDistributor?: boolean;
      leaderFree?: boolean;
    };
    displayData?: {
      countText?: string;
      lessonSummary?: string;
      joinDeadlineText?: string;
    };
  };
}

const coursePrice = computed(() => {
  return props.activity.rules.price || 0;
});

const leaderPrice = computed(() => {
  const rules = props.activity.rules;
  if (rules.leaderFree) return 0;
  const price = rules.price || 0;
  const discount = rules.leaderDiscount || 0;
  return Math.max(0, price - discount);
});

const canStartTeam = computed(() => {
  if (!props.activity.rules.leaderMustBeDistributor) return true;
  return userStore.isDistributor;
});

function handleCreateTeam() {
  emit('create', props.activity);
}
</script>

<template>
  <view class="course-widget mt-20rpx bg-white p-30rpx">
    <view class="mb-20rpx flex items-center justify-between">
      <view class="flex items-center gap-12rpx">
        <text class="border border-hex-ff4d4f rounded-6rpx px-12rpx py-4rpx text-28rpx text-hex-ff4d4f font-600">
          拼课专享
        </text>
        <text class="text-24rpx text-hex-999">{{ activity.displayData?.countText || '多人开班' }}</text>
      </view>
      <text class="text-24rpx text-hex-999">截止: {{ activity.displayData?.joinDeadlineText || '长期有效' }}</text>
    </view>

    <view class="mb-20rpx flex items-end gap-16rpx">
      <view class="text-hex-ff4d4f font-600">
        <text class="text-28rpx">拼课价 ¥</text>
        <text class="text-48rpx">{{ coursePrice }}</text>
      </view>
      <view
        v-if="activity.rules.leaderDiscount"
        class="mb-8rpx rounded-full bg-[rgba(250,140,22,0.1)] px-12rpx py-4rpx text-24rpx text-hex-fa8c16"
      >
        团长再减 ¥{{ activity.rules.leaderDiscount }}
      </view>
    </view>

    <button
      v-if="canStartTeam"
      class="h-88rpx w-full flex items-center justify-center gap-12rpx rounded-44rpx border-none from-hex-ff7875 to-hex-ff4d4f bg-gradient-to-r text-30rpx text-white font-500 leading-88rpx shadow-[0_8rpx_20rpx_rgba(255,77,79,0.2)]"
      @click="handleCreateTeam"
    >
      <view class="i-carbon-user-multiple text-36rpx" />
      <text>¥{{ leaderPrice }} 一键开团</text>
    </button>
    <view v-else class="h-88rpx w-full rounded-44rpx bg-hex-f5f5f5 text-center text-26rpx text-hex-999 leading-88rpx">
      仅限推广员发起拼课
    </view>

    <view
      v-if="activity.displayData?.lessonSummary"
      class="mt-20rpx flex rounded-12rpx bg-hex-f9f9f9 p-20rpx text-24rpx text-hex-666 leading-1.5"
    >
      <view class="mb-8rpx font-600">课程安排：</view>
      <view class="text-justify">
        {{ activity.displayData.lessonSummary }}
      </view>
    </view>
  </view>
</template>
