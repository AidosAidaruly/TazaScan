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
import { ApiError, type FieldErrors } from "../../../core/errors/api-error";
import type {
  OfficialNutriScorePreviewResponse,
  ProductPayload,
  TazaScorePreviewResponse,
} from "../types";

type ProductFormProps = {
  initialValues?: ProductFormValues;
  fieldErrors?: FieldErrors;
  submitLabel: string;
  isSubmitting: boolean;
  isImageRemoving?: boolean;
  onSubmit: (payload: ProductPayload, imageFile: File | null) => Promise<void>;
  onPreviewOfficialNutriScore?: (
    payload: ProductPayload,
  ) => Promise<OfficialNutriScorePreviewResponse["data"]>;
  onPreviewTazaScore?: (
    payload: ProductPayload,
  ) => Promise<TazaScorePreviewResponse["data"]>;
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

const officialNutriScoreCategories = [
  ["", "Unknown"],
  ["general_food", "General food"],
  ["beverage", "Beverage"],
  ["water", "Water"],
  ["cheese", "Cheese"],
  ["fats_oils_nuts_seeds", "Fats, oils, nuts, seeds"],
  ["red_meat", "Red meat"],
] as const;

export function ProductForm({
  initialValues = emptyProductFormValues,
  fieldErrors = {},
  submitLabel,
  isSubmitting,
  isImageRemoving = false,
  onSubmit,
  onPreviewOfficialNutriScore,
  onPreviewTazaScore,
  onRemoveImage,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>(initialValues);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const [preview, setPreview] = useState<
    OfficialNutriScorePreviewResponse["data"] | null
  >(null);
  const [tazaScorePreview, setTazaScorePreview] = useState<
    TazaScorePreviewResponse["data"] | null
  >(null);
  const [previewError, setPreviewError] = useState("");
  const [tazaScorePreviewError, setTazaScorePreviewError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isTazaScorePreviewing, setIsTazaScorePreviewing] = useState(false);
  const errors = useMemo(
    () => ({ ...fieldErrors, ...localErrors }),
    [fieldErrors, localErrors],
  );

  useEffect(() => {
    setValues(initialValues);
    setImageFile(null);
    setPreview(null);
    setTazaScorePreview(null);
    setPreviewError("");
    setTazaScorePreviewError("");
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

  async function handlePreviewOfficialNutriScore() {
    if (!onPreviewOfficialNutriScore || isPreviewing) {
      return;
    }

    setIsPreviewing(true);
    setPreview(null);
    setPreviewError("");

    try {
      const result = await onPreviewOfficialNutriScore(
        formValuesToPayload(values),
      );
      setPreview(result);
    } catch (error) {
      setPreviewError(readPreviewError(error));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handlePreviewTazaScore() {
    if (!onPreviewTazaScore || isTazaScorePreviewing) {
      return;
    }

    setIsTazaScorePreviewing(true);
    setTazaScorePreview(null);
    setTazaScorePreviewError("");

    try {
      const result = await onPreviewTazaScore(formValuesToPayload(values));
      setTazaScorePreview(result);
    } catch (error) {
      setTazaScorePreviewError(readPreviewError(error));
    } finally {
      setIsTazaScorePreviewing(false);
    }
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

      <section className="form-section technical-section">
        <div>
          <h2>Nutri-Score данные</h2>
          <p className="section-note">
            Technical inputs for the standards-based Nutri-Score preview. Empty
            fields stay unknown. Enter 0 or No only when the package/source
            explicitly supports that value.
          </p>
        </div>
        <div className="form-grid">
          <SelectField
            label="Nutri-Score category"
            value={values.officialNutriScoreCategory}
            onChange={(value) =>
              updateValue("officialNutriScoreCategory", value)
            }
            error={errors.officialNutriScoreCategory}
          >
            {officialNutriScoreCategories.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Fruit / vegetable / legume (%) — leave blank if unknown"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={values.fruitVegetableLegumePercent}
            error={errors.fruitVegetableLegumePercent}
            onChange={(event) =>
              updateValue("fruitVegetableLegumePercent", event.target.value)
            }
          />
          <SelectField
            label="Non-sugar sweeteners — do not infer absence"
            value={values.containsNonSugarSweeteners}
            onChange={(value) =>
              updateValue(
                "containsNonSugarSweeteners",
                value as ProductFormValues["containsNonSugarSweeteners"],
              )
            }
            error={errors.containsNonSugarSweeteners}
          >
            <option value="unknown">Unknown</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </SelectField>
        </div>
        {values.officialNutriScoreCategory === "beverage" ? (
          <p className="section-note">
            For beverages, fruit/vegetable/legume percentage and sweetener
            status are required for an exact standards-based preview. Unknown is
            different from 0% or No.
          </p>
        ) : null}
        <div className="preview-panel">
          <button
            type="button"
            className="secondary-button"
            disabled={!onPreviewOfficialNutriScore || isPreviewing}
            onClick={() => void handlePreviewOfficialNutriScore()}
          >
            {isPreviewing ? "Calculating..." : "Preview Nutri-Score"}
          </button>
          {previewError ? (
            <span className="field-error">{previewError}</span>
          ) : null}
          {preview ? <NutriScorePreview result={preview} /> : null}
        </div>
        <div className="preview-panel">
          <button
            type="button"
            className="secondary-button"
            disabled={!onPreviewTazaScore || isTazaScorePreviewing}
            onClick={() => void handlePreviewTazaScore()}
          >
            {isTazaScorePreviewing ? "Calculating..." : "Preview TazaScore"}
          </button>
          {tazaScorePreviewError ? (
            <span className="field-error">{tazaScorePreviewError}</span>
          ) : null}
          {tazaScorePreview ? (
            <TazaScorePreview result={tazaScorePreview} />
          ) : null}
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

type NutriScorePreviewProps = {
  result: OfficialNutriScorePreviewResponse["data"];
};

function NutriScorePreview({ result }: NutriScorePreviewProps) {
  if (result.status !== "calculated") {
    return (
      <div className="nutri-score-preview" aria-label="Nutri-Score preview">
        <strong>Insufficient data</strong>
        <span>
          Missing:{" "}
          {result.missingFields.length > 0
            ? result.missingFields.join(", ")
            : "unknown"}
        </span>
      </div>
    );
  }

  return (
    <div className="nutri-score-preview" aria-label="Nutri-Score preview">
      <strong>Grade {result.grade}</strong>
      <span>Raw score: {result.rawScore}</span>
      <span>Category: {result.category ?? "unknown"}</span>
    </div>
  );
}

type TazaScorePreviewProps = {
  result: TazaScorePreviewResponse["data"];
};

function TazaScorePreview({ result }: TazaScorePreviewProps) {
  if (result.status !== "calculated") {
    return (
      <div className="nutri-score-preview" aria-label="TazaScore preview">
        <strong>Недостаточно данных</strong>
        <span>
          Missing:{" "}
          {result.missingFields.length > 0
            ? result.missingFields.map(readFieldLabel).join(", ")
            : "unknown"}
        </span>
      </div>
    );
  }

  const safeguardsApplied = result.safeguardsApplied ?? [];
  const missingCriticalFields = result.missingCriticalFields ?? [];

  return (
    <div className="nutri-score-preview" aria-label="TazaScore preview">
      <strong>TazaScore {result.score} / 100</strong>
      <span>Nutri-Score: {result.officialNutriScore.grade ?? "—"}</span>
      <span>
        Nutrition: {result.nutritionComponent.score} /{" "}
        {result.nutritionComponent.maxScore}
      </span>
      <span>
        Ingredients: {result.ingredientComponent.score} /{" "}
        {result.ingredientComponent.maxScore}
      </span>
      <span>Data confidence: {readConfidenceLabel(result.confidence.level)}</span>
      <span>Coverage: {formatCoverage(result.nutritionCoverage)}</span>
      <span>
        Missing critical fields:{" "}
        {missingCriticalFields.length > 0
          ? missingCriticalFields.map(readFieldLabel).join(", ")
          : "none"}
      </span>
      <span>
        Score before safeguards:{" "}
        {formatNullableScore(result.scoreBeforeSafeguard)}
      </span>
      <span>Score cap: {formatNullableScore(result.scoreCap)}</span>
      <span>
        Safeguards applied:{" "}
        {safeguardsApplied.length > 0
          ? safeguardsApplied.map(readSafeguardLabel).join(", ")
          : "none"}
      </span>
      {result.negativeReasons.length > 0 ? (
        <ul className="preview-reasons">
          {result.negativeReasons.map((reason) => (
            <li key={reason}>{readReasonLabel(reason)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatCoverage(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "unknown";
  }

  return `${Math.round(value * 100)}%`;
}

function formatNullableScore(value: number | null | undefined) {
  return typeof value === "number" ? String(value) : "not applied";
}

function readConfidenceLabel(level: TazaScorePreviewResponse["data"]["confidence"]["level"]) {
  if (level === "high") return "High";
  if (level === "medium") return "Medium";
  return "Low";
}

function readSafeguardLabel(safeguard: string) {
  const labels: Record<string, string> = {
    coverage_cap: "Coverage cap",
    missing_critical_negative_cap: "Missing critical nutrients cap",
  };

  return labels[safeguard] ?? safeguard;
}

function readFieldLabel(field: string) {
  const labels: Record<string, string> = {
    energyKcal: "Energy kcal",
    energyKj: "Energy kJ",
    energyKcalOrEnergyKj: "Energy",
    protein: "Protein",
    carbohydrates: "Carbohydrates",
    sugars: "Sugars",
    fat: "Fat",
    saturatedFat: "Saturated fat",
    saturatedFatApproximation: "Saturated fat approximation",
    fiber: "Fiber",
    salt: "Salt",
    fruitVegetableLegumePercent: "Fruit / vegetable / legume %",
    containsNonSugarSweeteners: "Non-sugar sweeteners",
    officialNutriScoreCategory: "Nutri-Score category",
  };

  return labels[field] ?? field;
}

function readReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    "High sugar according to the official nutritional foundation.":
      "Высокое содержание сахара",
    "High energy density according to the official nutritional foundation.":
      "Высокая энергетическая плотность",
    "High salt according to the official nutritional foundation.":
      "Высокое содержание соли",
    "High saturated fat according to the official nutritional foundation.":
      "Высокое содержание насыщенных жиров",
    "Low favorable nutritional components in the official foundation.":
      "Мало положительных нутриционных компонентов",
    "Contains non-sugar sweeteners considered by the beverage Nutri-Score method.":
      "Содержит некалорийные подсластители",
    "Ingredient information is missing or unknown.":
      "Информация о составе отсутствует",
    "Sweetener status is unknown for a beverage.":
      "Неизвестно наличие подсластителей",
    "Product data confidence is low.": "Низкая уверенность в данных",
  };

  return labels[reason] ?? reason;
}

function readPreviewError(error: unknown) {
  if (error instanceof ApiError) {
    const details = Object.entries(error.fieldErrors)
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ");

    return details ? `${error.message}: ${details}` : error.message;
  }

  return error instanceof Error
    ? error.message
    : "Could not calculate Nutri-Score preview";
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
