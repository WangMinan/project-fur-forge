export default defineEventHandler(() => {
  throw new Error(
    'test-contact@example.invalid prod/original/private.jpg password=test-only',
  )
})
