import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockResponse } from '../../../test/test-utils'
import type { ProductSubmissionDto } from '../types'
import { SubmissionDetailsPage } from './SubmissionDetailsPage'

vi.mock('../../../core/auth/use-auth', () => ({
  useAuth: () => ({ token: 'admin-token', logout: vi.fn() }),
}))

const submission: ProductSubmissionDto = {
  id: 'submission-id',
  barcode: '4870200000011',
  name: 'Шоколадный батончик',
  brand: null,
  category: 'Шоколад',
  ingredients: ['сахар', 'какао-масло'],
  nutritionFacts: {
    servingType: 'per100g',
    energyKcal: 520,
    protein: 6.5,
    carbohydrates: 58,
    sugars: 48,
    fat: 28,
    saturatedFat: 17,
    fiber: null,
    salt: 0.25,
  },
  images: {
    frontImageUrl: null,
    ingredientsImageUrl: null,
    nutritionImageUrl: null,
    barcodeImageUrl: null,
  },
  status: 'pending',
  moderationNote: null,
  submittedAt: '2026-08-01T00:00:00.000Z',
  reviewedAt: null,
  reviewedByUserId: null,
  createdProductId: null,
  anonymousDeviceId: null,
}

function mockFetch(approveResponse: Promise<Response>) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => createMockResponse({ data: submission }))
    .mockImplementationOnce(() => approveResponse)
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/submissions/submission-id']}>
      <Route path="/submissions/:id">
        <SubmissionDetailsPage />
      </Route>
    </MemoryRouter>,
  )
  return screen.findByLabelText('Nutri-Score category')
}

function sentApproveBody(fetchSpy: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchSpy.mock.calls[1]!
  expect(url).toBe('http://localhost:4000/product-submissions/submission-id/approve')
  expect((init as RequestInit).method).toBe('POST')
  return JSON.parse((init as RequestInit).body as string)
}

describe('SubmissionDetailsPage: Nutri-Score category on approval', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('offers the same categories as the product form, starting at Unknown', async () => {
    mockFetch(createMockResponse({}))
    const select = (await renderPage()) as HTMLSelectElement

    expect(select.value).toBe('')
    expect([...select.options].map((option) => option.value)).toEqual([
      '',
      'general_food',
      'beverage',
      'water',
      'cheese',
      'fats_oils_nuts_seeds',
      'red_meat',
    ])
  })

  it('sends the selected category with the approval', async () => {
    const fetchSpy = mockFetch(
      createMockResponse({ data: { ...submission, status: 'approved', createdProductId: 'product-id' } }),
    )
    const user = userEvent.setup()
    const select = await renderPage()

    await user.selectOptions(select, 'general_food')
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const body = sentApproveBody(fetchSpy)
    expect(body.officialNutriScoreCategory).toBe('general_food')
    // Nutrition is sent as reviewed: unknown values stay null, nothing is filled in.
    expect(body).toMatchObject({ energyKcal: 520, fiber: null, servingType: 'per100g' })
    expect(body).not.toHaveProperty('fruitVegetableLegumePercent')
    expect(await screen.findByText('Status: approved')).toBeInTheDocument()
  })

  it('sends null when the category is left Unknown, so approval is not blocked', async () => {
    const fetchSpy = mockFetch(createMockResponse({ data: { ...submission, status: 'approved' } }))
    const user = userEvent.setup()
    await renderPage()

    await user.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(sentApproveBody(fetchSpy).officialNutriScoreCategory).toBeNull()
  })

  it('sends null again after a category is selected and then reset to Unknown', async () => {
    const fetchSpy = mockFetch(createMockResponse({ data: { ...submission, status: 'approved' } }))
    const user = userEvent.setup()
    const select = await renderPage()

    await user.selectOptions(select, 'beverage')
    await user.selectOptions(select, '')
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    expect(sentApproveBody(fetchSpy).officialNutriScoreCategory).toBeNull()
  })

  it('shows the API validation error and stays pending when approval is rejected', async () => {
    mockFetch(
      createMockResponse(
        {
          error: {
            message: 'Validation failed',
            details: { fieldErrors: { officialNutriScoreCategory: ['Invalid option'] } },
          },
        },
        400,
      ),
    )
    const user = userEvent.setup()
    const select = await renderPage()

    await user.selectOptions(select, 'cheese')
    await user.click(screen.getByRole('button', { name: 'Approve' }))

    expect(await screen.findByText('Validation failed')).toBeInTheDocument()
    expect(screen.getByText('Status: pending')).toBeInTheDocument()
  })

  it('does not send the category with reject or needs-correction', async () => {
    const fetchSpy = mockFetch(createMockResponse({ data: { ...submission, status: 'rejected' } }))
    const user = userEvent.setup()
    const select = await renderPage()

    await user.selectOptions(select, 'general_food')
    await user.type(screen.getAllByRole('textbox').at(-1)!, 'Blurry photo')
    await user.click(screen.getByRole('button', { name: 'Reject' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const [url, init] = fetchSpy.mock.calls[1]!
    expect(url).toBe('http://localhost:4000/product-submissions/submission-id/status')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      status: 'rejected',
      moderationNote: 'Blurry photo',
    })
  })
})
