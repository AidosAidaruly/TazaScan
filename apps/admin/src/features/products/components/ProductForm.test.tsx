import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
