import { z } from 'zod'

export const contactEmailSchema = z.string().trim().email().max(254)
export const contactQqSchema = z.string().trim().regex(/^[1-9]\d{4,11}$/u)
