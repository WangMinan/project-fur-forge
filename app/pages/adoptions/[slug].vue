<script setup lang="ts">
import { slugSchema } from '~~/shared/schemas/work'

const slug = slugSchema.safeParse(String(useRoute().params.slug ?? ''))
if (!slug.success) {
  throw createError({ statusCode: 404, statusMessage: '作品不存在' })
}
await navigateTo(`/works/${slug.data}`, { redirectCode: 301 })
</script>
