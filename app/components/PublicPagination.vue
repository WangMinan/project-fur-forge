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
  const entries: Array<{
    compactHidden: boolean
    key: string
    page: number | null
  }> = []
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1]
    if (previous !== undefined && page - previous > 1) {
      entries.push({ compactHidden: true, key: `gap-${page}`, page: null })
    }
    entries.push({
      compactHidden: (
        (page === 1 || page === props.pageCount)
        && Math.abs(page - props.page) > WINDOW
      ),
      key: `page-${page}`,
      page,
    })
  })
  return entries
})
</script>

<template>
  <nav
    v-if="pageCount > 0"
    class="pagination"
    :aria-label="label ?? '分页'"
  >
    <a
      v-if="page > 1"
      class="pagination__step"
      :href="hrefFor(page - 1)"
      rel="prev"
    >
      <span class="pagination__arrow" aria-hidden="true">‹</span>
      <span class="pagination__step-label">上一页</span>
    </a>
    <span
      v-else
      class="pagination__step pagination__step--disabled"
      aria-disabled="true"
    >
      <span class="pagination__arrow" aria-hidden="true">‹</span>
      <span class="pagination__step-label">上一页</span>
    </span>

    <ol class="pagination__list">
      <li
        v-for="entry in pages"
        :key="entry.key"
        class="pagination__entry"
        :class="{ 'pagination__entry--compact-hidden': entry.compactHidden }"
      >
        <span v-if="entry.page === null" class="pagination__gap">…</span>
        <a
          v-else-if="entry.page !== page"
          class="pagination__page"
          :href="hrefFor(entry.page)"
          :aria-label="`第 ${entry.page} 页`"
        >{{ entry.page }}</a>
        <span
          v-else
          class="pagination__page pagination__page--current"
          aria-current="page"
          :aria-label="`第 ${entry.page} 页，当前页`"
        >{{ entry.page }}</span>
      </li>
    </ol>

    <a
      v-if="page < pageCount"
      class="pagination__step"
      :href="hrefFor(page + 1)"
      rel="next"
    >
      <span class="pagination__step-label">下一页</span>
      <span class="pagination__arrow" aria-hidden="true">›</span>
    </a>
    <span
      v-else
      class="pagination__step pagination__step--disabled"
      aria-disabled="true"
    >
      <span class="pagination__step-label">下一页</span>
      <span class="pagination__arrow" aria-hidden="true">›</span>
    </span>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-8);
}

.pagination__list {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.pagination__page,
.pagination__step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  border: 1px solid var(--public-border-primary);
  background: var(--public-bg-primary);
  color: var(--public-text-secondary);
  font-size: var(--font-size-sm);
  transition:
    color var(--motion-duration-feedback) var(--motion-ease-standard),
    background-color var(--motion-duration-feedback) var(--motion-ease-standard),
    border-color var(--motion-duration-feedback) var(--motion-ease-standard);
}

.pagination__page {
  width: 3rem;
  padding: 0;
  border-radius: var(--radius-full);
}

.pagination__step {
  gap: var(--space-2);
  min-width: 6.75rem;
  padding: 0 var(--space-4);
  border-radius: var(--radius-full);
}

.pagination__page:hover,
.pagination__step:hover {
  border-color: var(--public-accent-tint);
  background: var(--public-bg-secondary);
  color: var(--public-text-primary);
}

.pagination__page:focus-visible,
.pagination__step:focus-visible {
  outline: 3px solid var(--public-focus-ring);
  outline-offset: 2px;
}

.pagination__page--current {
  border-color: var(--public-accent-primary);
  background: var(--public-accent-primary);
  color: var(--public-text-inverse);
  font-weight: 600;
}

.pagination__page--current:hover {
  background: var(--public-accent-primary);
  color: var(--public-text-inverse);
}

.pagination__step--disabled {
  border-color: var(--public-border-secondary);
  background: var(--public-bg-secondary);
  color: var(--public-text-tertiary);
  opacity: 0.58;
}

.pagination__step--disabled:hover {
  background: var(--public-bg-secondary);
  color: var(--public-text-tertiary);
}

.pagination__gap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  color: var(--public-text-tertiary);
}

.pagination__arrow {
  font-size: var(--font-size-lg);
  line-height: 1;
}

@media (max-width: 479px) {
  .pagination {
    gap: var(--space-2);
  }

  .pagination__list {
    gap: var(--space-1);
  }

  .pagination__entry--compact-hidden {
    display: none;
  }

  .pagination__page,
  .pagination__step {
    width: 2.75rem;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0;
  }

  .pagination__step-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}
</style>
