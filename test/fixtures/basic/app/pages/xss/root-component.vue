<template>
  <div id="root-component">
    <MDC
      v-slot="{ body, data }"
      :value="md"
    >
      <MDCRenderer
        :body="body"
        :data="data"
      />
    </MDC>
  </div>
</template>

<script setup lang="ts">
const md = String(useRoute().query.md || '')
</script>
