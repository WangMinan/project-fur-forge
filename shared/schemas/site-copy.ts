import { z } from 'zod'
import { SITE_LOCALE_CODES } from '../constants/site-locales'
import { apiSuccessSchema } from './api'

export const siteCopyLocaleSchema = z.enum(SITE_LOCALE_CODES)
export const siteCopySectionSchema = z.enum(['home', 'commission', 'about', 'status'])
export type SiteCopySection = z.infer<typeof siteCopySectionSchema>
export type SiteCopyLocale = z.infer<typeof siteCopyLocaleSchema>

export const SITE_COPY_FIELDS = {
  home: [{ key: 'tagline', label: '首页 slogan', max: 120, rows: 2 }],
  commission: [
    { key: 'intro', label: '委托简介', max: 240, rows: 3 },
    { key: 'estimateNote', label: '人工估价说明', max: 600, rows: 5 },
    { key: 'emailAction', label: '邮件联系引导', max: 240, rows: 3 },
  ],
  about: [
    { key: 'studioFacts', label: '工作室介绍', max: 1200, rows: 6 },
    { key: 'makingScope', label: '制作范围', max: 1200, rows: 6 },
  ],
  status: [{ key: 'label', label: '营业状态展示文案', max: 40, rows: 2 }],
} as const
export const SITE_COPY_TITLES: Record<SiteCopySection, string> = {
  home: '首页', commission: '委托', about: '关于工作室', status: '营业状态文案',
}

export const plainTextSchema = (max: number) => z.string().trim().min(1).max(max)
  .refine(value => !/[<>]|\b(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/iu.test(value), '只允许安全纯文本')
export const siteCopySchemas = {
  home: z.object({ tagline: plainTextSchema(120).nullable() }).strict(),
  commission: z.object({ intro: plainTextSchema(240).nullable(), estimateNote: plainTextSchema(600).nullable(), emailAction: plainTextSchema(240).nullable() }).strict(),
  about: z.object({ studioFacts: plainTextSchema(1200).nullable(), makingScope: plainTextSchema(1200).nullable() }).strict(),
  status: z.object({ label: plainTextSchema(40).nullable() }).strict(),
}
export const siteCopySectionsSchema = z.object(siteCopySchemas).strict()
export type SiteCopySections = z.infer<typeof siteCopySectionsSchema>
export const publicSiteCopySchema = z.record(z.string().min(1).max(35), siteCopySectionsSchema)
export type PublicSiteCopy = z.infer<typeof publicSiteCopySchema>
const entry = <T extends z.ZodType>(fields: T) => z.object({ version: z.number().int().nonnegative(), fields }).strict()
export const adminSiteCopyResponseSchema = apiSuccessSchema(z.object({
  locale: siteCopyLocaleSchema,
  source: siteCopySectionsSchema,
  sections: z.object({
    home: entry(siteCopySchemas.home), commission: entry(siteCopySchemas.commission),
    about: entry(siteCopySchemas.about), status: entry(siteCopySchemas.status),
  }).strict(),
}).strict())
export type AdminSiteCopy = z.infer<typeof adminSiteCopyResponseSchema>['data']
export const updateSiteCopyRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  payload: z.record(z.string(), z.string().nullable()),
}).strict()
