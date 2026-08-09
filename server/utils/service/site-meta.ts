import { publicSiteMetaSchema } from '../../../shared/schemas/site-meta'
import type { PublicSiteMeta } from '../../../shared/types/contracts'
import type { RuntimeConfig } from '../runtime-config'

export function getPublicSiteMeta(config: RuntimeConfig): PublicSiteMeta {
  return publicSiteMetaSchema.parse({
    filings: {
      icp: config.icpFilingNumber && config.icpFilingUrl
        ? {
            number: config.icpFilingNumber,
            url: config.icpFilingUrl,
          }
        : null,
      police: config.policeFilingStatus === 'filed'
        && config.policeFilingNumber
        && config.policeFilingUrl
        ? {
            number: config.policeFilingNumber,
            url: config.policeFilingUrl,
          }
        : null,
    },
  })
}
