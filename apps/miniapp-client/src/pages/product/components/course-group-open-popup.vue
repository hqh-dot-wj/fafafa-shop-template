<script lang="ts" setup>
import { reactive, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    storeName?: string;
    submitting?: boolean;
  }>(),
  {
    storeName: '',
    submitting: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [payload: { classAddress: string; classStartTime: string; classEndTime: string }];
}>();

// 开团弹窗只收集履约地址和时间，商品、SKU、门店、活动上下文由父页面组合后提交给后端开团接口。
const form = reactive({
  classAddress: '',
  classStartTime: '',
  classEndTime: '',
});

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return;
    if (!form.classAddress) {
      form.classAddress = '';
      form.classStartTime = '';
      form.classEndTime = '';
    }
  },
);

function close() {
  emit('update:modelValue', false);
}

function validate(): boolean {
  // 前端校验仅保证输入可读；真实门店可用性、时间冲突和开团资格由后端 lifecycle 服务确认。
  if (!form.classAddress.trim()) {
    uni.showToast({ title: '请填写上课地址', icon: 'none' });
    return false;
  }
  if (!form.classStartTime.trim() || !form.classEndTime.trim()) {
    uni.showToast({ title: '请填写开课时间', icon: 'none' });
    return false;
  }

  const start = Date.parse(form.classStartTime);
  const end = Date.parse(form.classEndTime);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    uni.showToast({ title: '时间格式不正确', icon: 'none' });
    return false;
  }
  if (start >= end) {
    uni.showToast({ title: '开始时间必须早于结束时间', icon: 'none' });
    return false;
  }
  return true;
}

function onConfirm() {
  if (!validate()) return;
  emit('confirm', {
    classAddress: form.classAddress.trim(),
    classStartTime: form.classStartTime.trim(),
    classEndTime: form.classEndTime.trim(),
  });
}
</script>

<template>
  <wd-popup
    :model-value="modelValue"
    position="bottom"
    :safe-area-inset-bottom="true"
    :close-on-click-modal="false"
    custom-style="border-radius: 24rpx 24rpx 0 0; overflow: hidden;"
    @close="close"
  >
    <view class="open-popup">
      <view class="open-popup__header">
        <text class="open-popup__title">我要开团</text>
        <text class="open-popup__close" @click="close">关闭</text>
      </view>

      <view class="open-popup__form">
        <view class="open-popup__item">
          <text class="open-popup__label">当前门店</text>
          <text class="open-popup__readonly">{{ storeName || '当前定位门店' }}</text>
        </view>
        <view class="open-popup__item">
          <text class="open-popup__label">上课地址</text>
          <input v-model="form.classAddress" class="open-popup__input" placeholder="请输入详细地址" />
        </view>
        <view class="open-popup__item">
          <text class="open-popup__label">开始时间</text>
          <input v-model="form.classStartTime" class="open-popup__input" placeholder="格式：2026-04-16 10:00" />
        </view>
        <view class="open-popup__item">
          <text class="open-popup__label">结束时间</text>
          <input v-model="form.classEndTime" class="open-popup__input" placeholder="格式：2026-04-16 12:00" />
        </view>
      </view>

      <view class="open-popup__footer">
        <button class="open-popup__btn" :disabled="submitting" @click="onConfirm">
          {{ submitting ? '提交中...' : '确认开团' }}
        </button>
      </view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.open-popup {
  background: #fff;
}

.open-popup__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 26rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.open-popup__title {
  font-size: 32rpx;
  color: #222;
  font-weight: 600;
}

.open-popup__close {
  font-size: 24rpx;
  color: #666;
}

.open-popup__form {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.open-popup__item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.open-popup__label {
  font-size: 24rpx;
  color: #666;
}

.open-popup__readonly {
  font-size: 28rpx;
  color: #222;
  font-weight: 500;
}

.open-popup__input {
  height: 78rpx;
  line-height: 78rpx;
  border-radius: 12rpx;
  background: #f7f7f7;
  padding: 0 20rpx;
  font-size: 26rpx;
  color: #333;
}

.open-popup__footer {
  padding: 0 24rpx calc(18rpx + env(safe-area-inset-bottom));
}

.open-popup__btn {
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  border: none;
  border-radius: 999rpx;
  color: #fff;
  font-size: 28rpx;
  background: linear-gradient(90deg, #ff7a45, #ff4d4f);
}

.open-popup__btn::after {
  border: none;
}
</style>
