<script lang="ts" setup>
import type { TeamMember } from '@/api/invite';
import { ref } from 'vue';
import { getInviteTeamMembers } from '@/api/invite';

defineOptions({ name: 'InviteTeamMemberList' });

const paging = ref<any>(null);
const dataList = ref<TeamMember[]>([]);

async function queryList(pageNo: number, pageSize: number) {
  try {
    const res = await getInviteTeamMembers({ pageNum: pageNo, pageSize });
    paging.value?.complete(res?.rows ?? []);
  } catch {
    paging.value?.complete(false);
  }
}

/** 等级展示文案（与 levelId 单一映射，不直接渲染后端 roleText） */
function resolveLevelLabel(levelId: number) {
  if (levelId >= 2) return '股东';
  if (levelId === 1) return '团长';
  return '会员';
}

function levelTagClass(levelId: number) {
  if (levelId >= 2) return 'team-member__tag--vip';
  if (levelId === 1) return 'team-member__tag--captain';
  return 'team-member__tag--normal';
}

defineExpose({
  refresh() {
    paging.value?.reload();
  },
});
</script>

<template>
  <view class="team-member">
    <z-paging ref="paging" v-model="dataList" :fixed="false" @query="queryList">
      <view v-for="item in dataList" :key="item.id" class="team-member__item">
        <image
          class="team-member__avatar"
          :src="item.avatar || '/static/images/default-avatar.png'"
          mode="aspectFill"
        />
        <view class="team-member__info">
          <view class="team-member__name-row">
            <text class="team-member__name">{{ item.nickname || '匿名用户' }}</text>
            <text class="team-member__tag" :class="levelTagClass(item.levelId)">
              {{ resolveLevelLabel(item.levelId) }}
            </text>
          </view>
          <view class="team-member__meta-row">
            <wd-icon name="time" size="24rpx" color="var(--color-text-tertiary)" />
            <text class="team-member__time">加入时间：{{ item.joinTime || '-' }}</text>
          </view>
        </view>
      </view>

      <template #empty>
        <view class="team-member__empty">
          <wd-icon name="friends" size="100rpx" color="var(--color-border-default)" />
          <text class="team-member__empty-text">暂无团队成员</text>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<style lang="scss" scoped>
.team-member__item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  margin: 0 var(--space-lg) var(--space-sm);
  background: var(--color-bg-surface);
  border-radius: var(--radius-card);
}

.team-member__avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  flex-shrink: 0;
  border: 2rpx solid var(--color-border-default);
}

.team-member__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.team-member__name-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.team-member__name {
  font-size: var(--font-body-large);
  font-weight: 600;
  color: var(--color-text-primary);
  max-width: 280rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.team-member__tag {
  font-size: var(--font-micro);
  padding: 4rpx var(--space-sm);
  border-radius: var(--radius-sm);
  line-height: var(--lh-normal);
  flex-shrink: 0;
}

.team-member__tag--normal {
  background: #f1f5f9;
  color: #64748b;
}

.team-member__tag--captain {
  background: #fffbeb;
  color: #d97706;
  border: 1rpx solid #fef3c7;
}

.team-member__tag--vip {
  background: #f5f3ff;
  color: #7c3aed;
  border: 1rpx solid #ede9fe;
}

.team-member__meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.team-member__time {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.team-member__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl) 0;
  gap: var(--space-sm);
}

.team-member__empty-text {
  font-size: var(--font-body-large);
  color: var(--color-text-secondary);
}
</style>
