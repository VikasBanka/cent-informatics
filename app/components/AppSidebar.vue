<script setup lang="ts">
const navLinks = [
  {
    label: 'Dashboard',
    to: '/',
    icon: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z'
  },
  {
    label: 'Samples',
    to: '/samples',
    icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75'
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
  }
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
          <!-- panel-left: the left rail fills in when the sidebar is expanded -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-4"
          >
            <rect
              x="4.5"
              y="4.5"
              width="4"
              height="15"
              rx="0.5"
              stroke="none"
              class="fill-current opacity-0 transition-opacity is-drawer-open:opacity-100"
            />
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-linejoin="round" />
            <path stroke-linecap="round" d="M9 3v18" />
          </svg>
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="size-5 shrink-0"
          >
            <path stroke-linecap="round" stroke-linejoin="round" :d="link.icon" />
          </svg>
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="size-4 shrink-0 text-base-content/60 is-drawer-close:hidden"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
        </svg>
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
