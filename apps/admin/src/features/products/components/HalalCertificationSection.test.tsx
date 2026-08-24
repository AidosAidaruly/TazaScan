import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../../../test/test-utils";
import type { HalalCheckDto } from "../types";
import { HalalCertificationSection } from "./HalalCertificationSection";

const clearHalalCheck: HalalCheckDto = {
  status: "screening_clear",
  reasons: ["NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED"],
  matchedSignals: [],
  ingredientScreening: {
    status: "clear",
    reasons: ["NO_ISSUES_DETECTED_BUT_NOT_CONFIRMED"],
    matchedSignals: [],
  },
  certification: {
    status: "not_verified",
    records: [],
  },
  dataCoverage: {
    ingredientsAvailable: true,
    authoritativeIngredientSource: true,
    generatedTranslationUsedOnlyAsAssistance: false,
  },
  methodology: "halal-check-v1.2",
};

describe("HalalCertificationSection", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders current Halal Check summary without raw enums", () => {
    renderWithRouter(<HalalCertificationSection halalCheck={clearHalalCheck} />);

    expect(screen.getByText("Halal Check")).toBeInTheDocument();
    expect(screen.getByText("Ingredient screening")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
    expect(screen.getByText("Not verified")).toBeInTheDocument();
    expect(screen.getByText("Screening clear")).toBeInTheDocument();
    expect(screen.queryByText("screening_clear")).not.toBeInTheDocument();
  });

  it("renders matched ingredient reasons", () => {
    renderWithRouter(
      <HalalCertificationSection
        halalCheck={{
          ...clearHalalCheck,
          status: "review_required",
          ingredientScreening: {
            status: "review_required",
            reasons: ["GELATIN_SOURCE_UNKNOWN"],
            matchedSignals: [
              {
                ruleId: "gelatin",
                reasonCode: "GELATIN_SOURCE_UNKNOWN",
                severity: "review_required",
                matchedText: "gelatin",
                sourceKind: "ingredient_list",
              },
            ],
          },
        }}
      />,
    );

    expect(
      screen.getByText("Желатин — источник происхождения не указан — gelatin"),
    ).toBeInTheDocument();
  });

  it("loads existing certification values and saves edited fields", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    renderWithRouter(
      <HalalCertificationSection
        halalCheck={{
          ...clearHalalCheck,
          certification: {
            status: "not_verified",
            records: [
              {
                status: "unverified",
                issuer: "Old issuer",
                certificateNumber: "OLD-1",
                validUntil: "2027-01-01T00:00:00.000Z",
                source: "Old source",
                evidenceUrl: "https://example.com/old",
                verifiedAt: null,
              },
            ],
          },
        }}
        isEditable
        onSave={onSave}
      />,
    );

    await user.clear(screen.getByLabelText("Issuer"));
    await user.type(screen.getByLabelText("Issuer"), "Trusted halal body");
    await user.clear(screen.getByLabelText("Certificate number"));
    await user.type(screen.getByLabelText("Certificate number"), "HAL-123");
    await user.clear(screen.getByLabelText("Evidence / source"));
    await user.type(
      screen.getByLabelText("Evidence / source"),
      "Admin-reviewed certificate",
    );
    await user.clear(screen.getByLabelText("Evidence URL"));
    await user.type(
      screen.getByLabelText("Evidence URL"),
      "https://example.com/cert",
    );
    await user.click(
      screen.getByLabelText(
        "Verified by TazaScan admin after reviewing certification evidence",
      ),
    );
    await user.click(
      screen.getByRole("button", { name: "Save certification" }),
    );

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Подтвердить halal-сертификацию?"),
    );
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "verified",
        issuer: "Trusted halal body",
        certificateNumber: "HAL-123",
        source: "Admin-reviewed certificate",
        evidenceUrl: "https://example.com/cert",
      }),
    );
  });

  it("shows expired and conflict warnings", () => {
    const { rerender } = renderWithRouter(
      <HalalCertificationSection
        halalCheck={{
          ...clearHalalCheck,
          certification: {
            status: "expired",
            records: [
              {
                status: "expired",
                issuer: "Trusted halal body",
                certificateNumber: null,
                validUntil: "2025-01-01T00:00:00.000Z",
                source: "Certificate",
                evidenceUrl: null,
                verifiedAt: "2024-01-01T00:00:00.000Z",
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText("Срок сертификата истёк")).toBeInTheDocument();

    rerender(
      <HalalCertificationSection
        halalCheck={{
          ...clearHalalCheck,
          status: "review_required",
          reasons: ["CERTIFICATION_CONFLICT"],
          certification: {
            status: "conflict",
            records: [
              {
                status: "verified",
                issuer: "Trusted halal body",
                certificateNumber: null,
                validUntil: "2025-01-01T00:00:00.000Z",
                source: "Certificate",
                evidenceUrl: null,
                verifiedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByText("Обнаружено противоречие")).toBeInTheDocument();
  });

  it("clears certification after confirmation", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn().mockResolvedValue(undefined);

    renderWithRouter(
      <HalalCertificationSection
        halalCheck={{
          ...clearHalalCheck,
          certification: {
            status: "verified",
            records: [
              {
                status: "verified",
                issuer: "Trusted halal body",
                certificateNumber: null,
                validUntil: null,
                source: "Certificate",
                evidenceUrl: null,
                verifiedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        }}
        isEditable
        onClear={onClear}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear certification" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "Удалить данные о сертификации?",
    );
    expect(onClear).toHaveBeenCalled();
  });

  it("renders technical errors safely", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("Backend unavailable"));

    renderWithRouter(
      <HalalCertificationSection
        halalCheck={clearHalalCheck}
        isEditable
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText("Issuer"), "Trusted halal body");
    await user.type(screen.getByLabelText("Evidence / source"), "Certificate");
    await user.click(
      screen.getByRole("button", { name: "Save certification" }),
    );

    expect(await screen.findByText("Backend unavailable")).toBeInTheDocument();
  });
});
