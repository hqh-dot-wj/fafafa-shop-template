<script setup lang="tsx">
import { computed } from 'vue';
import { NDescriptions, NDescriptionsItem, NImage, NSpace, NTag } from 'naive-ui';
import { ApplicationStatusTag } from './application-status-tag';
import { ApplicationSourceTag, WorkerSourceTag } from './worker-source-tag';
import { OnlineStatusTag, WorkerStatusTag } from './worker-status-tag';

defineOptions({
  name: 'WorkerDetailContent',
});

type DetailData = Api.Store.WorkerProfile | Api.Store.WorkerApplication;

const props = defineProps<{
  data: DetailData | null;
  mode: 'application' | 'profile';
}>();

const emptyText = '-';

const serviceAreaText = computed(() => formatAddress(props.data?.serviceArea));
const addressText = computed(() => formatAddress(props.data?.address));
const skillTags = computed(() => props.data?.skillTags ?? []);
const serviceCategories = computed(() => props.data?.serviceCategoryNames ?? []);
const certificates = computed(() => props.data?.certificates ?? []);
const profileData = computed(() => (props.mode === 'profile' ? (props.data as Api.Store.WorkerProfile | null) : null));

function isApplication(data: DetailData | null): data is Api.Store.WorkerApplication {
  return Boolean(data) && props.mode === 'application';
}

function formatAddress(address?: Api.Store.WorkerAddress) {
  if (!address) return emptyText;
  return (
    address.formattedAddress ||
    [address.provinceName, address.cityName, address.districtName, address.addressDetail].filter(Boolean).join('') ||
    emptyText
  );
}
</script>

<template>
  <NEmpty v-if="!data" description="暂无详情" />
  <div v-else class="flex-col gap-16px">
    <!-- 基础资料区展示人员身份、租户与联系方式。 -->
    <NDescriptions title="基础资料" bordered label-placement="left" :column="2">
      <NDescriptionsItem label="所属租户">{{ data.tenantName || data.tenantId }}</NDescriptionsItem>
      <NDescriptionsItem label="姓名">{{ data.name }}</NDescriptionsItem>
      <NDescriptionsItem label="昵称">{{ data.nickName || emptyText }}</NDescriptionsItem>
      <NDescriptionsItem label="手机号">{{ data.phone }}</NDescriptionsItem>
      <NDescriptionsItem label="头像">
        <NImage v-if="data.avatar" :src="data.avatar" :width="44" />
        <span v-else>{{ emptyText }}</span>
      </NDescriptionsItem>
      <NDescriptionsItem label="联系地址">{{ addressText }}</NDescriptionsItem>
    </NDescriptions>

    <!-- 工作资料区展示可派单能力，不展示申请审核状态。 -->
    <NDescriptions title="工作资料" bordered label-placement="left" :column="2">
      <NDescriptionsItem label="服务类目">
        <NSpace v-if="serviceCategories.length">
          <NTag v-for="item in serviceCategories" :key="item" type="info">{{ item }}</NTag>
        </NSpace>
        <span v-else>{{ emptyText }}</span>
      </NDescriptionsItem>
      <NDescriptionsItem label="技能标签">
        <NSpace v-if="skillTags.length">
          <NTag v-for="item in skillTags" :key="item">{{ item }}</NTag>
        </NSpace>
        <span v-else>{{ emptyText }}</span>
      </NDescriptionsItem>
      <NDescriptionsItem label="服务地区">{{ serviceAreaText }}</NDescriptionsItem>
      <NDescriptionsItem label="服务半径">{{
        data.serviceRadius ? `${data.serviceRadius} 米` : emptyText
      }}</NDescriptionsItem>
      <NDescriptionsItem label="接单状态"><WorkerStatusTag :status="data.status" /></NDescriptionsItem>
      <NDescriptionsItem label="在线状态"><OnlineStatusTag :is-online="data.isOnline" /></NDescriptionsItem>
    </NDescriptions>

    <!-- 工作经历区沉淀简介、年限、资质与后台备注。 -->
    <NDescriptions title="工作经历" bordered label-placement="left" :column="2">
      <NDescriptionsItem label="工作年限">{{ data.experienceYears ?? emptyText }}</NDescriptionsItem>
      <NDescriptionsItem label="个人简介">{{ data.intro || emptyText }}</NDescriptionsItem>
      <NDescriptionsItem label="证书/资质" :span="2">
        <NSpace v-if="certificates.length" vertical>
          <div v-for="cert in certificates" :key="cert.name" class="flex items-center gap-8px">
            <NTag type="success">{{ cert.name }}</NTag>
            <span class="text-13px text-gray-500">{{ cert.certNo || emptyText }}</span>
          </div>
        </NSpace>
        <span v-else>{{ emptyText }}</span>
      </NDescriptionsItem>
      <NDescriptionsItem label="备注" :span="2">{{ data.remark || emptyText }}</NDescriptionsItem>
    </NDescriptions>

    <!-- 来源和审核区根据外层页面语义展示不同字段。 -->
    <NDescriptions v-if="profileData" title="正式资料" bordered label-placement="left" :column="2">
      <NDescriptionsItem label="来源"><WorkerSourceTag :source="profileData.source" /></NDescriptionsItem>
      <NDescriptionsItem label="资料完整度">{{ profileData.completionScore }}%</NDescriptionsItem>
      <NDescriptionsItem label="入驻时间">{{ data.createTime }}</NDescriptionsItem>
      <NDescriptionsItem label="更新时间">{{ data.updateTime }}</NDescriptionsItem>
    </NDescriptions>

    <NDescriptions v-if="isApplication(data)" title="申请信息" bordered label-placement="left" :column="2">
      <NDescriptionsItem label="申请状态"><ApplicationStatusTag :status="data.applicationStatus" /></NDescriptionsItem>
      <NDescriptionsItem label="申请来源"><ApplicationSourceTag :source="data.applicationSource" /></NDescriptionsItem>
      <NDescriptionsItem label="提交时间">{{ data.createTime }}</NDescriptionsItem>
      <NDescriptionsItem label="审核人">{{ data.reviewBy || emptyText }}</NDescriptionsItem>
      <NDescriptionsItem label="审核时间">{{ data.reviewTime || emptyText }}</NDescriptionsItem>
      <NDescriptionsItem label="审核备注">{{ data.reviewRemark || emptyText }}</NDescriptionsItem>
    </NDescriptions>
  </div>
</template>
