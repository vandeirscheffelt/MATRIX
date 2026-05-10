import { describe, expect, it } from 'vitest'
import { getPlanByPriceId } from './plans'

describe('getPlanByPriceId', () => {
  it('returns null for empty price id', () => {
    expect(getPlanByPriceId('')).toBeNull()
    expect(getPlanByPriceId('   ')).toBeNull()
  })

  it('returns null for unknown price id', () => {
    expect(getPlanByPriceId('price_missing')).toBeNull()
  })
})
