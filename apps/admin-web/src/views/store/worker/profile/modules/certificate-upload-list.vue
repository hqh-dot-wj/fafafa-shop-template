<script setup lang="ts">
defineOptions({
  name: 'CertificateUploadList',
});

const model = defineModel<Api.Store.WorkerCertificate[]>('value', { required: true });

function addCertificate() {
  model.value.push({ name: '', certNo: '', images: [] });
}

function removeCertificate(index: number) {
  model.value.splice(index, 1);
}
</script>

<template>
  <div class="flex-col gap-12px">
    <div v-for="(cert, index) in model" :key="index" class="border border-gray-200 rounded-6px p-12px">
      <div class="mb-8px flex items-center justify-between">
        <span class="text-14px font-medium">资质 {{ index + 1 }}</span>
        <NButton size="tiny" tertiary type="error" @click="removeCertificate(index)">删除</NButton>
      </div>
      <NGrid responsive="screen" item-responsive :x-gap="12" :y-gap="8">
        <NFormItemGi span="24 s:12" label="证书名称">
          <NInput v-model:value="cert.name" clearable placeholder="请输入证书名称" />
        </NFormItemGi>
        <NFormItemGi span="24 s:12" label="证书编号">
          <NInput v-model:value="cert.certNo" clearable placeholder="请输入证书编号" />
        </NFormItemGi>
        <NFormItemGi span="24" label="图片 URL">
          <NDynamicTags v-model:value="cert.images" :max="10" />
        </NFormItemGi>
      </NGrid>
    </div>
    <NButton dashed block @click="addCertificate">
      <template #icon>
        <icon-ic-round-plus class="text-icon" />
      </template>
      添加资质
    </NButton>
  </div>
</template>
