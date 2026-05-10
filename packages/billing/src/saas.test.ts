import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSubscriptions = {
  create: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
}

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      subscriptions: mockSubscriptions,
    })),
  }
})

process.env.STRIPE_SECRET_KEY = 'sk_test_mock'

const { createSaaSSubscription, updateSubscriptionQuantity, isSubscriptionActive } = await import('./saas')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createSaaSSubscription', () => {
  it('returns subscriptionId and status on success', async () => {
    mockSubscriptions.create.mockResolvedValue({ id: 'sub_123', status: 'active' })

    const result = await createSaaSSubscription({
      customerId: 'cus_abc',
      priceId: 'price_xyz',
    })

    expect(result.data).toEqual({ subscriptionId: 'sub_123', status: 'active' })
    expect(result.error).toBeNull()
    expect(mockSubscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_abc',
        items: [{ price: 'price_xyz', quantity: 1 }],
      })
    )
  })

  it('passes optional quantity, trialDays, metadata', async () => {
    mockSubscriptions.create.mockResolvedValue({ id: 'sub_456', status: 'trialing' })

    await createSaaSSubscription({
      customerId: 'cus_abc',
      priceId: 'price_xyz',
      quantity: 5,
      trialDays: 14,
      metadata: { tenantId: 't1' },
    })

    expect(mockSubscriptions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ price: 'price_xyz', quantity: 5 }],
        trial_period_days: 14,
        metadata: { tenantId: 't1' },
      })
    )
  })

  it('returns error on stripe failure', async () => {
    mockSubscriptions.create.mockRejectedValue(new Error('card declined'))

    const result = await createSaaSSubscription({ customerId: 'cus_abc', priceId: 'price_xyz' })

    expect(result.data).toBeNull()
    expect(result.error).toBe('card declined')
  })
})

describe('updateSubscriptionQuantity', () => {
  it('updates quantity on the first item', async () => {
    mockSubscriptions.retrieve.mockResolvedValue({
      items: { data: [{ id: 'si_item1' }] },
    })
    mockSubscriptions.update.mockResolvedValue({})

    const result = await updateSubscriptionQuantity({ subscriptionId: 'sub_123', quantity: 10 })

    expect(result.error).toBeNull()
    expect(mockSubscriptions.update).toHaveBeenCalledWith('sub_123', {
      items: [{ id: 'si_item1', quantity: 10 }],
    })
  })

  it('returns error when subscription has no items', async () => {
    mockSubscriptions.retrieve.mockResolvedValue({ items: { data: [] } })

    const result = await updateSubscriptionQuantity({ subscriptionId: 'sub_123', quantity: 3 })

    expect(result.error).toBe('Subscription has no items')
  })

  it('returns error on stripe failure', async () => {
    mockSubscriptions.retrieve.mockRejectedValue(new Error('not found'))

    const result = await updateSubscriptionQuantity({ subscriptionId: 'sub_bad', quantity: 1 })

    expect(result.error).toBe('not found')
  })
})

describe('isSubscriptionActive', () => {
  it('returns true for active status', async () => {
    mockSubscriptions.retrieve.mockResolvedValue({ status: 'active' })
    expect(await isSubscriptionActive('sub_123')).toBe(true)
  })

  it('returns true for trialing status', async () => {
    mockSubscriptions.retrieve.mockResolvedValue({ status: 'trialing' })
    expect(await isSubscriptionActive('sub_123')).toBe(true)
  })

  it('returns false for canceled status', async () => {
    mockSubscriptions.retrieve.mockResolvedValue({ status: 'canceled' })
    expect(await isSubscriptionActive('sub_123')).toBe(false)
  })

  it('returns false on stripe error', async () => {
    mockSubscriptions.retrieve.mockRejectedValue(new Error('network error'))
    expect(await isSubscriptionActive('sub_bad')).toBe(false)
  })
})
