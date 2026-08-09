import type {
  PublicMediaCache,
  PublicMediaPurgeTaskStatus,
} from '../../server/utils/public-media-cache'

export class FakePublicMediaCache implements PublicMediaCache {
  readonly enabled = true
  readonly submittedUrls: string[][] = []
  describeError = false
  submitError = false
  statuses: PublicMediaPurgeTaskStatus[] = ['Complete']

  async purgeExactFiles(urls: readonly string[]) {
    if (this.submitError) {
      throw new Error('Synthetic ESA purge submission failure.')
    }
    this.submittedUrls.push([...urls])
    return `purge-task-${this.submittedUrls.length}`
  }

  async describeExactFilePurge() {
    if (this.describeError) {
      throw new Error('Synthetic ESA purge query failure.')
    }
    return this.statuses.shift() ?? 'Complete'
  }
}
