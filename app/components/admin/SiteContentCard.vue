<script setup lang="ts">
import type { AdminSiteContentDto, SiteContentSection } from '~~/shared/types/contracts'
import type { SiteContentSectionPayloads } from '~/composables/useAdminSiteContent'

const props = defineProps<{
  content: AdminSiteContentDto
  isMutating: (section: SiteContentSection) => boolean
  savedSection: string | null
}>()
const emit = defineEmits<{
  save: [section: SiteContentSection, payload: SiteContentSectionPayloads[SiteContentSection]]
}>()
function save<S extends SiteContentSection>(section: S, payload: SiteContentSectionPayloads[S]) {
  emit('save', section, payload as SiteContentSectionPayloads[SiteContentSection])
}
</script>

<template>
  <div class="site-content-grid">
    <AdminSiteCommissionContentCard
      :content="content.commission"
      :mutating="isMutating('commission')"
      :saved="savedSection === 'commission'"
      @save="payload => save('commission', payload)"
    />
    <AdminSiteFaqContentCard
      :faqs="content.commission.faqs"
      :mutating="isMutating('faq')"
      :saved="savedSection === 'faq'"
      @save="payload => save('faq', payload)"
    />
    <AdminSiteAboutContentCard
      :about="content.about"
      :mutating="isMutating('about')"
      :saved="savedSection === 'about'"
      @save="payload => save('about', payload)"
    />
    <AdminSiteLegalTextCard
      section="terms"
      :value="content.about.basicTerms"
      :mutating="isMutating('terms')"
      :saved="savedSection === 'terms'"
      @save="(section, payload) => save(section, payload)"
    />
    <AdminSiteLegalTextCard
      section="privacy"
      :value="content.about.privacyPolicy"
      :mutating="isMutating('privacy')"
      :saved="savedSection === 'privacy'"
      @save="(section, payload) => save(section, payload)"
    />
    <AdminSiteContactContentCard
      :contact="content.contact"
      :mutating="isMutating('contact')"
      :saved="savedSection === 'contact'"
      @save="payload => save('contact', payload)"
    />
  </div>
</template>

<style scoped>
.site-content-grid { display: grid; gap: var(--admin-space-4); }
@media (min-width: 1280px) {
  .site-content-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  .site-content-grid > :deep(:nth-child(2)),
  .site-content-grid > :deep(:nth-child(4)),
  .site-content-grid > :deep(:nth-child(5)) { grid-column: 1 / -1; }
}
</style>
