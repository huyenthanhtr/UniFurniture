import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of, timeout } from 'rxjs';

interface ApiListResponse<T> {
  page: number;
  limit: number;
  total: number;
  items: T[];
}

interface ProductDocument {
  _id: string;
  name: string;
  thumbnail?: string;
  min_price?: number;
  compare_at_price?: number;
  sold?: number;
  sku?: string;
  description?: string;
  short_description?: string;
  size?: unknown;
  material?: unknown;
  warranty_months?: number;
}

interface ProductImageDocument {
  _id: string;
  product_id?: string;
  image_url?: string;
  is_primary?: boolean;
  sort_order?: number;
}

interface ProductVariantDocument {
  _id: string;
  product_id?: string;
  sku?: string;
  color?: string;
  price?: number;
  compare_at_price?: number;
}

export interface ProductListItem {
  id: string;
  name: string;
  price: number | null;
  originalPrice: number | null;
  imageUrl: string;
  discountBadge: string | null;
  reviewsCount: number;
  soldCount: number;
  colors: string[];
}

export interface ProductListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: ProductListItem[];
}

export interface ProductDetailData {
  id: string;
  name: string;
  sku: string;
  price: number | null;
  originalPrice: number | null;
  shortDescription: string;
  description: string;
  sizeText: string;
  materialText: string;
  warrantyMonths: number | null;
  colors: string[];
  images: string[];
}

const FALLBACK_IMAGE_URL =
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=900';

@Injectable({ providedIn: 'root' })
export class ProductDataService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:3000/api';

  getProducts(page = 1, limit = 24): Observable<ProductListResponse> {
    return this.http
      .get<ApiListResponse<ProductDocument>>(`${this.apiBaseUrl}/products`, {
        params: { page: String(page), limit: String(limit), sort: '-createdAt' },
      })
      .pipe(
        timeout(15000),
        map((response) => {
          const items = (response.items || []).map((product) => {
            const price = this.toNullableNumber(product.min_price);
            const originalPrice = this.toNullableNumber(product.compare_at_price);

            return {
              id: product._id,
              name: product.name || 'San pham',
              price,
              originalPrice,
              imageUrl: product.thumbnail?.trim() || FALLBACK_IMAGE_URL,
              discountBadge: this.getDiscountBadge(price, originalPrice),
              reviewsCount: 0,
              soldCount: this.toNullableNumber(product.sold) ?? 0,
              colors: [],
            };
          });

          return {
            page: response.page || page,
            limit: response.limit || limit,
            total: response.total,
            totalPages: Math.max(Math.ceil(response.total / (response.limit || limit)), 1),
            items,
          };
        }),
      );
  }

  getProductList(limit = 24): Observable<ProductListItem[]> {
    return this.getProducts(1, limit).pipe(map((response) => response.items));
  }

  getProductDetail(productId: string): Observable<ProductDetailData> {
    return forkJoin({
      product: this.http
        .get<ProductDocument>(`${this.apiBaseUrl}/products/${productId}`)
        .pipe(timeout(15000)),
      images: this.http
        .get<ApiListResponse<ProductImageDocument>>(`${this.apiBaseUrl}/product-images`, {
          params: { product_id: productId, limit: '200', sort: 'sort_order' },
        })
        .pipe(
          timeout(15000),
          catchError(() => of(this.emptyListResponse<ProductImageDocument>())),
        ),
      variants: this.http
        .get<ApiListResponse<ProductVariantDocument>>(`${this.apiBaseUrl}/product-variants`, {
          params: { product_id: productId, limit: '200', sort: 'price' },
        })
        .pipe(
          timeout(15000),
          catchError(() => of(this.emptyListResponse<ProductVariantDocument>())),
        ),
    }).pipe(
      map(({ product, images, variants }) => {
        const preferredVariant = this.pickPreferredVariant(variants.items);
        const imageUrls = this.sortImages(images.items)
          .map((image) => image.image_url?.trim() || '')
          .filter((imageUrl) => imageUrl.length > 0);
        const uniqueImageUrls = Array.from(new Set(imageUrls));

        return {
          id: product._id,
          name: product.name || 'San pham',
          sku: preferredVariant?.sku?.trim() || product.sku?.trim() || '',
          price: this.toNullableNumber(preferredVariant?.price) ?? this.toNullableNumber(product.min_price),
          originalPrice:
            this.toNullableNumber(preferredVariant?.compare_at_price) ??
            this.toNullableNumber(product.compare_at_price),
          shortDescription: product.short_description || '',
          description: product.description || '',
          sizeText: this.valueToSizeText(product.size),
          materialText: this.valueToText(product.material),
          warrantyMonths: this.toNullableNumber(product.warranty_months),
          colors: this.extractColors(variants.items),
          images: uniqueImageUrls.length > 0 ? uniqueImageUrls : [product.thumbnail?.trim() || FALLBACK_IMAGE_URL],
        };
      }),
    );
  }

  private emptyListResponse<T>(): ApiListResponse<T> {
    return { page: 1, limit: 0, total: 0, items: [] };
  }

  private pickPreferredVariant(variants: ProductVariantDocument[]): ProductVariantDocument | null {
    if (!variants.length) {
      return null;
    }

    const pricedVariants = variants.filter((variant) => typeof variant.price === 'number');
    if (!pricedVariants.length) {
      return variants[0];
    }

    return pricedVariants.reduce((selected, current) => {
      if ((selected.price ?? Number.MAX_SAFE_INTEGER) <= (current.price ?? Number.MAX_SAFE_INTEGER)) {
        return selected;
      }
      return current;
    });
  }

  private sortImages(images: ProductImageDocument[]): ProductImageDocument[] {
    return [...images].sort((left, right) => {
      if (Boolean(left.is_primary) !== Boolean(right.is_primary)) {
        return left.is_primary ? -1 : 1;
      }
      return (left.sort_order ?? Number.MAX_SAFE_INTEGER) - (right.sort_order ?? Number.MAX_SAFE_INTEGER);
    });
  }

  private extractColors(variants: ProductVariantDocument[]): string[] {
    const colors = variants
      .map((variant) => variant.color?.trim() || '')
      .filter((color) => color.length > 0);
    return Array.from(new Set(colors));
  }

  private getDiscountBadge(price: number | null, originalPrice: number | null): string | null {
    if (price === null || originalPrice === null || originalPrice <= price) {
      return null;
    }

    const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
    return discountPercent > 0 ? `-${discountPercent}%` : null;
  }

  private toNullableNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private valueToText(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(' x ');
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, itemValue]) => itemValue !== null && itemValue !== undefined && String(itemValue).trim() !== '')
        .map(([key, itemValue]) => `${key}: ${String(itemValue)}`);
      return entries.join(' | ');
    }

    return '';
  }

  private valueToSizeText(value: unknown): string {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const objectValue = value as Record<string, unknown>;
      const dimensions = objectValue['dimensions'];
      if (typeof dimensions === 'string' && dimensions.trim().length > 0) {
        return dimensions.trim();
      }
    }

    return this.valueToText(value);
  }
}
