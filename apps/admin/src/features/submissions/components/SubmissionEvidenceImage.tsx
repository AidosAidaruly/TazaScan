import { useEffect, useState } from 'react'

type EvidenceState =
  | { status: 'loading' }
  | { status: 'loaded'; objectUrl: string }
  | { status: 'unauthorized' | 'forbidden' | 'unavailable' | 'error' }

const failureMessages = {
  unauthorized: 'Session expired. Please sign in again.',
  forbidden: 'You do not have permission to view this image.',
  unavailable: 'Image unavailable.',
  error: 'Could not load image. Try again later.',
} as const

type Props = {
  url: string
  label: string
  token: string | null
  /** Called on 401 so the app can end the session (same as other admin requests). */
  onUnauthorized: () => void
}

/**
 * Loads admin-only submission evidence with the bearer token. Only a successful image
 * response becomes a blob URL; failures render a fixed message, never the response body.
 */
export function SubmissionEvidenceImage({ url, label, token, onUnauthorized }: Props) {
  const [state, setState] = useState<EvidenceState>({ status: 'loading' })

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    let createdUrl = ''

    async function loadImage() {
      setState({ status: 'loading' })
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (controller.signal.aborted) return

        if (!response.ok) {
          if (response.status === 401) {
            setState({ status: 'unauthorized' })
            onUnauthorized()
            return
          }
          setState({
            status:
              response.status === 404 ? 'unavailable' : response.status === 403 ? 'forbidden' : 'error',
          })
          return
        }

        const blob = await response.blob()
        if (controller.signal.aborted) return
        // Never render a non-image body (e.g. JSON or HTML) as an image.
        if (!blob.type.startsWith('image/')) {
          setState({ status: 'error' })
          return
        }

        createdUrl = URL.createObjectURL(blob)
        setState({ status: 'loaded', objectUrl: createdUrl })
      } catch {
        if (!controller.signal.aborted) setState({ status: 'error' })
      }
    }

    void loadImage()

    return () => {
      // Cancels a pending request, so a late response can never create a leaked URL.
      controller.abort()
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [onUnauthorized, token, url])

  if (state.status === 'loading') {
    return <div className="image-placeholder">Loading image...</div>
  }

  if (state.status === 'loaded') {
    return <img className="image-placeholder" src={state.objectUrl} alt={label} />
  }

  return (
    <div className="image-placeholder" role="status" aria-label={`${label} image`}>
      {failureMessages[state.status]}
    </div>
  )
}
