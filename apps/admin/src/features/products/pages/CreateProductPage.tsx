import { useState } from "react";
import { useHistory } from "react-router-dom";
import { ApiClient } from "../../../core/api/api-client";
import { useAuth } from "../../../core/auth/use-auth";
import { ApiError, type FieldErrors } from "../../../core/errors/api-error";
import { ProductsApi } from "../api/products-api";
import { ProductForm } from "../components/ProductForm";
import type { ProductPayload } from "../types";

const productsApi = new ProductsApi(new ApiClient());

export function CreateProductPage() {
  const { token, logout } = useAuth();
  const history = useHistory();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdProductId, setCreatedProductId] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  async function handleSubmit(payload: ProductPayload, imageFile: File | null) {
    if (!token || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      const response = await productsApi.create(payload, token);
      setCreatedProductId(response.data.id);

      if (imageFile) {
        try {
          const imageResponse = await productsApi.uploadImage(
            response.data.id,
            imageFile,
            token,
          );
          history.push(`/products/${imageResponse.data.id}`);
          return;
        } catch (uploadError) {
          setPendingImage(imageFile);
          setError(
            uploadError instanceof ApiError
              ? `Product was created, but image upload failed: ${uploadError.message}`
              : "Product was created, but image upload failed.",
          );
          return;
        }
      }

      history.push(`/products/${response.data.id}`);
    } catch (createError) {
      if (createError instanceof ApiError && createError.statusCode === 401) {
        logout();
        history.replace("/login");
        return;
      }

      if (createError instanceof ApiError) {
        setError(createError.message);
        setFieldErrors(createError.fieldErrors);
      } else {
        setError("Could not create product");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function retryImageUpload() {
    if (!token || !createdProductId || !pendingImage || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await productsApi.uploadImage(
        createdProductId,
        pendingImage,
        token,
      );
      setPendingImage(null);
      history.push(`/products/${response.data.id}`);
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : "Could not upload image",
      );
    } finally {
      setIsSubmitting(false);
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
      {pendingImage && createdProductId ? (
        <div className="alert">
          <strong>Product created.</strong> Retry image upload when ready.
          <button
            type="button"
            className="secondary-button"
            disabled={isSubmitting}
            onClick={() => void retryImageUpload()}
          >
            Retry image upload
          </button>
        </div>
      ) : null}
      <ProductForm
        submitLabel="Create product"
        isSubmitting={isSubmitting}
        fieldErrors={fieldErrors}
        onSubmit={handleSubmit}
      />
    </section>
  );
}
