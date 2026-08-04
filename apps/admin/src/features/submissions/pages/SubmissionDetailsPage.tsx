import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { ApiClient } from '../../../core/api/api-client'
import { useAuth } from '../../../core/auth/use-auth'
import { ApiError } from '../../../core/errors/api-error'
import { env } from '../../../config/env'
import { PageLoader } from '../../../shared/components/PageLoader'
import { SubmissionsApi } from '../api/submissions-api'
import type { ApproveSubmissionPayload, ProductSubmissionDto } from '../types'

const submissionsApi = new SubmissionsApi(new ApiClient())

export function SubmissionDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const [submission, setSubmission] = useState<ProductSubmissionDto | null>(null)
  const [payload, setPayload] = useState<ApproveSubmissionPayload | null>(null)
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadSubmission() {
      if (!id) return
      try {
        const response = await submissionsApi.findById(id)
        if (isMounted) {
          setSubmission(response.data)
          setPayload(toApprovePayload(response.data))
        }
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof ApiError ? loadError.message : 'Could not load submission')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadSubmission()
    return () => {
      isMounted = false
    }
  }, [id])

  async function handleApprove(event: FormEvent) {
    event.preventDefault()
    if (!id || !token || !payload) return
    setIsSubmitting(true)
    setError('')
    try {
      const response = await submissionsApi.approve(id, { ...payload, moderationNote: note || null }, token)
      setSubmission(response.data)
    } catch (approveError) {
      setError(approveError instanceof ApiError ? approveError.message : 'Could not approve submission')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function updateStatus(status: 'rejected' | 'needs_correction') {
    if (!id || !token || !note.trim()) {
      setError('Moderation note is required.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const response = await submissionsApi.updateStatus(id, { status, moderationNote: note }, token)
      setSubmission(response.data)
    } catch (statusError) {
      setError(statusError instanceof ApiError ? statusError.message : 'Could not update status')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <PageLoader label="Loading submission..." />
  if (!submission || !payload) return <div className="alert error">{error || 'Submission not found'}</div>

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Unverified User Data</p>
          <h1>{submission.name ?? 'Product submission'}</h1>
          <p>Status: {submission.status}</p>
        </div>
      </div>

      {error ? <div className="alert error">{error}</div> : null}
      <ImageGrid submission={submission} token={token} />

      <form className="product-form" onSubmit={handleApprove}>
        <section className="form-section">
          <h2>Approval data</h2>
          <div className="form-grid">
            <Input label="Barcode" value={payload.barcode} onChange={(value) => setPayload({ ...payload, barcode: value })} />
            <Input label="Name" value={payload.name} onChange={(value) => setPayload({ ...payload, name: value })} />
            <Input label="Brand" value={payload.brand ?? ''} onChange={(value) => setPayload({ ...payload, brand: value || null })} />
            <Input label="Category" value={payload.category} onChange={(value) => setPayload({ ...payload, category: value })} />
          </div>
          <textarea
            value={payload.ingredients.join('\n')}
            onChange={(event) =>
              setPayload({ ...payload, ingredients: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })
            }
            rows={4}
          />
        </section>
        <section className="form-section">
          <h2>Nutrition</h2>
          <div className="form-grid">
            {(['energyKcal', 'protein', 'carbohydrates', 'sugars', 'fat', 'saturatedFat', 'fiber', 'salt'] as const).map((key) => (
              <Input
                key={key}
                label={key}
                type="number"
                value={payload[key] == null ? '' : String(payload[key])}
                onChange={(value) => setPayload({ ...payload, [key]: value === '' ? null : Number(value) })}
              />
            ))}
          </div>
        </section>
        <section className="form-section">
          <h2>Moderation note</h2>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </section>
        <div className="form-actions">
          <button className="primary-button" disabled={isSubmitting} type="submit">Approve</button>
          <button type="button" disabled={isSubmitting} onClick={() => void updateStatus('rejected')}>Reject</button>
          <button type="button" disabled={isSubmitting} onClick={() => void updateStatus('needs_correction')}>Needs correction</button>
        </div>
      </form>
    </section>
  )
}

function ImageGrid({ submission, token }: { submission: ProductSubmissionDto; token: string | null }) {
  const images = Object.entries(submission.images).filter(([, value]) => value)
  if (images.length === 0) return <div className="empty-state">No package photos.</div>
  return (
    <div className="details-grid">
      {images.map(([label, url]) => (
        <AuthenticatedImage key={label} url={`${env.apiBaseUrl}${url}`} label={label} token={token} />
      ))}
    </div>
  )
}

function AuthenticatedImage({ url, label, token }: { url: string; label: string; token: string | null }) {
  const [objectUrl, setObjectUrl] = useState('')

  useEffect(() => {
    let isMounted = true
    let createdUrl = ''

    async function loadImage() {
      if (!token) return
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const blob = await response.blob()
      createdUrl = URL.createObjectURL(blob)
      if (isMounted) setObjectUrl(createdUrl)
    }

    void loadImage()
    return () => {
      isMounted = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [token, url])

  if (!objectUrl) return <div className="image-placeholder">Loading image...</div>

  return <img className="image-placeholder" src={objectUrl} alt={label} />
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function toApprovePayload(submission: ProductSubmissionDto): ApproveSubmissionPayload {
  return {
    barcode: submission.barcode ?? '',
    name: submission.name ?? '',
    brand: submission.brand,
    category: submission.category ?? '',
    ingredients: submission.ingredients,
    servingType: submission.nutritionFacts.servingType ?? 'per100g',
    energyKcal: submission.nutritionFacts.energyKcal,
    protein: submission.nutritionFacts.protein,
    carbohydrates: submission.nutritionFacts.carbohydrates,
    sugars: submission.nutritionFacts.sugars,
    fat: submission.nutritionFacts.fat,
    saturatedFat: submission.nutritionFacts.saturatedFat,
    fiber: submission.nutritionFacts.fiber,
    salt: submission.nutritionFacts.salt,
  }
}
