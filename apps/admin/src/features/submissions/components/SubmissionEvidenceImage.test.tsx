import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Switch } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../../core/auth/auth-context'
import { SubmissionDetailsPage } from '../pages/SubmissionDetailsPage'
import type { ProductSubmissionDto } from '../types'
import { SubmissionEvidenceImage } from './SubmissionEvidenceImage'

const evidenceUrl = 'http://localhost:4000/product-submissions/uploads/aaaaaaaa-1111-4222-8333-444444444444.jpg'
const rawErrorBody =
  '<html><body>500 nginx</body></html> {"error":{"message":"Internal server error","stack":"Error at C:\\\\srv\\\\db.ts"}}'

function mockResponse(status: number, body: string, type: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    blob: vi.fn(() => Promise.resolve(new Blob([body], { type }))),
    json: () => Promise.resolve(JSON.parse(body.startsWith('{') ? body : '{}')),
  } as unknown as Response
}

let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>

beforeEach(() => {
  let counter = 0
  createObjectURL = vi.fn(() => `blob:evidence-${++counter}`)
  revokeObjectURL = vi.fn()
  Object.assign(URL, { createObjectURL, revokeObjectURL })
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderImage(props: Partial<Parameters<typeof SubmissionEvidenceImage>[0]> = {}) {
  const onUnauthorized = vi.fn()
  const view = render(
    <SubmissionEvidenceImage
      url={evidenceUrl}
      label="frontImageUrl"
      token="admin-token"
      onUnauthorized={onUnauthorized}
      {...props}
    />,
  )
  return { ...view, onUnauthorized }
}

describe('SubmissionEvidenceImage', () => {
  it('renders a successful image response with the bearer token', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockResponse(200, 'jpeg-bytes', 'image/jpeg'))

    renderImage()

    const image = await screen.findByRole('img', { name: 'frontImageUrl' })
    expect(image).toHaveAttribute('src', 'blob:evidence-1')
    expect(fetchSpy).toHaveBeenCalledWith(
      evidenceUrl,
      expect.objectContaining({ headers: { Authorization: 'Bearer admin-token' } }),
    )
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('shows "image unavailable" for 404 instead of a broken image', async () => {
    const response = mockResponse(404, '{"error":{"message":"Submission image not found"}}', 'application/json')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)

    renderImage()

    expect(await screen.findByRole('status')).toHaveTextContent('Image unavailable.')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(response.blob).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('ends the session on 401 like other admin requests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(401, '{"error":{"message":"Invalid token"}}', 'application/json'),
    )

    const { onUnauthorized } = renderImage()

    expect(await screen.findByRole('status')).toHaveTextContent('Session expired. Please sign in again.')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('shows a permission message for 403 without ending the session', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(403, '{"error":{"message":"Forbidden"}}', 'application/json'),
    )

    const { onUnauthorized } = renderImage()

    expect(await screen.findByRole('status')).toHaveTextContent(
      'You do not have permission to view this image.',
    )
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it.each([
    ['a 500 response', () => Promise.resolve(mockResponse(500, rawErrorBody, 'text/html'))],
    ['a 502 proxy page', () => Promise.resolve(mockResponse(502, rawErrorBody, 'text/html'))],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 200 that is not an image', () => Promise.resolve(mockResponse(200, rawErrorBody, 'application/json'))],
  ])('shows a generic error for %s, never the raw body', async (_label, respond) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(respond)

    const { container } = renderImage()

    expect(await screen.findByRole('status')).toHaveTextContent('Could not load image. Try again later.')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(createObjectURL).not.toHaveBeenCalled()
    for (const fragment of ['nginx', 'stack', 'db.ts', 'Internal server error', 'Failed to fetch', '<html']) {
      expect(container.innerHTML).not.toContain(fragment)
    }
  })

  it('revokes the object URL on unmount', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(200, 'jpeg', 'image/jpeg'))

    const { unmount } = renderImage()
    await screen.findByRole('img')
    unmount()

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:evidence-1')
  })

  it('revokes the previous object URL when the image URL changes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse(200, 'jpeg', 'image/jpeg'))

    const { rerender, onUnauthorized } = renderImage()
    await screen.findByRole('img')
    rerender(
      <SubmissionEvidenceImage
        url={`${evidenceUrl}?v=2`}
        label="frontImageUrl"
        token="admin-token"
        onUnauthorized={onUnauthorized}
      />,
    )

    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:evidence-2'))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:evidence-1')
  })

  it('creates no object URL when the response arrives after unmount', async () => {
    let respond: (response: Response) => void = () => undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => (respond = resolve)),
    )

    const { unmount } = renderImage()
    unmount()
    respond(mockResponse(200, 'jpeg', 'image/jpeg'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('does not request evidence without a token', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    renderImage({ token: null })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.getByText('Loading image...')).toBeInTheDocument()
  })
})

describe('SubmissionDetailsPage evidence', () => {
  const submission = {
    id: 'sub-1',
    barcode: '4870001234567',
    name: 'Ayran',
    brand: null,
    category: 'Dairy',
    ingredients: [],
    nutritionFacts: {
      servingType: 'per100ml',
      energyKcal: null,
      protein: null,
      carbohydrates: null,
      sugars: null,
      fat: null,
      saturatedFat: null,
      fiber: null,
      salt: null,
    },
    images: {
      frontImageUrl: '/product-submissions/uploads/aaaaaaaa-1111-4222-8333-444444444444.jpg',
      ingredientsImageUrl: null,
      nutritionImageUrl: null,
      barcodeImageUrl: null,
    },
    status: 'pending',
    moderationNote: null,
    submittedAt: '2026-08-01T00:00:00.000Z',
    reviewedAt: null,
    createdProductId: null,
  } as unknown as ProductSubmissionDto

  function json(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response
  }

  it('an evidence 401 logs the admin out (existing session behavior)', async () => {
    sessionStorage.setItem('project_admin_access_token', 'expired-token')
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(json(200, { data: { id: 'admin', email: 'a@example.com', role: 'admin' } }))
      }
      if (url.endsWith('/product-submissions/sub-1')) {
        return Promise.resolve(json(200, { data: submission }))
      }
      return Promise.resolve(mockResponse(401, '{"error":{"message":"Invalid token"}}', 'application/json'))
    })

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/submissions/sub-1']}>
          <Switch>
            <Route path="/submissions/:id" component={SubmissionDetailsPage} />
          </Switch>
        </MemoryRouter>
      </AuthProvider>,
    )

    await waitFor(() => expect(sessionStorage.getItem('project_admin_access_token')).toBeNull())
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
