<script lang="ts" setup>
import type { AddressDto } from '@/api/address';
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { createAddress, getAddressDetail, updateAddress } from '@/api/address';
import { getRegionList } from '@/api/region';

definePage({
  style: {
    navigationBarTitleText: '编辑地址',
  },
});

// 是否编辑模式
const isEdit = ref(false);
const addressId = ref('');
const loading = ref(false);
const submitting = ref(false);

// 表单数据
const form = ref<AddressDto>({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
  isDefault: false,
  tag: '',
});

// 省市区选择器（展示文案由 wd-col-picker 的 displayFormat 负责，避免与组件自带 cell 重复一行）
const regionValue = ref<string[]>([]);

function regionDisplayFormat(selectedItems: { label?: string }[]) {
  return selectedItems
    .map((item) => item.label ?? '')
    .filter(Boolean)
    .join(' ');
}
const regionColumns = ref<any[]>([]);

// 初始化省份数据
async function initRegionData() {
  try {
    const list = await getRegionList();
    if (list && list.length > 0) {
      regionColumns.value = [
        list.map((item) => ({
          label: item.name,
          value: item.code,
        })),
      ];
    }
  } catch (error) {
    console.error('Fetch regions failed:', error);
  }
}

// 动态加载下级数据
async function onColumnChange({ selectedItem, resolve, finish, index }: any) {
  // 如果是最后一列（区县），就没有下级了
  if (index === 2) {
    finish();
    return;
  }

  try {
    const children = await getRegionList(selectedItem.value);
    if (children && children.length > 0) {
      resolve(
        children.map((item) => ({
          label: item.name,
          value: item.code,
        })),
      );
    } else {
      finish();
    }
  } catch (error) {
    console.error('Fetch children regions failed:', error);
    finish();
  }
}

// 标签列表
const tagList = ['家', '公司', '学校'];

// 页面加载
onLoad(async (options) => {
  if (options?.id) {
    isEdit.value = true;
    addressId.value = options.id;
    await loadAddressDetail(options.id);
  }
  // 初始化省市区数据
  initRegionData();
});

// 加载地址详情
async function loadAddressDetail(id: string) {
  loading.value = true;
  try {
    const result = await getAddressDetail(id);
    if (result) {
      const detailForm: AddressDto = {
        name: result.name,
        phone: result.phone,
        province: result.province,
        city: result.city,
        district: result.district,
        detail: result.detail,
        isDefault: result.isDefault,
        tag: result.tag || '',
      };
      if (result.latitude !== undefined) detailForm.latitude = result.latitude;
      if (result.longitude !== undefined) detailForm.longitude = result.longitude;
      form.value = detailForm;
      if (result.province && result.city && result.district) {
        regionValue.value = [result.province, result.city, result.district];
      }
    }
  } catch (err) {
    console.error('加载地址详情失败:', err);
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

// 省市区选择确认
function onRegionConfirm(e: { value: string[]; selectedItems: { label: string }[] }) {
  const [provinceItem, cityItem, districtItem] = e.selectedItems;
  if (!provinceItem || !cityItem || !districtItem) {
    uni.showToast({ title: '请选择完整省市区', icon: 'none' });
    return;
  }

  // 当前地址 DTO 只暴露省市区展示字段；保存 picker label，保持原有展示行为。
  form.value.province = provinceItem.label;
  form.value.city = cityItem.label;
  form.value.district = districtItem.label;
}

// 选择标签
function selectTag(tag: string) {
  form.value.tag = form.value.tag === tag ? '' : tag;
}

// 表单校验
function validateForm(): boolean {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入收货人姓名', icon: 'none' });
    return false;
  }
  if (!form.value.phone.trim()) {
    uni.showToast({ title: '请输入联系电话', icon: 'none' });
    return false;
  }
  if (!/^1[3-9]\d{9}$/.test(form.value.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' });
    return false;
  }
  if (!form.value.province || !form.value.city || !form.value.district) {
    uni.showToast({ title: '请选择省市区', icon: 'none' });
    return false;
  }
  if (!form.value.detail.trim()) {
    uni.showToast({ title: '请输入详细地址', icon: 'none' });
    return false;
  }
  return true;
}

// 保存地址
async function saveAddress() {
  if (!validateForm()) return;

  submitting.value = true;
  try {
    if (isEdit.value) {
      await updateAddress({
        ...form.value,
        id: addressId.value,
      });
    } else {
      await createAddress(form.value);
    }

    uni.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => {
      uni.navigateBack();
    }, 1500);
  } catch (err) {
    console.error('保存地址失败:', err);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <view class="edit-page">
    <!-- 加载中 -->
    <view v-if="loading" class="loading-state">
      <wd-loading />
    </view>

    <template v-else>
      <!-- 主表单：仅保留 wd-col-picker 自带一行，避免重复「选择地区」 -->
      <view class="form-card">
        <wd-input v-model="form.name" label="收货人" placeholder="请输入收货人姓名" size="large" clearable />
        <wd-input
          v-model="form.phone"
          label="手机号码"
          placeholder="请输入联系电话"
          type="number"
          size="large"
          :maxlength="11"
          clearable
        />
        <wd-col-picker
          v-model="regionValue"
          :columns="regionColumns"
          :column-change="onColumnChange"
          label="选择地区"
          size="large"
          placeholder="请选择省市区"
          title="选择地区"
          :display-format="regionDisplayFormat"
          @confirm="onRegionConfirm"
        />
        <wd-input v-model="form.detail" label="详细地址" placeholder="街道、楼牌号等" size="large" clearable />
      </view>

      <!-- 地址标签 + 默认地址同一卡片 -->
      <view class="form-card form-card--extra">
        <view class="tag-section">
          <text class="tag-label">地址标签</text>
          <view class="tag-list">
            <view
              v-for="tag in tagList"
              :key="tag"
              class="tag-item"
              :class="[{ active: form.tag === tag }]"
              hover-class="opacity-80"
              @click="selectTag(tag)"
            >
              {{ tag }}
            </view>
          </view>
        </view>
        <view class="default-address-cell">
          <view class="default-address-cell__left">
            <text class="default-address-cell__title">设置默认地址</text>
            <text class="default-address-cell__desc">下单时将优先使用该收货地址</text>
          </view>
          <wd-switch
            v-model="form.isDefault"
            active-color="var(--color-brand-primary)"
            inactive-color="var(--color-border-default)"
          />
        </view>
      </view>

      <!-- 保存按钮 -->
      <view class="save-btn-wrap">
        <wd-button type="primary" block :loading="submitting" :disabled="submitting" @click="saveAddress">
          保存
        </wd-button>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.edit-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: var(--space-md) var(--space-lg) 140rpx;
  background-color: var(--color-bg-body);
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60vh;
}

.form-card {
  background-color: var(--color-bg-surface);
  border-radius: var(--radius-card);
  margin-bottom: var(--space-md);
  overflow: hidden;
}

.form-card--extra .default-address-cell {
  border-top: 1rpx solid var(--color-border-default);
}

.default-address-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
}

.default-address-cell__left {
  flex: 1;
  min-width: 0;
}

.default-address-cell__title {
  display: block;
  font-size: var(--font-title-medium);
  line-height: var(--lh-normal);
  color: var(--color-text-primary);
}

.default-address-cell__desc {
  display: block;
  margin-top: var(--space-xs);
  font-size: var(--font-body-large);
  line-height: var(--lh-relaxed);
  color: var(--color-text-secondary);
}

.tag-section {
  padding: var(--space-sm) var(--space-md);

  .tag-label {
    font-size: var(--font-title-medium);
    color: var(--color-text-primary);
    margin-bottom: var(--space-xs);
    display: block;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);

    .tag-item {
      padding: 8rpx 28rpx;
      font-size: var(--font-body-large);
      color: var(--color-text-secondary);
      background-color: var(--color-bg-body);
      border-radius: var(--radius-sm);
      border: 2rpx solid transparent;

      &.active {
        color: var(--color-brand-primary);
        background-color: var(--color-brand-light);
        border-color: var(--color-brand-primary);
      }
    }
  }
}

.save-btn-wrap {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-sm) var(--space-lg);
  padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom));
  background-color: var(--color-bg-surface);
  box-shadow: 0 -2rpx 20rpx rgba(0, 0, 0, 0.05);
}
</style>
