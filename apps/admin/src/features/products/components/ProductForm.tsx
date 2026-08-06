import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  TextAreaField,
  TextField,
  SelectField,
} from "../../../shared/components/FormField";
import { resolveAssetUrl } from "../../../shared/utils/asset-url";
import { isValidBarcode } from "../utils/barcode";
import { validateProductImageFile } from "../utils/product-image-validation";
import {
  emptyProductFormValues,
  formValuesToPayload,
  type ProductFormValues,
} from "../utils/product-form";
import type { FieldErrors } from "../../../core/errors/api-error";
import type { ProductPayload } from "../types";

type ProductFormProps = {
  initialValues?: ProductFormValues;
  fieldErrors?: FieldErrors;
  submitLabel: string;
  isSubmitting: boolean;
  isImageRemoving?: boolean;
  onSubmit: (payload: ProductPayload, imageFile: File | null) => Promise<void>;
  onRemoveImage?: () => Promise<void>;
};

const nutritionFields = [
  ["energyKcal", "Energy kcal"],
  ["protein", "Protein"],
  ["carbohydrates", "Carbohydrates"],
  ["sugars", "Sugars"],
  ["fat", "Fat"],
  ["saturatedFat", "Saturated fat"],
  ["fiber", "Fiber"],
  ["salt", "Salt"],
] as const;

export function ProductForm({
  initialValues = emptyProductFormValues,
  fieldErrors = {},
  submitLabel,
  isSubmitting,
  isImageRemoving = false,
  onSubmit,
  onRemoveImage,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>(initialValues);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const errors = useMemo(
    () => ({ ...fieldErrors, ...localErrors }),
    [fieldErrors, localErrors],
  );

  useEffect(() => {
    setValues(initialValues);
    setImageFile(null);
  }, [initialValues]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validate(values);
    setLocalErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    await onSubmit(formValuesToPayload(values), imageFile);
  }

  function updateValue(name: keyof ProductFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
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
            onChange={(event) => updateValue("barcode", event.target.value)}
            required
          />
          <TextField
            label="Name"
            value={values.name}
            error={errors.name}
            onChange={(event) => updateValue("name", event.target.value)}
            required
          />
          <TextField
            label="Brand"
            value={values.brand}
            error={errors.brand}
            onChange={(event) => updateValue("brand", event.target.value)}
          />
          <TextField
            label="Category"
            value={values.category}
            error={errors.category}
            onChange={(event) => updateValue("category", event.target.value)}
            required
          />
        </div>
        <TextAreaField
          label="Ingredients"
          value={values.ingredients}
          error={errors.ingredients}
          rows={5}
          onChange={(event) => updateValue("ingredients", event.target.value)}
        />
      </section>

      <section className="form-section">
        <h2>Nutrition</h2>
        <div className="form-grid">
          <SelectField
            label="Serving type"
            value={values.servingType}
            onChange={(value) => updateValue("servingType", value)}
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
          <SelectField
            label="Data status"
            value={values.dataStatus}
            onChange={(value) => updateValue("dataStatus", value)}
            error={errors.dataStatus}
          >
            <option value="unverified">unverified</option>
            <option value="community">community</option>
            <option value="verified">verified</option>
          </SelectField>
          <TextField
            label="Source"
            value={values.source}
            error={errors.source}
            onChange={(event) => updateValue("source", event.target.value)}
          />
          <TextField
            label="Last verified date"
            type="date"
            value={values.lastVerifiedAt}
            error={errors.lastVerifiedAt}
            onChange={(event) =>
              updateValue("lastVerifiedAt", event.target.value)
            }
          />
        </div>
        <ProductImageField
          imageUrl={values.imageUrl}
          selectedFile={imageFile}
          error={errors.imageUrl}
          isRemoving={isImageRemoving}
          onSelect={(file) => setImageFile(file)}
          onClearSelected={() => setImageFile(null)}
          onRemoveCurrent={async () => {
            if (!onRemoveImage) {
              setValues((current) => ({ ...current, imageUrl: "" }));
              return;
            }

            await onRemoveImage();
            setValues((current) => ({ ...current, imageUrl: "" }));
          }}
        />
      </section>

      <div className="form-actions">
        <button
          type="submit"
          className="primary-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

type ProductImageFieldProps = {
  imageUrl: string;
  selectedFile: File | null;
  error?: string;
  isRemoving: boolean;
  onSelect: (file: File) => void;
  onClearSelected: () => void;
  onRemoveCurrent: () => Promise<void>;
};

function ProductImageField({
  imageUrl,
  selectedFile,
  error,
  isRemoving,
  onSelect,
  onClearSelected,
  onRemoveCurrent,
}: ProductImageFieldProps) {
  const [localError, setLocalError] = useState("");
  const previewUrl = useMemo(() => {
    if (selectedFile) {
      return URL.createObjectURL(selectedFile);
    }

    return resolveAssetUrl(imageUrl);
  }, [imageUrl, selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl && selectedFile) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, selectedFile]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const imageError = validateProductImageFile(file);
    if (imageError) {
      setLocalError(imageError);
      return;
    }

    setLocalError("");
    onSelect(file);
  }

  return (
    <div className="image-upload-field">
      <div className="product-image-preview">
        {previewUrl ? (
          <img src={previewUrl} alt="Product preview" />
        ) : (
          <span>Package image</span>
        )}
      </div>
      <div className="image-upload-controls">
        <label className="secondary-button">
          Select image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
          />
        </label>
        {selectedFile ? (
          <button
            type="button"
            className="ghost-button"
            onClick={onClearSelected}
          >
            Clear selected
          </button>
        ) : null}
        {!selectedFile && imageUrl ? (
          <button
            type="button"
            className="ghost-button danger"
            disabled={isRemoving}
            onClick={() => void onRemoveCurrent()}
          >
            {isRemoving ? "Removing..." : "Remove image"}
          </button>
        ) : null}
        <p>JPEG, PNG, or WebP. Maximum 5 MB.</p>
        {selectedFile ? <strong>{selectedFile.name}</strong> : null}
        {localError || error ? (
          <span className="field-error">{localError || error}</span>
        ) : null}
      </div>
    </div>
  );
}

function validate(values: ProductFormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (!isValidBarcode(values.barcode)) {
    errors.barcode = "Barcode must be EAN-8, EAN-13, or UPC-A digits.";
  }

  if (!values.name.trim()) {
    errors.name = "Product name is required.";
  }

  if (!values.category.trim()) {
    errors.category = "Category is required.";
  }

  return errors;
}
