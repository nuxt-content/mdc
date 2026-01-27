<template>
  <div
    v-if="icon || filename"
    class="prose-pre-container"
  >
    <div class="prose-pre-header">
      <span
        v-if="icon && iconPosition !== 'right'"
        class="prose-pre-icon"
      >{{ icon }}</span>
      <span
        v-if="filename"
        class="prose-pre-filename"
      >{{ filename }}</span>
      <span
        v-if="icon && iconPosition === 'right'"
        class="prose-pre-icon"
      >{{ icon }}</span>
    </div>
    <pre
      :class="$props.class"
    ><slot /></pre>
  </div>
  <pre
    v-else
    :class="$props.class"
  ><slot /></pre>
</template>

<script setup lang="ts">
defineProps({
  code: {
    type: String,
    default: '',
  },
  language: {
    type: String,
    default: null,
  },
  filename: {
    type: String,
    default: null,
  },
  highlights: {
    type: Array as () => number[],
    default: () => [],
  },
  meta: {
    type: String,
    default: null,
  },
  class: {
    type: String,
    default: null,
  },
  icon: {
    type: String,
    default: null,
  },
  iconPosition: {
    type: String as () => 'left' | 'right' | null,
    default: null,
  },
})
</script>

<style>
pre code .line {
  display: block;
}
</style>
