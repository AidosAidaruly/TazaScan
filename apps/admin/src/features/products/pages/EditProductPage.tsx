import { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { ApiClient } from "../../../core/api/api-client";
import { useAuth } from "../../../core/auth/use-auth";
import { ApiError, type FieldErrors } from "../../../core/errors/api-error";
import { PageLoader } from "../../../shared/components/PageLoader";
import { ProductsApi } from "../api/products-api";
import { HalalCertificationSection } from "../components/HalalCertificationSection";
import { ProductForm } from "../components/ProductForm";
import type { HalalCertificationPayload, ProductDto, ProductPayload } from "../types";
import {
  productToFormValues,
  type ProductFormValues,
} from "../utils/product-form";

const productsApi = new ProductsApi(new ApiClient());

export function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { token, logout } = useAuth();
  const history = useHistory();
  const [initialValues, setInitialValues] = useState<ProductFormValues | null>(
    null,
  );
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImageRemoving, setIsImageRemoving] = useState(false);
  const [isHalalSaving, setIsHalalSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      if (!id) {
        return;
      }

      try {
        const response = await productsApi.findById(id);

        if (isMounted) {
          setProduct(response.data);
          setInitialValues(productToFormValues(response.data));
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "Could not load product",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProduct();

    return () => {
      isMounted = false;
    };
  }, [id]);

  async function refreshProduct() {
    if (!id) {
      return;
    }

    const response = await productsApi.findById(id);
    setProduct(response.data);
    setInitialValues(productToFormValues(response.data));
  }

  async function handleSubmit(payload: ProductPayload, imageFile: File | null) {
    if (!id || !token || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setFieldErrors({});

    try {
      const response = await productsApi.update(id, payload, token);
      if (imageFile) {
        const imageResponse = await productsApi.uploadImage(
          response.data.id,
          imageFile,
          token,
        );
        history.push(`/products/${imageResponse.data.id}`);
        return;
      }

      history.push(`/products/${response.data.id}`);
    } catch (updateError) {
      if (updateError instanceof ApiError && updateError.statusCode === 401) {
        logout();
        history.replace("/login");
        return;
      }

      if (updateError instanceof ApiError) {
        setError(updateError.message);
        setFieldErrors(updateError.fieldErrors);
      } else {
        setError("Could not update product");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveImage() {
    if (!id || !token || isImageRemoving) {
      return;
    }

    setIsImageRemoving(true);
    setError("");

    try {
      const response = await productsApi.removeImage(id, token);
      setProduct(response.data);
      setInitialValues(productToFormValues(response.data));
    } catch (removeError) {
      if (removeError instanceof ApiError && removeError.statusCode === 401) {
        logout();
        history.replace("/login");
        return;
      }

      setError(
        removeError instanceof ApiError
          ? removeError.message
          : "Could not remove image",
      );
    } finally {
      setIsImageRemoving(false);
    }
  }

  async function handlePreviewOfficialNutriScore(payload: ProductPayload) {
    if (!token) {
      throw new Error("Admin session expired");
    }

    const response = await productsApi.previewOfficialNutriScore(
      payload,
      token,
    );
    return response.data;
  }

  async function handlePreviewTazaScore(payload: ProductPayload) {
    if (!token) {
      throw new Error("Admin session expired");
    }

    const response = await productsApi.previewTazaScore(payload, token);
    return response.data;
  }

  async function handleSaveHalalCertification(
    payload: HalalCertificationPayload,
  ) {
    if (!id || !token || isHalalSaving) {
      return;
    }

    setIsHalalSaving(true);
    setError("");

    try {
      await productsApi.updateHalalCertification(id, payload, token);
      await refreshProduct();
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.statusCode === 401) {
        logout();
        history.replace("/login");
        return;
      }

      throw saveError;
    } finally {
      setIsHalalSaving(false);
    }
  }

  async function handleClearHalalCertification() {
    if (!id || !token || isHalalSaving) {
      return;
    }

    setIsHalalSaving(true);
    setError("");

    try {
      await productsApi.clearHalalCertification(id, token);
      await refreshProduct();
    } catch (clearError) {
      if (clearError instanceof ApiError && clearError.statusCode === 401) {
        logout();
        history.replace("/login");
        return;
      }

      throw clearError;
    } finally {
      setIsHalalSaving(false);
    }
  }

  if (isLoading) {
    return <PageLoader label="Loading product..." />;
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Product Management</p>
          <h1>Edit Product</h1>
        </div>
      </div>
      {error ? <div className="alert error">{error}</div> : null}
      {initialValues ? (
        <>
          {product ? (
            <HalalCertificationSection
              halalCheck={product.halalCheck}
              isEditable
              isSaving={isHalalSaving}
              onSave={handleSaveHalalCertification}
              onClear={handleClearHalalCertification}
            />
          ) : null}
          <ProductForm
            initialValues={initialValues}
            submitLabel="Save changes"
            isSubmitting={isSubmitting}
            isImageRemoving={isImageRemoving}
            fieldErrors={fieldErrors}
            onSubmit={handleSubmit}
            onPreviewOfficialNutriScore={handlePreviewOfficialNutriScore}
            onPreviewTazaScore={handlePreviewTazaScore}
            onRemoveImage={handleRemoveImage}
          />
        </>
      ) : null}
    </section>
  );
}
