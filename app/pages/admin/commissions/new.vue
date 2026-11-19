<script setup lang="ts">
import type { CommissionSubmissionDetailDto } from '~~/shared/types/contracts'
definePageMeta({ layout: 'admin', ssr: false })
useSeoMeta({ title: '录入委托申请', robots: 'noindex, nofollow' })
async function saved(detail: CommissionSubmissionDetailDto, next: boolean) {
  if (!next) await navigateTo(`/admin/commissions/${detail.id}`)
}
</script>

<template>
  <AdminShell current="commissions">
    <AdminManualCommissionForm @saved="saved" />
  </AdminShell>
</template>
