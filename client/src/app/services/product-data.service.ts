import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of, shareReplay, timeout } from 'rxjs';

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
  thumbnail_url?: string;
  min_price?: number;
  compare_at_price?: number;
  sold?: number;
  sku?: string;
  description?: string;
  short_description?: string;
  size?: unknown;
  material?: unknown;
  warranty_months?: number;
  category_id?: string;
  collection_id?: string;
}

interface CategoryDocument {
  _id: string;
  name: string;
  slug: string;
  status?: string;
  image_url?: string;
}

interface CollectionDocument {
  _id: string;
  name: string;
  slug: string;
  status?: string;
  banner_url?: string;
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
  categoryId: string | null;
  collectionId: string | null;
  sizeText: string;
  materialText: string;
}

export interface ProductListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: ProductListItem[];
}

export interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
}

export interface ProductQueryOptions {
  sortBy?: 'createdAt' | 'bestSelling' | 'updatedAt';
  order?: 'asc' | 'desc';
  categoryIds?: string[];
  collectionId?: string;
  search?: string;
  fields?: string;
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
  private categoriesCache$?: Observable<TaxonomyItem[]>;
  private collectionsCache$?: Observable<TaxonomyItem[]>;
  private collectionCategoryLinksCache$?: Observable<Record<string, string[]>>;

  getProducts(page = 1, limit = 24, options: ProductQueryOptions = {}): Observable<ProductListResponse> {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));

    const resolvedSortBy = options.sortBy || 'createdAt';
    const resolvedOrder = options.order || 'desc';
    const sortPrefix = resolvedOrder === 'asc' ? '' : '-';
    const sortField = resolvedSortBy === 'bestSelling' ? 'sold' : resolvedSortBy;
    params = params.set('sort', `${sortPrefix}${sortField}`);

    if (options.collectionId) {
      params = params.set('collection', options.collectionId);
    }

    if (options.categoryIds && options.categoryIds.length > 0) {
      const categoryParam = options.categoryIds.map((value) => value.trim()).filter(Boolean).join(',');
      if (categoryParam) {
        params = params.set('category', categoryParam);
      }
    }

    if (options.search) {
      const keyword = options.search.trim();
      if (keyword) {
        params = params.set('q', keyword);
      }
    }

    const listFields =
      options.fields || 'name,thumbnail,thumbnail_url,min_price,compare_at_price,sold,category_id,collection_id,size,material';
    params = params.set('fields', listFields);

    return this.http
      .get<ApiListResponse<ProductDocument>>(`${this.apiBaseUrl}/products`, { params })
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
              imageUrl: product.thumbnail?.trim() || product.thumbnail_url?.trim() || FALLBACK_IMAGE_URL,
              discountBadge: this.getDiscountBadge(price, originalPrice),
              reviewsCount: 0,
              soldCount: this.toNullableNumber(product.sold) ?? 0,
              colors: [],
              categoryId: product.category_id || null,
              collectionId: product.collection_id || null,
              sizeText: this.valueToSizeText(product.size),
              materialText: this.valueToText(product.material),
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

  getCategories(limit = 300): Observable<TaxonomyItem[]> {
    if (!this.categoriesCache$) {
      this.categoriesCache$ = this.http
        .get<ApiListResponse<CategoryDocument>>(`${this.apiBaseUrl}/categories`, {
          params: { page: '1', limit: String(limit), sort: 'name', status: 'active' },
        })
        .pipe(
          timeout(15000),
          map((response) => (response.items || []).map((item) => this.toTaxonomyItem(item))),
          shareReplay(1),
        );
    }
    return this.categoriesCache$;
  }

  getCollections(limit = 120): Observable<TaxonomyItem[]> {
    if (!this.collectionsCache$) {
      this.collectionsCache$ = this.http
        .get<ApiListResponse<CollectionDocument>>(`${this.apiBaseUrl}/collections`, {
          params: { page: '1', limit: String(limit), sort: 'name', status: 'active' },
        })
        .pipe(
          timeout(15000),
          map((response) => (response.items || []).map((item) => this.toTaxonomyItem(item))),
          shareReplay(1),
        );
    }
    return this.collectionsCache$;
  }

  getCollectionCategoryLinks(limit = 2000): Observable<Record<string, string[]>> {
    if (!this.collectionCategoryLinksCache$) {
      this.collectionCategoryLinksCache$ = this.http
        .get<ApiListResponse<ProductDocument>>(`${this.apiBaseUrl}/products`, {
          params: { page: '1', limit: String(limit), fields: 'collection_id,category_id' },
        })
        .pipe(
          timeout(15000),
          map((response) => {
            const relation = new Map<string, Set<string>>();

            for (const product of response.items || []) {
              const collectionId = String(product.collection_id || '').trim();
              const categoryId = String(product.category_id || '').trim();
              if (!collectionId || !categoryId) {
                continue;
              }

              if (!relation.has(collectionId)) {
                relation.set(collectionId, new Set<string>());
              }
              relation.get(collectionId)?.add(categoryId);
            }

            const normalized: Record<string, string[]> = {};
            for (const [collectionId, categorySet] of relation.entries()) {
              normalized[collectionId] = Array.from(categorySet);
            }
            return normalized;
          }),
          catchError(() => of({})),
          shareReplay(1),
        );
    }
    return this.collectionCategoryLinksCache$;
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

  private toTaxonomyItem(source: CategoryDocument | CollectionDocument): TaxonomyItem {
    const imageUrl =
      'image_url' in source
        ? source.image_url?.trim() || ''
        : 'banner_url' in source
        ? source.banner_url?.trim() || ''
        : '';

    return {
      id: source._id,
      name: source.name?.trim() || '',
      slug: source.slug?.trim() || '',
      imageUrl: imageUrl || undefined,
    };
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
