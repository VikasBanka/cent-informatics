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

      <main class="w-full max-w-7xl grow p-4 sm:p-6">
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
