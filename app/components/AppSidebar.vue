<script setup lang="ts">
import { Building2, ChevronUp, FileText, LayoutDashboard, PanelLeft, TestTubes, ChartColumn } from '@lucide/vue'

const navLinks = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Analysis', to: '/analysis', icon: ChartColumn },
  { label: 'Organizations', to: '/organizations', icon: Building2 },
  { label: 'Reports', to: '/reports', icon: FileText }
]

// Placeholder account until auth is wired up.
const user = {
  name: 'Demo User',
  role: 'Lab analyst',
  initials: 'DU'
}
</script>

<template>
  <div
    class="relative flex min-h-full flex-col bg-base-200 transition-[width] duration-200 is-drawer-close:w-16 is-drawer-open:w-64"
  >
    <!-- Straddles the sidebar's right border. Outer div owns the responsive
         display so it can't fight the tooltip's own display rule. -->
    <div class="absolute -right-4 top-6 z-10 hidden lg:block">
      <div class="tooltip tooltip-right" data-tip="Toggle sidebar">
        <label
          for="app-drawer"
          class="btn btn-circle btn-sm drawer-button border-base-300 bg-base-100 shadow-sm"
          aria-label="Toggle sidebar"
        >
          <PanelLeft :size="16" />
        </label>
      </div>
    </div>

    <div class="is-drawer-close:tooltip is-drawer-close:tooltip-right m-2" data-tip="CENT">
      <NuxtLink
        to="/"
        class="btn btn-ghost h-auto w-full justify-start gap-2 p-2 text-base is-drawer-close:justify-center"
      >
        <img src="/favicon.ico" alt="" class="size-7 shrink-0 rounded-selector" />
        <span class="font-semibold is-drawer-close:hidden">
          <span class="text-primary">CENT</span>
        </span>
      </NuxtLink>
    </div>

    <ul class="menu w-full grow gap-1 px-2">
      <li v-for="link in navLinks" :key="link.to">
        <NuxtLink
          :to="link.to"
          exact-active-class="menu-active"
          class="is-drawer-close:tooltip is-drawer-close:tooltip-right is-drawer-close:justify-center"
          :data-tip="link.label"
        >
          <component :is="link.icon" class="shrink-0" />
          <span class="is-drawer-close:hidden">{{ link.label }}</span>
        </NuxtLink>
      </li>
    </ul>

    <div class="p-2">
      <button
        class="btn btn-ghost h-auto w-full justify-start gap-2 px-2 py-2 is-drawer-close:tooltip is-drawer-close:tooltip-right is-drawer-close:justify-center is-drawer-close:px-0"
        popovertarget="user-menu"
        style="anchor-name:--user-menu"
        :data-tip="user.name"
        aria-label="Open account menu"
      >
        <div class="avatar avatar-placeholder shrink-0">
          <div class="size-8 rounded-full bg-neutral text-neutral-content">
            <span class="text-xs">{{ user.initials }}</span>
          </div>
        </div>
        <span class="grow text-left leading-tight is-drawer-close:hidden">
          <span class="block text-sm font-medium">{{ user.name }}</span>
          <span class="block text-xs font-normal text-base-content/60">{{ user.role }}</span>
        </span>
        <ChevronUp :size="16" class="shrink-0 text-base-content/60 is-drawer-close:hidden" />
      </button>
      <ul
        id="user-menu"
        popover
        class="dropdown dropdown-top menu w-52 rounded-box bg-base-100 shadow-sm"
        style="position-anchor:--user-menu"
      >
        <li class="menu-title">{{ user.name }}</li>
        <li><a>Profile</a></li>
        <li><a>Settings</a></li>
        <li><a>Sign out</a></li>
      </ul>
    </div>
  </div>
</template>
