<script lang="ts" setup>
/**
 * 拼课推荐团卡片 — 拼多多式头像墙 + 团实时数据。
 *
 * 展示：团长标题 + 成员头像墙（已加入=真实头像，空位=虚线圈）
 *       + 成班进度/上课时间/地点 + 操作按钮
 */
import type { RecommendedTeamProps } from './marketing-detail.types';

const props = withDefaults(defineProps<RecommendedTeamProps>(), {
  headerTitle: '已为您优先选择这个团',
  reasonText: '',
  storeName: '',
  leaderName: '',
  minCount: 0,
  maxCount: 0,
  currentMembers: 0,
  remainingSlots: 0,
  canOpen: false,
  opening: false,
  joinable: true,
  teamStatus: 'RECRUITING',
});

const emit = defineEmits<{
  changeTeam: [];
  openGroup: [];
  joinTeam: [teamId: string];
}>();

const teamTitle = computed(() => {
  if (props.leaderName) return `${props.leaderName}的团`;
  return '推荐团';
});

const effectiveMembers = computed(() => Math.max(0, props.currentMembers));
const remainToForm = computed(() => Math.max(props.minCount - effectiveMembers.value, 0));
const capRemaining = computed(() => Math.max(props.maxCount - effectiveMembers.value, 0));

/** 与 course-group/team-member-progress 一致：成班人数 vs 满员空位分离 */
const progressText = computed(() => {
  if (props.minCount <= 0) return '';
  const ratio = `${effectiveMembers.value}/${props.minCount}人`;
  const status = String(props.teamStatus || 'RECRUITING').toUpperCase();
  if (status === 'FORMED' || status === 'IN_CLASS' || status === 'FINISHED') {
    return capRemaining.value > 0 ? `${ratio}，已成团，剩余${capRemaining.value}个名额` : `${ratio}，已成团`;
  }
  if (remainToForm.value > 0) {
    return `${ratio}，还差${remainToForm.value}人即可成团`;
  }
  if (capRemaining.value > 0) {
    return `${ratio}，剩余${capRemaining.value}个名额`;
  }
  return ratio;
});

const avatarHintText = computed(() => {
  const status = String(props.teamStatus || 'RECRUITING').toUpperCase();
  if (status === 'FORMED' || status === 'IN_CLASS') {
    return capRemaining.value > 0 ? `剩余${capRemaining.value}个名额` : '';
  }
  if (remainToForm.value > 0) return `还差${remainToForm.value}人即可成团`;
  return '';
});

const avatarSlots = computed(() => {
  const members = props.memberAvatars ?? [];
  const totalSlots = Math.max(props.minCount, members.length);
  const slots: Array<{ type: 'member' | 'empty'; avatar?: string; isLeader: boolean }> = [];

  for (let i = 0; i < totalSlots; i++) {
    if (i < members.length) {
      const m = members[i]!;
      slots.push({ type: 'member', avatar: m.avatar, isLeader: m.role === 'LEADER' });
    } else {
      slots.push({ type: 'empty', isLeader: false });
    }
  }
  return slots;
});

function handleJoin() {
  if (props.teamId) {
    emit('joinTeam', props.teamId);
  }
}
</script>

<template>
  <view class="rec-team">
    <!-- 顶部：标题 + 门店 pill -->
    <view class="rec-team__header">
      <view class="rec-team__header-left">
        <text class="rec-team__title">{{ headerTitle }}</text>
        <text v-if="reasonText" class="rec-team__reason">{{ reasonText }}</text>
      </view>
      <view v-if="storeName" class="rec-team__store-pill">
        <view class="i-carbon-location rec-team__store-icon" />
        <text>{{ storeName }}</text>
      </view>
    </view>

    <!-- 团信息面板 -->
    <view class="rec-team__info-panel">
      <!-- 团标题 -->
      <text class="rec-team__team-title">{{ teamTitle }}</text>

      <!-- 头像墙（拼多多式） -->
      <view v-if="avatarSlots.length > 0" class="rec-team__avatars">
        <view
          v-for="(slot, index) in avatarSlots"
          :key="index"
          class="rec-team__avatar-slot"
          :class="{ 'rec-team__avatar-slot--empty': slot.type === 'empty' }"
        >
          <image
            v-if="slot.type === 'member' && slot.avatar"
            class="rec-team__avatar-img"
            :src="slot.avatar"
            mode="aspectFill"
          />
          <view v-else-if="slot.type === 'member'" class="rec-team__avatar-default">
            <view class="i-carbon-user rec-team__avatar-default-icon" />
          </view>
          <view v-else class="rec-team__avatar-empty">
            <text class="rec-team__avatar-question">?</text>
          </view>
          <!-- 团长标识：横向胶囊，贴头像底部居中 -->
          <text v-if="slot.isLeader" class="rec-team__avatar-leader-badge">团长</text>
        </view>
        <text v-if="avatarHintText" class="rec-team__remaining-hint">
          {{ avatarHintText }}
        </text>
      </view>

      <!-- 团详细信息网格 -->
      <view class="rec-team__grid">
        <view class="rec-team__grid-cell">
          <text class="rec-team__cell-label">成班进度</text>
          <text class="rec-team__cell-value">{{ progressText || `${minCount}人成班` }}</text>
        </view>
        <view class="rec-team__grid-cell">
          <text class="rec-team__cell-label">上课时间</text>
          <text class="rec-team__cell-value">{{ scheduleText }}</text>
        </view>
      </view>

      <view class="rec-team__address-row">
        <text class="rec-team__cell-label">上课地点</text>
        <text class="rec-team__cell-value">{{ addressText }}</text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="rec-team__actions">
      <button class="rec-team__btn rec-team__btn--secondary" @click="emit('changeTeam')">换个团</button>
      <button v-if="teamId && joinable" class="rec-team__btn rec-team__btn--primary" @click="handleJoin">
        加入{{ leaderName ? `${leaderName}的团` : '这个团' }}
      </button>
      <button
        v-else
        class="rec-team__btn rec-team__btn--outline"
        :disabled="!canOpen || opening"
        @click="emit('openGroup')"
      >
        {{ opening ? '提交中...' : '自己开团' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.rec-team {
  margin: var(--space-sm) var(--space-sm) 0;
  padding: var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
}

.rec-team__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}

.rec-team__header-left {
  flex: 1;
  min-width: 0;
}

.rec-team__title {
  display: block;
  font-size: var(--font-title-medium);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: var(--lh-snug);
}

.rec-team__reason {
  display: block;
  margin-top: var(--space-xs);
  font-size: var(--font-body-large);
  font-weight: 600;
  color: var(--color-func-warning);
  line-height: var(--lh-relaxed);
}

.rec-team__store-pill {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-brand-light);
  color: var(--color-brand-primary);
  font-size: var(--font-caption);
  font-weight: 700;
}

.rec-team__store-icon {
  font-size: var(--font-caption);
}

.rec-team__info-panel {
  margin-top: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-card);
  background: var(--color-bg-body);
}

.rec-team__team-title {
  display: block;
  font-size: var(--font-body-large);
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-sm);
}

// ==================== 头像墙 ====================
.rec-team__avatars {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-md);
  border-bottom: 2rpx solid var(--color-border-default);
}

.rec-team__avatar-slot {
  position: relative;
  flex-shrink: 0;
  width: 72rpx;
  padding-bottom: 14rpx;
  border-radius: 50%;
  overflow: visible;
}

.rec-team__avatar-img {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  border: 2rpx solid var(--color-bg-surface);
}

.rec-team__avatar-default {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: var(--color-brand-light);
  display: flex;
  align-items: center;
  justify-content: center;
}

.rec-team__avatar-default-icon {
  font-size: var(--font-title-medium);
  color: var(--color-brand-primary);
}

.rec-team__avatar-slot--empty .rec-team__avatar-empty {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  border: 3rpx dashed var(--color-border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-surface);
}

.rec-team__avatar-question {
  font-size: var(--font-body-large);
  font-weight: 700;
  color: var(--color-text-tertiary);
}

.rec-team__avatar-leader-badge {
  position: absolute;
  bottom: 0;
  left: 50%;
  z-index: 1;
  display: inline-block;
  box-sizing: border-box;
  max-width: none;
  padding: 2rpx 10rpx;
  border-radius: var(--radius-pill);
  background: var(--color-brand-primary);
  color: var(--color-bg-surface);
  font-size: 18rpx;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  transform: translateX(-50%);
  writing-mode: horizontal-tb;
}

.rec-team__remaining-hint {
  font-size: var(--font-body-medium);
  font-weight: 600;
  color: var(--color-func-warning);
  margin-left: var(--space-xs);
}

// ==================== 团信息网格 ====================
.rec-team__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-sm);
}

.rec-team__grid-cell {
  padding: var(--space-sm);
  border-radius: var(--radius-card);
  background: var(--color-bg-surface);
}

.rec-team__address-row {
  margin-top: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-card);
  background: var(--color-bg-surface);
}

.rec-team__cell-label {
  display: block;
  font-size: var(--font-body-medium);
  font-weight: 600;
  color: var(--color-text-secondary);
  line-height: var(--lh-normal);
}

.rec-team__cell-value {
  display: block;
  margin-top: 4rpx;
  font-size: var(--font-body-large);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: var(--lh-normal);
}

// ==================== 操作按钮 ====================
.rec-team__actions {
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-md);
}

.rec-team__btn {
  margin: 0;
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: var(--radius-pill);
  border: none;
  font-size: var(--font-body-large);
  font-weight: 700;
  text-align: center;
}

.rec-team__btn::after {
  border: none;
}

.rec-team__btn--primary {
  background: var(--color-brand-primary);
  color: var(--color-bg-surface);

  &:active {
    opacity: 0.8;
  }
}

.rec-team__btn--secondary {
  background: var(--color-bg-body);
  color: var(--color-text-primary);

  &:active {
    opacity: 0.8;
  }
}

.rec-team__btn--outline {
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  border: 2rpx solid var(--color-border-default);

  &:active {
    opacity: 0.8;
  }

  &[disabled] {
    opacity: 0.4;
  }
}
</style>
