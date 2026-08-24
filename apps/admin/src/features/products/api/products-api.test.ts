import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../../../core/api/api-client";
import { createMockResponse } from "../../../test/test-utils";
import { ProductsApi } from "./products-api";

const api = () => new ProductsApi(new ApiClient("http://localhost:4000"));

describe("ProductsApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads products with search and pagination", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        await createMockResponse({
          data: [],
          pagination: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
        }),
      );

    await api().list({
      page: 2,
      pageSize: 10,
      name: "cola",
      brand: "coca",
      barcode: "544",
    });

    expect(fetchSpy.mock.calls[0]?.[0]).toContain("page=2");
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("name=cola");
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("brand=coca");
    expect(fetchSpy.mock.calls[0]?.[0]).toContain("barcode=544");
  });

  it("creates a product with bearer token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        await createMockResponse({ data: { id: "product-id" } }),
      );

    await api().create(
      {
        barcode: "5449000000996",
        name: "Coca-Cola",
        category: "Soft Drinks",
        ingredients: [],
        nutritionFacts: {
          servingType: "per100ml",
          energyKcal: 42,
          protein: 0,
          carbohydrates: 10.6,
          sugars: 10.6,
          fat: 0,
          saturatedFat: 0,
          fiber: null,
          salt: 0,
        },
        dataStatus: "verified",
      },
      "token",
    );

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token");
  });

  it("updates a product with bearer token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        await createMockResponse({ data: { id: "product-id" } }),
      );

    await api().update("product-id", { name: "Updated product" }, "token");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "http://localhost:4000/products/product-id",
    );
    expect(init.method).toBe("PUT");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token");
  });

  it("previews official Nutri-Score with bearer token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        await createMockResponse({
          data: {
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
          },
        }),
      );

    await api().previewOfficialNutriScore(
      {
        barcode: "5449000000996",
        name: "Coca-Cola",
        category: "Soft Drinks",
        ingredients: [],
        nutritionFacts: {
          servingType: "per100ml",
          energyKcal: 42,
          protein: 0,
          carbohydrates: 10.6,
          sugars: 10.6,
          fat: 0,
          saturatedFat: 0,
          fiber: null,
          salt: 0,
        },
        officialNutriScoreCategory: "beverage",
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false,
        dataStatus: "verified",
      },
      "token",
    );

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "http://localhost:4000/products/nutri-score-preview",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token");
  });

  it("previews TazaScore with bearer token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        await createMockResponse({
          data: {
            score: 27,
            status: "calculated",
            nutritionComponent: { score: 17, maxScore: 90 },
            ingredientComponent: { score: 10, maxScore: 10 },
            confidence: { level: "high" },
            reasonCodes: [],
            positiveReasons: [],
            negativeReasons: [],
            missingFields: [],
            warnings: [],
            methodologyVersion: "taza-score-v1",
            officialNutriScore: {
              status: "calculated",
              rawScore: 13,
              grade: "E",
            },
          },
        }),
      );

    await api().previewTazaScore(
      {
        barcode: "5449000000996",
        name: "Coca-Cola",
        category: "Soft Drinks",
        ingredients: [],
        nutritionFacts: {
          servingType: "per100ml",
          energyKcal: 42,
          protein: 0,
          carbohydrates: 10.6,
          sugars: 10.6,
          fat: 0,
          saturatedFat: 0,
          fiber: 0,
          salt: 0,
        },
        officialNutriScoreCategory: "beverage",
        fruitVegetableLegumePercent: 0,
        containsNonSugarSweeteners: false,
        dataStatus: "verified",
      },
      "token",
    );

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "http://localhost:4000/products/taza-score-preview",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token");
  });

  it("deletes a product with bearer token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(await createMockResponse({}, 204));

    await api().delete("product-id", "token");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("DELETE");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token");
  });

  it("uploads product image with multipart form data", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        await createMockResponse({
          data: { id: "product-id", imageUrl: "/uploads/products/image.webp" },
        }),
      );
    const image = new File(["image"], "coca-cola.png", { type: "image/png" });

    await api().uploadImage("product-id", image, "token");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "http://localhost:4000/products/product-id/image",
    );
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token");
    expect((init.headers as Headers).get("Content-Type")).toBeNull();
  });

  it("removes product image with bearer token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        await createMockResponse({
          data: { id: "product-id", imageUrl: null },
        }),
      );

    await api().removeImage("product-id", "token");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "http://localhost:4000/products/product-id/image",
    );
    expect(init.method).toBe("DELETE");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token");
  });

  it("updates halal certification with bearer token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        await createMockResponse({
          data: { id: "product-id" },
        }),
      );

    await api().updateHalalCertification(
      "product-id",
      {
        status: "verified",
        issuer: "Trusted halal body",
        certificateNumber: "HAL-123",
        validUntil: "2027-01-01T00:00:00.000Z",
        source: "Admin-reviewed certificate",
        evidenceUrl: "https://example.com/cert/HAL-123",
        verifiedAt: "2026-08-23T00:00:00.000Z",
      },
      "token",
    );

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "http://localhost:4000/products/product-id/halal-certification",
    );
    expect(init.method).toBe("PUT");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token");
    expect(JSON.parse(init.body as string)).toMatchObject({
      status: "verified",
      issuer: "Trusted halal body",
    });
  });

  it("clears halal certification with bearer token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        await createMockResponse({
          data: { id: "product-id" },
        }),
      );

    await api().clearHalalCertification("product-id", "token");

    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "http://localhost:4000/products/product-id/halal-certification",
    );
    expect(init.method).toBe("DELETE");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer token");
  });

  it("surfaces duplicate barcode errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      await createMockResponse(
        { error: { message: "Barcode already exists" } },
        409,
      ),
    );

    await expect(
      api().create(
        {
          barcode: "5449000000996",
          name: "Coca-Cola",
          category: "Soft Drinks",
          ingredients: [],
          nutritionFacts: {
            servingType: "per100ml",
            energyKcal: 42,
            protein: 0,
            carbohydrates: 10.6,
            sugars: 10.6,
            fat: 0,
            saturatedFat: 0,
            fiber: null,
            salt: 0,
          },
          dataStatus: "verified",
        },
        "token",
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Barcode already exists",
    });
  });
});
