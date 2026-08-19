<script setup lang="ts">
import { Menu } from '@lucide/vue'
</script>

<template>
  <div class="drawer lg:drawer-open">
    <input id="app-drawer" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex min-h-screen flex-col">
      <div class="px-4 pt-4 lg:hidden">
        <label
          for="app-drawer"
          class="btn btn-ghost btn-square drawer-button"
          aria-label="Open navigation"
        >
          <Menu />
        </label>
      </div>

      <!-- `drawer` sizes its content column as `auto`, so this track is the whole
           viewport minus the sidebar however wide that gets. `mx-auto` is what
           keeps the capped column in the middle of it: without it the content
           pins to the sidebar and every pixel past 80rem piles up as dead space
           on the right, which is what an ultra-wide screen shows. The cap then
           takes one step up at `2xl` so a 2560px display spends some of that
           width on the content instead of on margins. -->
      <main class="mx-auto w-full max-w-7xl grow p-4 sm:p-6 2xl:max-w-8xl 2xl:p-8">
        <slot />
      </main>
    </div>

    <!-- overflow-visible in BOTH states: the edge toggle overhangs the sidebar,
         and the collapsed rail's tooltips do too. -->
    <div class="drawer-side overflow-visible">
      <label for="app-drawer" aria-label="close sidebar" class="drawer-overlay"></label>
      <AppSidebar />
    </div>
  </div>
</template>
