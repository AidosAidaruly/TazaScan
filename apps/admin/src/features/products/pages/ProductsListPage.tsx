import { useEffect, useMemo, useState } from 'react'
import { Link, useHistory } from 'react-router-dom'
import { ApiClient } from '../../../core/api/api-client'
import { useAuth } from '../../../core/auth/use-auth'
import { ApiError } from '../../../core/errors/api-error'
import { PageLoader } from '../../../shared/components/PageLoader'
import { formatDate } from '../../../shared/utils/date'
import { ProductsApi } from '../api/products-api'
import type { ProductDto, ProductListResponse } from '../types'

const productsApi = new ProductsApi(new ApiClient())

export function ProductsListPage() {
  const { token, logout } = useAuth()
  const history = useHistory()
  const [products, setProducts] = useState<ProductDto[]>([])
  const [pagination, setPagination] = useState<ProductListResponse['pagination'] | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState({ name: '', brand: '', barcode: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const activeSearch = useMemo(
    () => ({
      name: search.name.trim() || undefined,
      brand: search.brand.trim() || undefined,
      barcode: search.barcode.trim() || undefined,
    }),
    [search],
  )

  useEffect(() => {
    let isMounted = true

    async function loadProducts() {
      setIsLoading(true)
      setError('')

      try {
        const response = await productsApi.list({
          page,
          pageSize: 10,
          ...activeSearch,
        })

        if (isMounted) {
          setProducts(response.data)
          setPagination(response.pagination)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof ApiError ? loadError.message : 'Could not load products')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadProducts()

    return () => {
      isMounted = false
    }
  }, [activeSearch, page])

  async function handleDelete(product: ProductDto) {
    if (!token || !confirm(`Delete ${product.name}?`)) {
      return
    }

    try {
      await productsApi.delete(product.id, token)
      setProducts((current) => current.filter((item) => item.id !== product.id))
    } catch (deleteError) {
      if (deleteError instanceof ApiError && deleteError.statusCode === 401) {
        logout()
        history.replace('/login')
        return
      }

      setError(deleteError instanceof ApiError ? deleteError.message : 'Could not delete product')
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Product Database</p>
          <h1>Products</h1>
        </div>
        <Link className="primary-button" to="/products/new">
          Create Product
        </Link>
      </div>

      <div className="toolbar">
        <input
          placeholder="Search name"
          value={search.name}
          onChange={(event) => {
            setPage(1)
            setSearch((current) => ({ ...current, name: event.target.value }))
          }}
        />
        <input
          placeholder="Search brand"
          value={search.brand}
          onChange={(event) => {
            setPage(1)
            setSearch((current) => ({ ...current, brand: event.target.value }))
          }}
        />
        <input
          placeholder="Search barcode"
          value={search.barcode}
          onChange={(event) => {
            setPage(1)
            setSearch((current) => ({ ...current, barcode: event.target.value }))
          }}
        />
      </div>

      {error ? <div className="alert error">{error}</div> : null}
      {isLoading ? <PageLoader label="Loading products..." /> : null}
      {!isLoading && products.length === 0 ? (
        <div className="empty-state">No products found.</div>
      ) : null}
      {!isLoading && products.length > 0 ? (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Brand</th>
                <th>Barcode</th>
                <th>Category</th>
                <th>Status</th>
                <th>Score</th>
                <th>Verified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Link to={`/products/${product.id}`}>{product.name}</Link>
                  </td>
                  <td>{product.brand ?? '—'}</td>
                  <td>{product.barcode}</td>
                  <td>{product.category}</td>
                  <td>
                    <span className={`status-pill ${product.dataStatus}`}>
                      {product.dataStatus}
                    </span>
                  </td>
                  <td>{product.healthScore}</td>
                  <td>{formatDate(product.lastVerifiedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <Link to={`/products/${product.id}/edit`}>Edit</Link>
                      <button type="button" onClick={() => void handleDelete(product)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination ? (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
          </span>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  )
}
