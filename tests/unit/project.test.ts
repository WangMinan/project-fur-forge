import { describe, expect, it } from 'vitest'
import {
  ACCESS_SURFACES,
  PROJECT_ENGLISH_NAME,
  PROJECT_NAME,
  PUBLIC_NAV_BRAND,
} from '../../shared/constants/project'

describe('project scaffold', () => {
  it('keeps one public and one admin access surface', () => {
    expect(ACCESS_SURFACES).toEqual([
      'public',
      'admin',
    ])
  })

  it('uses the confirmed studio names', () => {
    expect(PROJECT_NAME).toBe('有点小狗工作室')
    expect(PROJECT_ENGLISH_NAME).toBe('DITE DOG')
    expect(PUBLIC_NAV_BRAND).toBe('有点小狗')
  })
})
