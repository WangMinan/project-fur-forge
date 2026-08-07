<script setup lang="ts">
/**
 * 公开端底部编号分页。
 *
 * 全部使用普通链接：SSR 直出、无 JavaScript 时可用、键盘可达。
 * 不使用自动无限滚动，也不以「加载更多」为默认交互。
 */
const props = defineProps<{
  page: number
  pageCount: number
  /** 生成某一页的地址；由页面决定查询参数形态。 */
  hrefFor: (page: number) => string
  label?: string
}>()

/** 首末页常驻，当前页左右各一页，其余用省略号，避免页码过多。 */
const WINDOW = 1

const pages = computed(() => {
  const numbers = new Set<number>([1, props.pageCount])
  for (
    let page = props.page - WINDOW;
    page <= props.page + WINDOW;
    page += 1
  ) {
    if (page >= 1 && page <= props.pageCount) {
      numbers.add(page)
    }
  }
  const sorted = [...numbers].sort((left, right) => left - right)
  const entries: Array<{ key: string, page: number | null }> = []
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1]
    if (previous !== undefined && page - previous > 1) {
      entries.push({ key: `gap-${page}`, page: null })
    }
    entries.push({ key: `page-${page}`, page })
  })
  return entries
})
</script>

<template>
  <nav
    v-if="pageCount > 1"
    class="pagination"
    :aria-label="label ?? '分页'"
  >
    <NuxtLink
      v-if="page > 1"
      class="pagination__step"
      :to="hrefFor(page - 1)"
      rel="prev"
    >上一页</NuxtLink>
    <span v-else class="pagination__step pagination__step--disabled" aria-hidden="true">上一页</span>

    <ol class="pagination__list">
      <li v-for="entry in pages" :key="entry.key">
        <span v-if="entry.page === null" class="pagination__gap">…</span>
        <NuxtLink
          v-else-if="entry.page !== page"
          class="pagination__page"
          :to="hrefFor(entry.page)"
          :aria-label="`第 ${entry.page} 页`"
        >{{ entry.page }}</NuxtLink>
        <span
          v-else
          class="pagination__page pagination__page--current"
          aria-current="page"
          :aria-label="`第 ${entry.page} 页，当前页`"
        >{{ entry.page }}</span>
      </li>
    </ol>

    <NuxtLink
      v-if="page < pageCount"
      class="pagination__step"
      :to="hrefFor(page + 1)"
      rel="next"
    >下一页</NuxtLink>
    <span v-else class="pagination__step pagination__step--disabled" aria-hidden="true">下一页</span>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  margin-top: var(--space-8);
}

.pagination__list {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.pagination__page,
.pagination__step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
}

.pagination__page:hover,
.pagination__step:hover {
  background: var(--public-bg-secondary);
  color: var(--public-text-primary);
}

.pagination__page--current {
  background: var(--public-bg-secondary);
  color: var(--public-text-primary);
  font-weight: 600;
}

.pagination__page--current:hover {
  background: var(--public-bg-secondary);
}

.pagination__step--disabled {
  color: var(--public-text-tertiary);
}

.pagination__step--disabled:hover {
  background: none;
  color: var(--public-text-tertiary);
}

.pagination__gap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  color: var(--public-text-tertiary);
}
</style>
