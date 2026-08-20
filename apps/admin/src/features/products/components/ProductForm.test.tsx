import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../core/errors/api-error";
import { renderWithRouter } from "../../../test/test-utils";
import { validateProductImageFile } from "../utils/product-image-validation";
import { ProductForm } from "./ProductForm";

describe("ProductForm image upload", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("selects and previews an image", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const image = new File(["image"], "coca-cola.png", { type: "image/png" });

    renderWithRouter(
      <ProductForm
        submitLabel="Save"
        isSubmitting={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [image] },
    });

    expect(screen.getByText("coca-cola.png")).toBeInTheDocument();

    fireEvent.submit(
      screen.getByRole("button", { name: "Save" }).closest("form")!,
    );

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects unsupported image files", () => {
    const image = new File(["exe"], "program.exe", {
      type: "application/x-msdownload",
    });

    expect(validateProductImageFile(image)).toBe(
      "Use JPEG, PNG, or WebP image.",
    );
  });

  it("renders official Nutri-Score controls and previews a calculated score", async () => {
    const user = userEvent.setup();
    const onPreviewOfficialNutriScore = vi.fn().mockResolvedValue({
      rawScore: 13,
      grade: "E",
      status: "calculated",
      reasonCodes: [],
      missingFields: [],
      warnings: [],
      algorithm: "official-nutri-score",
      algorithmVersion: "v2-2023",
      category: "beverage",
      componentPoints: {},
      calculatedAt: "2026-01-01T00:00:00.000Z",
    });

    renderWithRouter(
      <ProductForm
        submitLabel="Save"
        isSubmitting={false}
        onSubmit={vi.fn()}
        onPreviewOfficialNutriScore={onPreviewOfficialNutriScore}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Nutri-Score category"),
      "beverage",
    );
    await user.type(
      screen.getByLabelText("Fruit / vegetable / legume (%) — leave blank if unknown"),
      "0",
    );
    await user.selectOptions(
      screen.getByLabelText("Non-sugar sweeteners — do not infer absence"),
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Preview Nutri-Score" }));

    expect(onPreviewOfficialNutriScore).toHaveBeenCalledWith(
      expect.objectContaining({
        officialNutriScoreCategory: "beverage",
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false,
      }),
    );
    expect(await screen.findByText("Grade E")).toBeInTheDocument();
    expect(screen.getByText("Raw score: 13")).toBeInTheDocument();
  });

  it("shows missing fields from official Nutri-Score preview", async () => {
    const user = userEvent.setup();
    const onPreviewOfficialNutriScore = vi.fn().mockResolvedValue({
      rawScore: null,
      grade: null,
      status: "insufficient_data",
      reasonCodes: [],
      missingFields: ["fruitVegetableLegumePercent"],
      warnings: [],
      algorithm: "official-nutri-score",
      algorithmVersion: "v2-2023",
      category: null,
      componentPoints: null,
      calculatedAt: "2026-01-01T00:00:00.000Z",
    });

    renderWithRouter(
      <ProductForm
        submitLabel="Save"
        isSubmitting={false}
        onSubmit={vi.fn()}
        onPreviewOfficialNutriScore={onPreviewOfficialNutriScore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Preview Nutri-Score" }));

    expect(await screen.findByText("Insufficient data")).toBeInTheDocument();
    expect(screen.getByText("Missing: fruitVegetableLegumePercent")).toBeInTheDocument();
  });

  it("shows backend preview validation details", async () => {
    const user = userEvent.setup();
    const onPreviewOfficialNutriScore = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, "Validation failed", {
          fruitVegetableLegumePercent:
            "Too big: expected number to be <=100",
        }),
      );

    renderWithRouter(
      <ProductForm
        submitLabel="Save"
        isSubmitting={false}
        onSubmit={vi.fn()}
        onPreviewOfficialNutriScore={onPreviewOfficialNutriScore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Preview Nutri-Score" }));

    expect(
      await screen.findByText(
        "Validation failed: fruitVegetableLegumePercent: Too big: expected number to be <=100",
      ),
    ).toBeInTheDocument();
  });

  it("previews TazaScore with breakdown, separate Nutri-Score, and confidence", async () => {
    const user = userEvent.setup();
    const onPreviewTazaScore = vi.fn().mockResolvedValue({
      score: 27,
      status: "calculated",
      nutritionComponent: {
        score: 17,
        maxScore: 90,
        status: "calculated",
        reasonCodes: [],
        missingFields: [],
      },
      ingredientComponent: {
        score: 10,
        maxScore: 10,
        status: "calculated",
        reasonCodes: [],
        missingFields: [],
        additiveCount: 1,
        knownRiskPenalty: 0,
      },
      confidence: {
        score: null,
        maxScore: 0,
        status: "calculated",
        reasonCodes: [],
        missingFields: [],
        level: "high",
        dataStatus: "verified",
      },
      reasonCodes: [],
      positiveReasons: [],
      negativeReasons: [
        "High sugar according to the official nutritional foundation.",
      ],
      missingFields: [],
      warnings: [],
      methodologyVersion: "taza-score-v1",
      officialNutriScore: {
        status: "calculated",
        rawScore: 13,
        grade: "E",
      },
    });

    renderWithRouter(
      <ProductForm
        submitLabel="Save"
        isSubmitting={false}
        onSubmit={vi.fn()}
        onPreviewTazaScore={onPreviewTazaScore}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Nutri-Score category"),
      "beverage",
    );
    await user.type(
      screen.getByLabelText("Fruit / vegetable / legume (%) — leave blank if unknown"),
      "0",
    );
    await user.selectOptions(
      screen.getByLabelText("Non-sugar sweeteners — do not infer absence"),
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Preview TazaScore" }));

    expect(onPreviewTazaScore).toHaveBeenCalledWith(
      expect.objectContaining({
        officialNutriScoreCategory: "beverage",
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false,
      }),
    );
    expect(await screen.findByText("TazaScore 27 / 100")).toBeInTheDocument();
    expect(screen.getByText("Nutri-Score: E")).toBeInTheDocument();
    expect(screen.getByText("Nutrition: 17 / 90")).toBeInTheDocument();
    expect(screen.getByText("Ingredients: 10 / 10")).toBeInTheDocument();
    expect(screen.getByText("Data confidence: High")).toBeInTheDocument();
    expect(screen.getByText("Coverage: unknown")).toBeInTheDocument();
    expect(screen.getByText("Missing critical fields: none")).toBeInTheDocument();
    expect(screen.getByText("Score before safeguards: not applied")).toBeInTheDocument();
    expect(screen.getByText("Score cap: not applied")).toBeInTheDocument();
    expect(screen.getByText("Safeguards applied: none")).toBeInTheDocument();
    expect(screen.getByText("Высокое содержание сахара")).toBeInTheDocument();
  });

  it("shows partial TazaScore diagnostics with missing critical fields and safeguards", async () => {
    const user = userEvent.setup();
    const onPreviewTazaScore = vi.fn().mockResolvedValue({
      score: 28,
      status: "calculated",
      nutritionComponent: {
        score: 79,
        maxScore: 90,
        status: "calculated",
        reasonCodes: ["PARTIAL_NUTRITION_FOUNDATION"],
        missingFields: ["sugars", "salt", "saturatedFat"],
        usedFields: ["energyKcal", "fat", "protein"],
        nutritionCoverage: 0.31,
      },
      ingredientComponent: {
        score: 10,
        maxScore: 10,
        status: "calculated",
        reasonCodes: [],
        missingFields: [],
        additiveCount: 0,
        knownRiskPenalty: 0,
      },
      confidence: {
        score: null,
        maxScore: 0,
        status: "calculated",
        reasonCodes: ["LOW_NUTRITION_COVERAGE"],
        missingFields: [],
        level: "low",
        dataStatus: "verified",
      },
      reasonCodes: [
        "PARTIAL_NUTRITION_FOUNDATION",
        "PARTIAL_SCORE_CAP_APPLIED",
      ],
      positiveReasons: [],
      negativeReasons: [
        "TazaScore was calculated from partial product data.",
      ],
      missingFields: [
        "sugars",
        "salt",
        "saturatedFat",
        "fiber",
        "fruitVegetableLegumePercent",
      ],
      usedFields: ["energyKcal", "fat", "protein"],
      nutritionCoverage: 0.31,
      missingCriticalFields: [
        "sugars",
        "salt",
        "saturatedFatApproximation",
      ],
      scoreBeforeSafeguard: 89,
      scoreCap: 28,
      safeguardsApplied: ["coverage_cap", "missing_critical_negative_cap"],
      warnings: [],
      methodology: "TazaScore",
      methodologyVersion: "taza-score-v1",
      officialNutriScore: {
        status: "insufficient_data",
        rawScore: null,
        grade: null,
      },
    });

    renderWithRouter(
      <ProductForm
        submitLabel="Save"
        isSubmitting={false}
        onSubmit={vi.fn()}
        onPreviewTazaScore={onPreviewTazaScore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Preview TazaScore" }));

    expect(await screen.findByText("TazaScore 28 / 100")).toBeInTheDocument();
    expect(screen.getByText("Nutri-Score: —")).toBeInTheDocument();
    expect(screen.getByText("Data confidence: Low")).toBeInTheDocument();
    expect(screen.getByText("Coverage: 31%")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Missing critical fields: Sugars, Salt, Saturated fat approximation",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Score before safeguards: 89")).toBeInTheDocument();
    expect(screen.getByText("Score cap: 28")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Safeguards applied: Coverage cap, Missing critical nutrients cap",
      ),
    ).toBeInTheDocument();
  });

  it("shows TazaScore insufficient-data state", async () => {
    const user = userEvent.setup();
    const onPreviewTazaScore = vi.fn().mockResolvedValue({
      score: null,
      status: "insufficient_data",
      nutritionComponent: {
        score: null,
        maxScore: 90,
        status: "insufficient_data",
        reasonCodes: [],
        missingFields: ["energyKcalOrEnergyKj"],
      },
      ingredientComponent: {
        score: 8,
        maxScore: 10,
        status: "insufficient_data",
        reasonCodes: [],
        missingFields: [],
        additiveCount: null,
        knownRiskPenalty: 0,
      },
      confidence: {
        score: null,
        maxScore: 0,
        status: "insufficient_data",
        reasonCodes: [],
        missingFields: [],
        level: "medium",
        dataStatus: "unverified",
      },
      reasonCodes: [],
      positiveReasons: [],
      negativeReasons: [],
      missingFields: ["energyKcalOrEnergyKj", "sugars"],
      warnings: [],
      methodologyVersion: "taza-score-v1",
      officialNutriScore: {
        status: "insufficient_data",
        rawScore: null,
        grade: null,
      },
    });

    renderWithRouter(
      <ProductForm
        submitLabel="Save"
        isSubmitting={false}
        onSubmit={vi.fn()}
        onPreviewTazaScore={onPreviewTazaScore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Preview TazaScore" }));

    expect(await screen.findByText("Недостаточно данных")).toBeInTheDocument();
    expect(screen.getByText("Missing: Energy, Sugars")).toBeInTheDocument();
  });

  it("shows backend TazaScore validation details", async () => {
    const user = userEvent.setup();
    const onPreviewTazaScore = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, "Validation failed", {
          officialNutriScoreCategory: "Invalid option",
        }),
      );

    renderWithRouter(
      <ProductForm
        submitLabel="Save"
        isSubmitting={false}
        onSubmit={vi.fn()}
        onPreviewTazaScore={onPreviewTazaScore}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Preview TazaScore" }));

    expect(
      await screen.findByText(
        "Validation failed: officialNutriScoreCategory: Invalid option",
      ),
    ).toBeInTheDocument();
  });
});
