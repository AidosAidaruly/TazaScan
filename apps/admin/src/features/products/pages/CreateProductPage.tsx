import { useState } from 'react'
import { useHistory } from 'react-router-dom'
import { ApiClient } from '../../../core/api/api-client'
import { useAuth } from '../../../core/auth/use-auth'
import { ApiError, type FieldErrors } from '../../../core/errors/api-error'
import { ProductsApi } from '../api/products-api'
import { ProductForm } from '../components/ProductForm'
import type { ProductPayload } from '../types'

const productsApi = new ProductsApi(new ApiClient())

export function CreateProductPage() {
  const { token, logout } = useAuth()
  const history = useHistory()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(payload: ProductPayload) {
    if (!token || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError('')
    setFieldErrors({})

    try {
      const response = await productsApi.create(payload, token)
      history.push(`/products/${response.data.id}`)
    } catch (createError) {
      if (createError instanceof ApiError && createError.statusCode === 401) {
        logout()
        history.replace('/login')
        return
      }

      if (createError instanceof ApiError) {
        setError(createError.message)
        setFieldErrors(createError.fieldErrors)
      } else {
        setError('Could not create product')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Product Management</p>
          <h1>Create Product</h1>
        </div>
      </div>
      {error ? <div className="alert error">{error}</div> : null}
      <ProductForm
        submitLabel="Create product"
        isSubmitting={isSubmitting}
        fieldErrors={fieldErrors}
        onSubmit={handleSubmit}
      />
    </section>
  )
}
