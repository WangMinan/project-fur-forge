import { describe, expect, it } from 'vitest'
import { COMMISSION_DELETE_CONFIRMATION } from '../../shared/schemas/commission'
import { parseCommissionRetentionCommand } from '../../scripts/commission-retention'

describe('commission retention CLI boundary', () => {
  it('defaults to list/dry-run and requires the fixed execute confirmation', () => {
    expect(parseCommissionRetentionCommand([])).toEqual({ kind: 'list' })
    expect(parseCommissionRetentionCommand([
      '--identifier', 'DD-RETENTION01',
    ])).toEqual({ kind: 'preview', identifier: 'DD-RETENTION01' })
    expect(() => parseCommissionRetentionCommand([
      '--identifier', 'DD-RETENTION01', '--execute', '--confirm', 'wrong',
    ])).toThrow(/Refusing deletion/u)
    expect(parseCommissionRetentionCommand([
      '--identifier', 'DD-RETENTION01',
      '--execute', '--confirm', COMMISSION_DELETE_CONFIRMATION,
    ])).toEqual({ kind: 'execute', identifier: 'DD-RETENTION01' })
  })
})
