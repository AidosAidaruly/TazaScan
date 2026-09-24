import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiClient } from '../../../core/api/api-client'
import { useAuth } from '../../../core/auth/use-auth'
import { ApiError } from '../../../core/errors/api-error'
import { PageLoader } from '../../../shared/components/PageLoader'
import { formatDate } from '../../../shared/utils/date'
import { SubmissionsApi } from '../api/submissions-api'
import type { ProductSubmissionDto, SubmissionStatus } from '../types'

const submissionsApi = new SubmissionsApi(new ApiClient())
const statuses: Array<SubmissionStatus | ''> = ['', 'pending', 'approved', 'rejected', 'needs_correction']

export function SubmissionsListPage() {
  const { token } = useAuth()
  const [submissions, setSubmissions] = useState<ProductSubmissionDto[]>([])
  const [status, setStatus] = useState<SubmissionStatus | ''>('pending')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadSubmissions() {
      if (!token) return
      setIsLoading(true)
      setError('')

      try {
        const response = await submissionsApi.list({
          page,
          pageSize: 10,
          status: status || undefined,
        }, token)

        if (isMounted) {
          setSubmissions(response.data)
          setTotalPages(Math.max(response.pagination.totalPages, 1))
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof ApiError ? loadError.message : 'Could not load submissions')
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadSubmissions()
    return () => {
      isMounted = false
    }
  }, [page, status, token])

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Community Moderation</p>
          <h1>Product Submissions</h1>
        </div>
      </div>

      <div className="toolbar">
        <select
          value={status}
          onChange={(event) => {
            setPage(1)
            setStatus(event.target.value as SubmissionStatus | '')
          }}
        >
          {statuses.map((item) => (
            <option key={item || 'all'} value={item}>
              {item || 'all'}
            </option>
          ))}
        </select>
      </div>

      {error ? <div className="alert error">{error}</div> : null}
      {isLoading ? <PageLoader label="Loading submissions..." /> : null}
      {!isLoading && submissions.length === 0 ? (
        <div className="empty-state">No submissions found.</div>
      ) : null}
      {!isLoading && submissions.length > 0 ? (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Barcode</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td>{submission.name ?? '-'}</td>
                  <td>{submission.barcode ?? '-'}</td>
                  <td>{submission.status}</td>
                  <td>{formatDate(submission.submittedAt)}</td>
                  <td>
                    <Link to={`/submissions/${submission.id}`}>Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
          Next
        </button>
      </div>
    </section>
  )
}
