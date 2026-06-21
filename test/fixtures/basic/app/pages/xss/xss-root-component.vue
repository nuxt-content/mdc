<template>
  <div>
    <p id="dangerous-iframe">
      <MDCRenderer
        :body="dangerousBody1"
        :data="dangerousData1"
      />
    </p>
    <p id="dangerous-script">
      <MDCRenderer
        :body="dangerousBody2"
        :data="dangerousData2"
      />
    </p>
    <p id="dangerous-srcdoc">
      <MDCRenderer
        :body="dangerousBody3"
        :data="dangerousData3"
      />
    </p>
    <p id="safe-component">
      <MDCRenderer
        :body="safeBody"
        :data="safeData"
      />
    </p>
  </div>
</template>

<script setup lang="ts">
const safeBody = { type: 'root', children: [{ type: 'element', tag: 'p', props: {}, children: [{ type: 'text', value: 'Hello' }] }] }
const safeData = { title: 'Safe' }

const payload = '<' + 'script>window.__mdcXssPoc="executed"<' + '/script>'

const dangerousBody1 = { type: 'root', children: [{ type: 'element', tag: 'p', props: {}, children: [{ type: 'text', value: 'iframe test' }] }] }
const dangerousData1 = { component: { name: 'iframe', props: { srcdoc: payload } } }

const dangerousBody2 = { type: 'root', children: [{ type: 'element', tag: 'p', props: {}, children: [{ type: 'text', value: 'script test' }] }] }
const dangerousData2 = { component: { name: 'script', props: { src: 'http://evil.com/xss.js' } } }

const dangerousBody3 = { type: 'root', children: [{ type: 'element', tag: 'p', props: {}, children: [{ type: 'text', value: 'srcdoc test' }] }] }
const dangerousData3 = { component: { name: 'div', props: { srcdoc: '<' + 'script>alert(1)<' + '/script>' } } }
</script>
