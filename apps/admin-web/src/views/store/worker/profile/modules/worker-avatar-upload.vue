<script setup lang="ts">
defineOptions({
  name: 'WorkerAvatarUpload',
});

const model = defineModel<string | undefined>('value', { required: true });
</script>

<template>
  <NInput v-model:value="model" clearable placeholder="请输入头像 URL" />
</template>
