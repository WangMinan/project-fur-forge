<script setup lang="ts">
import {
  PUBLICATION_STATUS_VALUES,
  WORK_PURPOSE_VALUES,
} from '~~/shared/schemas/work'
import type {
  PublicationStatus,
  WorkPurpose,
} from '~~/shared/types/contracts'
import {
  PUBLICATION_STATUS_LABELS,
  WORK_PURPOSE_LABELS,
} from '~/utils/work-labels'

defineProps<{
  filtersActive: boolean
  resultCount: number
  totalCount: number
}>()

const emit = defineEmits<{
  reset: []
}>()

const query = defineModel<string>('query', { required: true })
const searchField = useTemplateRef<{ focus: () => void }>('searchField')
const purpose = defineModel<WorkPurpose | 'all'>('purpose', { required: true })
const publicationStatus = defineModel<PublicationStatus | 'all'>('publicationStatus', {
  required: true,
})
</script>

<template>
  <AdminListToolbar
    label="查找和筛选作品"
    :filters-active="filtersActive"
    :result-count="resultCount"
    :total-count="totalCount"
    @reset="emit('reset'); searchField?.focus()"
  >
    <AdminListSearch id="admin-work-search" ref="searchField" v-model="query" label="查找作品" placeholder="角色名或物种" />

    <div class="admin-list-toolbar__field">
      <label class="admin-list-toolbar__label" for="admin-work-purpose">用途</label>
      <AdminSelect id="admin-work-purpose" v-model="purpose" :options="[{ value: 'all', label: '全部用途' }, ...WORK_PURPOSE_VALUES.map(value => ({ value, label: WORK_PURPOSE_LABELS[value] }))]" />
    </div>

    <div class="admin-list-toolbar__field">
      <label class="admin-list-toolbar__label" for="admin-work-publication">发布状态</label>
      <AdminSelect id="admin-work-publication" v-model="publicationStatus" :options="[{ value: 'all', label: '全部状态' }, ...PUBLICATION_STATUS_VALUES.map(value => ({ value, label: PUBLICATION_STATUS_LABELS[value] }))]" />
    </div>

  </AdminListToolbar>
</template>
