import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiClient } from '../../../core/api/api-client'
import { ApiError } from '../../../core/errors/api-error'
import { PageLoader } from '../../../shared/components/PageLoader'
import { formatDate } from '../../../shared/utils/date'
import { ProductsApi } from '../api/products-api'
import type { ProductDto } from '../types'

const productsApi = new ProductsApi(new ApiClient())

export function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<ProductDto | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadProduct() {
      if (!id) {
        return
      }

      try {
        const response = await productsApi.findById(id)

        if (isMounted) {
          setProduct(response.data)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof ApiError ? loadError.message : 'Could not load product')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadProduct()

    return () => {
      isMounted = false
    }
  }, [id])

  if (isLoading) {
    return <PageLoader label="Loading product..." />
  }

  if (error || !product) {
    return <div className="alert error">{error || 'Product not found'}</div>
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Product Details</p>
          <h1>{product.name}</h1>
        </div>
        <Link className="secondary-button" to={`/products/${product.id}/edit`}>
          Edit
        </Link>
      </div>

      <div className="details-grid">
        <div className="image-placeholder">Product image</div>
        <div className="details-card">
          <dl>
            <dt>Brand</dt>
            <dd>{product.brand ?? '-'}</dd>
            <dt>Category</dt>
            <dd>{product.category}</dd>
            <dt>Barcode</dt>
            <dd>{product.barcode}</dd>
            <dt>Data status</dt>
            <dd>{product.dataStatus}</dd>
            <dt>Calculated score</dt>
            <dd>{product.nutritionScore.score ?? '-'}</dd>
            <dt>Grade</dt>
            <dd>{product.nutritionScore.grade ?? '-'}</dd>
            <dt>Calculation status</dt>
            <dd>{product.nutritionScore.status}</dd>
            <dt>Algorithm</dt>
            <dd>
              {product.nutritionScore.algorithm} {product.nutritionScore.algorithmVersion}
            </dd>
            <dt>Last verified</dt>
            <dd>{formatDate(product.lastVerifiedAt)}</dd>
          </dl>
        </div>
      </div>

      <section className="details-card">
        <h2>Score review</h2>
        <dl className="nutrition-grid">
          <div>
            <dt>Missing fields</dt>
            <dd>{product.nutritionScore.missingFields.join(', ') || 'None'}</dd>
          </div>
          <div>
            <dt>Warnings</dt>
            <dd>{product.nutritionScore.warnings.join(', ') || 'None'}</dd>
          </div>
        </dl>
      </section>

      <section className="details-card">
        <h2>Ingredients</h2>
        <p>{product.ingredients.join(', ') || 'No ingredients recorded.'}</p>
      </section>

      <section className="details-card">
        <h2>Nutrition facts</h2>
        <dl className="nutrition-grid">
          {Object.entries(product.nutritionFacts).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value ?? 'Unknown'}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  )
}
