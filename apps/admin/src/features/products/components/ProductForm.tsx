import { useMemo, useState, type FormEvent } from 'react'
import { TextAreaField, TextField, SelectField } from '../../../shared/components/FormField'
import { isValidBarcode } from '../utils/barcode'
import {
  emptyProductFormValues,
  formValuesToPayload,
  type ProductFormValues,
} from '../utils/product-form'
import type { FieldErrors } from '../../../core/errors/api-error'
import type { ProductPayload } from '../types'

type ProductFormProps = {
  initialValues?: ProductFormValues
  fieldErrors?: FieldErrors
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (payload: ProductPayload) => Promise<void>
}

const nutritionFields = [
  ['energyKcal', 'Energy kcal'],
  ['protein', 'Protein'],
  ['carbohydrates', 'Carbohydrates'],
  ['sugars', 'Sugars'],
  ['fat', 'Fat'],
  ['saturatedFat', 'Saturated fat'],
  ['fiber', 'Fiber'],
  ['salt', 'Salt'],
] as const

export function ProductForm({
  initialValues = emptyProductFormValues,
  fieldErrors = {},
  submitLabel,
  isSubmitting,
  onSubmit,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>(initialValues)
  const [localErrors, setLocalErrors] = useState<FieldErrors>({})
  const errors = useMemo(() => ({ ...fieldErrors, ...localErrors }), [fieldErrors, localErrors])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validationErrors = validate(values)
    setLocalErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    await onSubmit(formValuesToPayload(values))
  }

  function updateValue(name: keyof ProductFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <section className="form-section">
        <h2>Product</h2>
        <div className="form-grid">
          <TextField
            label="Barcode"
            value={values.barcode}
            error={errors.barcode}
            onChange={(event) => updateValue('barcode', event.target.value)}
            required
          />
          <TextField
            label="Name"
            value={values.name}
            error={errors.name}
            onChange={(event) => updateValue('name', event.target.value)}
            required
          />
          <TextField
            label="Brand"
            value={values.brand}
            error={errors.brand}
            onChange={(event) => updateValue('brand', event.target.value)}
          />
          <TextField
            label="Category"
            value={values.category}
            error={errors.category}
            onChange={(event) => updateValue('category', event.target.value)}
            required
          />
        </div>
        <TextAreaField
          label="Ingredients"
          value={values.ingredients}
          error={errors.ingredients}
          rows={5}
          onChange={(event) => updateValue('ingredients', event.target.value)}
        />
      </section>

      <section className="form-section">
        <h2>Nutrition</h2>
        <div className="form-grid">
          <SelectField
            label="Serving type"
            value={values.servingType}
            onChange={(value) => updateValue('servingType', value)}
            error={errors.servingType}
          >
            <option value="per100g">per100g</option>
            <option value="per100ml">per100ml</option>
          </SelectField>
          {nutritionFields.map(([name, label]) => (
            <TextField
              key={name}
              label={label}
              type="number"
              min="0"
              step="0.01"
              value={values[name]}
              error={errors[name]}
              onChange={(event) => updateValue(name, event.target.value)}
            />
          ))}
        </div>
      </section>

      <section className="form-section">
        <h2>Status</h2>
        <div className="form-grid">
          <TextField
            label="Health score"
            type="number"
            min="0"
            max="100"
            value={values.healthScore}
            error={errors.healthScore}
            onChange={(event) => updateValue('healthScore', event.target.value)}
            required
          />
          <SelectField
            label="Data status"
            value={values.dataStatus}
            onChange={(value) => updateValue('dataStatus', value)}
            error={errors.dataStatus}
          >
            <option value="unverified">unverified</option>
            <option value="community">community</option>
            <option value="verified">verified</option>
          </SelectField>
          <TextField
            label="Image URL"
            value={values.imageUrl}
            error={errors.imageUrl}
            onChange={(event) => updateValue('imageUrl', event.target.value)}
          />
          <TextField
            label="Source"
            value={values.source}
            error={errors.source}
            onChange={(event) => updateValue('source', event.target.value)}
          />
          <TextField
            label="Last verified date"
            type="date"
            value={values.lastVerifiedAt}
            error={errors.lastVerifiedAt}
            onChange={(event) => updateValue('lastVerifiedAt', event.target.value)}
          />
        </div>
      </section>

      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function validate(values: ProductFormValues): FieldErrors {
  const errors: FieldErrors = {}

  if (!isValidBarcode(values.barcode)) {
    errors.barcode = 'Barcode must be EAN-8, EAN-13, or UPC-A digits.'
  }

  if (!values.name.trim()) {
    errors.name = 'Product name is required.'
  }

  if (!values.category.trim()) {
    errors.category = 'Category is required.'
  }

  const healthScore = Number(values.healthScore)

  if (!Number.isInteger(healthScore) || healthScore < 0 || healthScore > 100) {
    errors.healthScore = 'Health score must be between 0 and 100.'
  }

  return errors
}
