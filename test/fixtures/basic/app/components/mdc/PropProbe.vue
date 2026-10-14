<template>
  <p id="probe">
    items:{{ Array.isArray(items) ? 'array' : typeof items }}
    data:{{ Array.isArray(data) ? 'array' : typeof data }}
    json:{{ JSON.stringify({ items, data }) }}
  </p>
</template>

<script setup lang="ts">
defineProps<{ items?: unknown, data?: unknown }>()
</script>
