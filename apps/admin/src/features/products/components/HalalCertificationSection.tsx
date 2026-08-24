import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../../core/errors/api-error";
import { TextField, SelectField } from "../../../shared/components/FormField";
import type {
  HalalCertificationPayload,
  HalalCertificationRecordDto,
  HalalCheckDto,
} from "../types";

type HalalCertificationSectionProps = {
  halalCheck: HalalCheckDto;
  isEditable?: boolean;
  isSaving?: boolean;
  onSave?: (payload: HalalCertificationPayload) => Promise<void>;
  onClear?: () => Promise<void>;
};

type HalalCertificationFormValues = {
  status: HalalCertificationPayload["status"];
  issuer: string;
  certificateNumber: string;
  validUntil: string;
  source: string;
  evidenceUrl: string;
  verified: boolean;
};

type FormErrors = Partial<Record<keyof HalalCertificationFormValues, string>>;

export function HalalCertificationSection({
  halalCheck,
  isEditable = false,
  isSaving = false,
  onSave,
  onClear,
}: HalalCertificationSectionProps) {
  const currentRecord = halalCheck.certification.records[0] ?? null;
  const [values, setValues] = useState(() => valuesFromRecord(currentRecord));
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [technicalError, setTechnicalError] = useState("");
  const hasConflict = halalCheck.reasons.includes("CERTIFICATION_CONFLICT");
  const isExpired = halalCheck.certification.status === "expired";
  const screeningSignals = halalCheck.ingredientScreening.matchedSignals;

  useEffect(() => {
    setValues(valuesFromRecord(currentRecord));
    setErrors({});
    setMessage("");
    setTechnicalError("");
  }, [currentRecord]);

  function updateValue(name: keyof HalalCertificationFormValues, value: string) {
    setValues((current) => {
      if (name === "status") {
        return {
          ...current,
          status: value as HalalCertificationPayload["status"],
          verified: value === "verified",
        };
      }

      return { ...current, [name]: value };
    });
  }

  function updateVerified(verified: boolean) {
    setValues((current) => ({
      ...current,
      verified,
      status: verified ? "verified" : current.status === "verified" ? "unverified" : current.status,
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!onSave) return;

    const validationErrors = validate(values);
    setErrors(validationErrors);
    setMessage("");
    setTechnicalError("");

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const payload = valuesToPayload(values, currentRecord);
    const isNewVerification =
      payload.status === "verified" && currentRecord?.status !== "verified";

    if (
      isNewVerification &&
      !window.confirm(
        "Подтвердить halal-сертификацию?\n\nУбедитесь, что сертификат относится именно к этому продукту и является действующим.",
      )
    ) {
      return;
    }

    try {
      await onSave(payload);
      setMessage("Certification saved");
    } catch (error) {
      setTechnicalError(readError(error, "Could not save certification"));
    }
  }

  async function handleClear() {
    if (!onClear) return;

    setMessage("");
    setTechnicalError("");

    if (!window.confirm("Удалить данные о сертификации?")) {
      return;
    }

    try {
      await onClear();
      setMessage("Certification cleared");
    } catch (error) {
      setTechnicalError(readError(error, "Could not clear certification"));
    }
  }

  return (
    <section className="form-section halal-admin-section">
      <div>
        <p className="eyebrow">Product-specific certification</p>
        <h2>Halal Check</h2>
        <p className="section-note">
          Certification applies to this product record only. It is not
          propagated to canonical family members and does not affect TazaScore.
        </p>
      </div>

      <div className="halal-summary-grid">
        <StatusBlock
          label="Ingredient screening"
          value={readScreeningLabel(halalCheck.ingredientScreening.status)}
        />
        <StatusBlock
          label="Certification"
          value={readCertificationStatusLabel(halalCheck.certification.status)}
        />
        <StatusBlock
          label="Derived result"
          value={readHalalStatusLabel(halalCheck.status)}
        />
      </div>

      {isExpired ? (
        <div className="alert warning">Срок сертификата истёк</div>
      ) : null}

      {hasConflict ? (
        <div className="alert warning">
          <strong>Обнаружено противоречие</strong>
          <p>
            Сертификат отмечен как подтверждённый, но в составе найден
            high-confidence запрещённый ингредиент. Проверьте данные продукта и
            сертификат.
          </p>
        </div>
      ) : null}

      <div>
        <h3>Ingredient reasons</h3>
        {screeningSignals.length > 0 ? (
          <ul className="halal-reason-list">
            {screeningSignals.map((signal) => (
              <li key={`${signal.ruleId}-${signal.matchedText}`}>
                {readReasonLabel(signal.reasonCode, signal.matchedText)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="section-note">
            {halalCheck.ingredientScreening.status === "clear"
              ? "По доступному составу запрещённые ингредиенты не обнаружены."
              : "No matched ingredient signals."}
          </p>
        )}
      </div>

      {isEditable ? (
        <form className="halal-certification-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <SelectField
              label="Certification status"
              value={values.status}
              error={errors.status}
              onChange={(value) => updateValue("status", value)}
            >
              <option value="unverified">Not verified</option>
              <option value="verified">Verified</option>
              <option value="expired">Expired</option>
            </SelectField>
            <TextField
              label="Issuer"
              value={values.issuer}
              error={errors.issuer}
              onChange={(event) => updateValue("issuer", event.target.value)}
            />
            <TextField
              label="Certificate number"
              value={values.certificateNumber}
              error={errors.certificateNumber}
              onChange={(event) =>
                updateValue("certificateNumber", event.target.value)
              }
            />
            <TextField
              label="Valid until"
              type="date"
              value={values.validUntil}
              error={errors.validUntil}
              onChange={(event) =>
                updateValue("validUntil", event.target.value)
              }
            />
            <TextField
              label="Evidence / source"
              value={values.source}
              error={errors.source}
              onChange={(event) => updateValue("source", event.target.value)}
            />
            <TextField
              label="Evidence URL"
              type="url"
              value={values.evidenceUrl}
              error={errors.evidenceUrl}
              onChange={(event) =>
                updateValue("evidenceUrl", event.target.value)
              }
            />
          </div>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={values.verified}
              onChange={(event) => updateVerified(event.target.checked)}
            />
            <span>
              Verified by TazaScan admin after reviewing certification evidence
            </span>
          </label>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save certification"}
            </button>
            {currentRecord ? (
              <button
                type="button"
                className="ghost-button danger"
                disabled={isSaving}
                onClick={() => void handleClear()}
              >
                Clear certification
              </button>
            ) : null}
          </div>
          {message ? <span className="success-message">{message}</span> : null}
          {technicalError ? (
            <span className="field-error">{technicalError}</span>
          ) : null}
        </form>
      ) : (
        <CertificationReadOnly record={currentRecord} />
      )}
    </section>
  );
}

function StatusBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="halal-status-block">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CertificationReadOnly({
  record,
}: {
  record: HalalCertificationRecordDto | null;
}) {
  if (!record) {
    return <p className="section-note">No certification record stored.</p>;
  }

  return (
    <dl className="nutrition-grid">
      <div>
        <dt>Issuer</dt>
        <dd>{record.issuer}</dd>
      </div>
      <div>
        <dt>Certificate number</dt>
        <dd>{record.certificateNumber ?? "-"}</dd>
      </div>
      <div>
        <dt>Valid until</dt>
        <dd>{formatDateOnly(record.validUntil)}</dd>
      </div>
      <div>
        <dt>Evidence</dt>
        <dd>{record.evidenceUrl ?? record.source ?? "-"}</dd>
      </div>
    </dl>
  );
}

function valuesFromRecord(
  record: HalalCertificationRecordDto | null,
): HalalCertificationFormValues {
  return {
    status: record?.status ?? "unverified",
    issuer: record?.issuer ?? "",
    certificateNumber: record?.certificateNumber ?? "",
    validUntil: toDateInputValue(record?.validUntil ?? null),
    source: record?.source ?? "",
    evidenceUrl: record?.evidenceUrl ?? "",
    verified: record?.status === "verified",
  };
}

function valuesToPayload(
  values: HalalCertificationFormValues,
  currentRecord: HalalCertificationRecordDto | null,
): HalalCertificationPayload {
  const status = values.verified ? "verified" : values.status;

  return {
    status,
    issuer: values.issuer.trim(),
    certificateNumber: optionalText(values.certificateNumber),
    validUntil: values.validUntil ? `${values.validUntil}T00:00:00.000Z` : null,
    source: values.source.trim(),
    evidenceUrl: optionalText(values.evidenceUrl),
    verifiedAt:
      status === "verified"
        ? currentRecord?.verifiedAt ?? new Date().toISOString()
        : null,
  };
}

function validate(values: HalalCertificationFormValues) {
  const errors: FormErrors = {};

  if (!values.issuer.trim()) {
    errors.issuer = "Issuer is required.";
  } else if (values.issuer.trim().length > 160) {
    errors.issuer = "Issuer is too long.";
  }

  if (values.certificateNumber.trim().length > 160) {
    errors.certificateNumber = "Certificate number is too long.";
  }

  if (!values.source.trim()) {
    errors.source = "Evidence/source is required.";
  } else if (values.source.trim().length > 240) {
    errors.source = "Evidence/source is too long.";
  }

  if (values.evidenceUrl.trim()) {
    try {
      new URL(values.evidenceUrl.trim());
    } catch {
      errors.evidenceUrl = "Enter a valid URL.";
    }
  }

  if (values.validUntil && Number.isNaN(Date.parse(values.validUntil))) {
    errors.validUntil = "Enter a valid date.";
  }

  return errors;
}

function readHalalStatusLabel(status: HalalCheckDto["status"]) {
  const labels: Record<HalalCheckDto["status"], string> = {
    halal_confirmed: "Halal confirmed",
    screening_clear: "Screening clear",
    non_halal: "Non-halal ingredient detected",
    review_required: "Review required",
    insufficient_data: "Insufficient data",
  };

  return labels[status];
}

function readScreeningLabel(status: HalalCheckDto["ingredientScreening"]["status"]) {
  const labels: Record<HalalCheckDto["ingredientScreening"]["status"], string> = {
    clear: "Clear",
    review_required: "Review required",
    non_halal_detected: "Explicit prohibited ingredient",
    insufficient_data: "Insufficient data",
  };

  return labels[status];
}

function readCertificationStatusLabel(status: HalalCheckDto["certification"]["status"]) {
  const labels: Record<HalalCheckDto["certification"]["status"], string> = {
    verified: "Verified",
    not_verified: "Not verified",
    expired: "Expired",
    conflict: "Conflict",
    unknown: "Unknown",
  };

  return labels[status];
}

function readReasonLabel(code: string, matchedText: string) {
  const suffix = matchedText.trim() ? ` — ${matchedText.trim()}` : "";
  const labels: Record<string, string> = {
    PORK_DETECTED: "Свинина явно указана в составе",
    PORK_FAT_DETECTED: "Свиной жир явно указан в составе",
    PORCINE_GELATIN_DETECTED: "Свиной желатин явно указан в составе",
    GELATIN_SOURCE_UNKNOWN: "Желатин — источник происхождения не указан",
    CARMINE_E120_DETECTED: "Кармин (E120) — требует дополнительной проверки",
    ALCOHOL_DETECTED: "Спирт/этанол указан в составе",
    ALCOHOL_BASED_FLAVOURING_DETECTED:
      "Ароматизатор на спиртовой основе требует проверки",
    ANIMAL_RENNET_SOURCE_UNKNOWN:
      "Сычужный фермент — источник происхождения не указан",
    ANIMAL_ENZYMES_SOURCE_UNKNOWN:
      "Ферменты животного происхождения требуют проверки",
    E471_SOURCE_UNKNOWN: "E471 — происхождение не указано",
    E472_SOURCE_UNKNOWN: "E472 — происхождение не указано",
    ANIMAL_FAT_SOURCE_UNKNOWN: "Животный жир — вид животного не указан",
    BLOOD_DETECTED: "Ингредиент на основе крови указан в составе",
    CERTIFICATION_CONFLICT: "Обнаружено противоречие сертификации и состава",
    INGREDIENTS_MISSING: "Недостаточно данных о составе",
  };

  return `${labels[code] ?? "Additional review note"}${suffix}`;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatDateOnly(value: string | null) {
  return value ? value.slice(0, 10) : "-";
}

function readError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    const details = Object.entries(error.fieldErrors)
      .map(([field, message]) => `${field}: ${message}`)
      .join("; ");

    return details ? `${error.message}: ${details}` : error.message;
  }

  return error instanceof Error ? error.message : fallback;
}
