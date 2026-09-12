<script setup lang="ts">
import {
  PUBLIC_ADOPTIONS_PAGE_SIZE,
  publicAdoptionListResponseSchema,
} from '~~/shared/schemas/public-content'
const { t } = usePublicI18n()

usePublicSeo('adoptions')

const route = useRoute()
const requestedPage = computed(() => publicPageFromQuery(route.query.page))
const search = computed(() => publicSearchFromQuery(route.query.q))

const listQuery = computed(() => ({
  page: requestedPage.value,
  q: route.query.q,
}))

const { data: list, error: listError } = await useFetch('/api/public/v1/adoptions', {
  key: 'public-adoptions-list',
  headers: useRequestHeaders(['host']),
  query: listQuery,
  transform: raw => publicAdoptionListResponseSchema.parse(raw).data,
})

if (listError.value) {
  throw createError({ statusCode: 500, statusMessage: '设定领养暂时无法显示' })
}

const items = computed(() => list.value?.items ?? [])
const resultCount = computed(() => list.value?.resultCount ?? 0)
const page = computed(() => list.value?.page ?? requestedPage.value)
const pageSize = computed(() => list.value?.pageSize ?? PUBLIC_ADOPTIONS_PAGE_SIZE)
const pageCount = computed(() => list.value?.pageCount ?? 0)
const filter = computed(
  () => list.value?.filter ?? { valid: true },
)

const clearSearchHref = '/adoptions'

/** 空态只表达真实数据，不编造“即将更新”。 */
const emptyText = computed(() => {
  if (!search.value.valid) {
    return { description: '', title: t('ui.invalidSearch') }
  }
  if (search.value.active) {
    return { description: '', title: t('ui.noMatch') }
  }
  if (!filter.value.valid) {
    return { description: '', title: t('ui.invalidSearch') }
  }
  return { description: '', title: t('ui.noAdoptions') }
})

const isOutOfRange = computed(() => (
  items.value.length === 0
  && resultCount.value > 0
  && page.value > pageCount.value
))

function hrefFor(target: number) {
  return publicPageHref('/adoptions', {
    q: search.value.query || null,
  }, target)
}

usePublicCatalogSeo(list)
</script>

<template>
  <main class="adoptions-page" aria-labelledby="adoptions-page-title">
    <AdoptionArchiveHeader />

    <section class="adoptions-page__tools" :aria-label="t('ui.searchAdoptions')">
      <div class="adoptions-page__tools-panel">
        <div class="adoptions-page__tools-meta">
          <span>{{ t('ui.searchCharacters') }}</span>
          <span v-if="search.active">{{ t('count.results', { count: String(resultCount).padStart(2, '0') }) }}</span>
        </div>
        <div class="adoptions-page__filters-wrap">
          <PublicCatalogSearch
            action="/adoptions"
            :clear-to="clearSearchHref"
            :query="search.query"
            :show-clear="search.active"
          />
          <PublicAction
            variant="primary"
            class="adoptions-page__contact-action"
            to="/about#contact"
            data-testid="adoption-contact-action"
          >{{ t('ui.adoptionContact') }}</PublicAction>
        </div>
      </div>
    </section>

    <div v-if="items.length > 0" class="adoptions-page__content">
      <ol class="adoptions-page__grid">
        <li v-for="(adoption, index) in items" :key="adoption.work.id">
          <AdoptionCard
            :adoption="adoption"
            :folio="(page - 1) * pageSize + index + 1"
          />
        </li>
      </ol>
      <PublicPagination
        :page="page"
        :page-count="pageCount"
        :href-for="hrefFor"
        :label="t('ui.adoptionsPagination')"
      />
    </div>

    <PublicEmptyState
      v-else-if="isOutOfRange"
      :title="t('ui.emptyAdoptionsPage')"
      :description="t('ui.firstPageHint')"
    >
      <PublicAction :to="hrefFor(1)" variant="secondary">{{ t('ui.firstPage') }}</PublicAction>
    </PublicEmptyState>

    <PublicEmptyState
      v-else
      :title="emptyText.title"
      :description="emptyText.description"
    >
      <PublicAction v-if="search.active" :to="clearSearchHref" variant="secondary">{{ t('ui.clearSearch') }}</PublicAction>
      <PublicAction v-else to="/works" variant="secondary">{{ t('ui.viewWorks') }}</PublicAction>
    </PublicEmptyState>
  </main>
</template>

<style scoped>
.adoptions-page {
  min-height: 60vh;
}

.adoptions-page__content {
  max-width: var(--public-content-wide);
  margin: 0 auto;
  padding: 0 var(--public-page-padding) var(--space-7);
}

.adoptions-page__tools {
  max-width: var(--public-content-wide);
  margin: 0 auto var(--space-3);
  padding: var(--space-2) var(--public-page-padding);
}

.adoptions-page__tools-panel {
  width: min(100%, 39rem);
  margin-left: auto;
}

.adoptions-page__tools-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
  color: var(--public-text-secondary);
  font-family: var(--font-role-metadata);
  font-size: var(--type-metadata-size);
  font-weight: var(--type-metadata-weight);
  line-height: var(--type-metadata-line-height);
}

.adoptions-page__filters-wrap {
  display: grid;
  grid-template-columns: minmax(18rem, 1fr) auto;
  align-items: start;
  gap: var(--space-3);
}

.adoptions-page__filters-wrap > :deep(.catalog-search) {
  width: 100%;
}

.adoptions-page__contact-action {
  flex: none;
}

.adoptions-page__grid {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.adoptions-page__grid > li {
  min-width: 0;
}

@media (min-width: 1024px) {
  .adoptions-page__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: clamp(2.5rem, 5vw, 5rem);
  }
}

@media (max-width: 767px) {
  .adoptions-page__tools {
    margin-bottom: var(--space-3);
  }

  .adoptions-page__filters-wrap {
    display: grid;
    gap: var(--space-2);
    grid-template-columns: 1fr;
  }

  .adoptions-page__filters-wrap > :deep(.catalog-search) {
    width: 100%;
  }

  .adoptions-page__contact-action {
    justify-self: start;
  }
}
</style>
