import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, forkJoin, map, Observable, of, shareReplay, timeout } from 'rxjs';

interface ApiListResponse<T> {
  page: number;
  limit: number;
  total: number;
  items: T[];
}

export interface ProductModel3D {
  _id: string;
  product_id: string;
  variant_id?: string;
  file_id: string;
  filename: string;
  status: string;
}

export interface ProductDocument {
  _id: string;
  name: string;
  slug?: string;
  status: string;
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
  variant_id?: string;
  image_url?: string;
  is_primary?: boolean;
  sort_order?: number;
}

export interface ProductVariantDocument {
  _id: string;
  product_id?: string;
  name?: string;
  variant_name?: string;
  sku?: string;
  color?: string;
  price?: number;
  compare_at_price?: number;
}

export interface ColorSwatch {
  name: string;
  hex: string;
  price?: number | null;
  originalPrice?: number | null;
  imageUrl?: string;
  sku?: string;
  variants?: ProductVariantDocument[];
}

export interface ImageWithVariant {
  url: string;
  variant_id?: string;
}

export interface ProductDetailData {
  id: string;
  name: string;
  slug?: string;
  sku: string;
  price: number | null;
  originalPrice: number | null;
  shortDescription: string;
  description: string;
  sizeText: string;
  materialText: string;
  warrantyMonths: number | null;
  colors: ColorSwatch[];
  images: ImageWithVariant[];
}

/** Client-side mirror of server color-map.utils.js */
const COLOR_MAP: Record<string, string> = {
  'beige': '#f0e6d3',
  'combo màu tự nhiên đệm be': '#d9c5a5',
  'nâu be': '#a0785a',
  'sofa nệm be': '#d9c5a5',
  'cam': '#e8722a',
  'camel': '#c19a6b',
  'combo nâu': '#6f4e37',
  'màu nâu': '#6f4e37',
  'màu nâu/xám': '#8b7d7b',
  'màu nâu/nệm xám': '#8b7d7b',
  'nâu': '#6f4e37',
  'nau': '#6f4e37',
  'nâu phối trắng': '#a07855',
  'giường màu trắng 1m6': '#f0f0f0',
  'giường màu trắng 1m8': '#f0f0f0',
  'giường trắng 1m6': '#f0f0f0',
  'giường trắng 1m8': '#f0f0f0',
  'màu trắng': '#f0f0f0',
  'trắng': '#f0f0f0',
  'trắng - xám': '#d0d0d0',
  'gỗ phối trắng': '#e8ddd0',
  'giường tự nhiên 1m6': '#c8a97e',
  'màu tự nhiên': '#c8a97e',
  'olive': '#808000',
  'sofa nệm xám': '#9e9e9e',
  'xám': '#9e9e9e',
  'xanh dương': '#1565c0',
  'đen': '#1a1a1a',
};

function getColorHex(name: string): string {
  const key = (name || '').trim().toLowerCase().normalize('NFC');
  return COLOR_MAP[key] || '#cccccc';
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
  colors: ColorSwatch[];
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
        params = params.set('categories', categoryParam).set('category', categoryParam);
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

            const rawColors = Array.isArray((product as any).colors) ? (product as any).colors : [];
            return {
              id: product._id,
              name: product.name || 'San pham',
              price,
              originalPrice,
              imageUrl: product.thumbnail?.trim() || product.thumbnail_url?.trim() || FALLBACK_IMAGE_URL,
              discountBadge: this.getDiscountBadge(price, originalPrice),
              reviewsCount: 0,
              soldCount: this.toNullableNumber(product.sold) ?? 0,
              colors: rawColors.filter((c: any) => c && c.name && c.hex) as ColorSwatch[],
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

  getProductRecommendations(slug: string): Observable<ProductListItem[]> {
    return this.http
      .get<{ items: ProductDocument[] }>(`${this.apiBaseUrl}/products/${slug}/recommendations`)
      .pipe(
        timeout(15000),
        map((response) => {
          return (response.items || []).map((product) => {
            const price = this.toNullableNumber(product.min_price);
            const originalPrice = this.toNullableNumber(product.compare_at_price);

            return {
              id: product._id,
              name: product.name || 'Sản phẩm',
              slug: product.slug,
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
        }),
        catchError(() => of([]))
      );
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
        const mappedImages = this.sortImages(images.items)
          .map((image) => ({ url: image.image_url?.trim() || '', variant_id: image.variant_id }))
          .filter((img) => img.url.length > 0);

        // Ensure unique URLs while keeping the first associated variant_id
        const uniqueImages: ImageWithVariant[] = [];
        const seenUrls = new Set<string>();
        for (const img of mappedImages) {
          if (!seenUrls.has(img.url)) {
            uniqueImages.push(img);
            seenUrls.add(img.url);
          }
        }

        return {
          id: product._id,
          name: product.name || 'San pham',
          slug: product.slug,
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
          colors: this.extractColors(variants.items, images.items, product),
          images: uniqueImages.length > 0 ? uniqueImages : [{ url: product.thumbnail?.trim() || FALLBACK_IMAGE_URL }],
        };
      }),
    );
  }

  getProductModels(productId: string): Observable<ProductModel3D[]> {
    return this.http.get<ProductModel3D[]>(`${this.apiBaseUrl}/product-models-3d/product/${productId}`).pipe(
      timeout(10000),
      catchError(() => of([]))
    );
  }

  getAllProductModels(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/product-models-3d`).pipe(
      timeout(10000),
      catchError(() => of([]))
    );
  }

  getModelFileUrl(fileId: string): string {
    return `${this.apiBaseUrl}/product-models-3d/file/${fileId}`;
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

  private extractColors(variants: ProductVariantDocument[], images: ProductImageDocument[], product: ProductDocument): ColorSwatch[] {
    const seen = new Map<string, ColorSwatch>();
    const productFallbackImg = product.thumbnail?.trim() || product.thumbnail_url?.trim() || FALLBACK_IMAGE_URL;

    for (const variant of variants) {
      const name = variant.color?.trim() || '';
      if (name) {
        if (!seen.has(name)) {
          // find best image for this variant
          const variantImages = images.filter(img => img.variant_id === variant._id);
          const primaryImage = variantImages.find(img => img.is_primary) || variantImages[0];
          const imageUrl = primaryImage?.image_url?.trim() || productFallbackImg;

          seen.set(name, {
            name,
            hex: getColorHex(name),
            price: this.toNullableNumber(variant.price),
            originalPrice: this.toNullableNumber(variant.compare_at_price),
            sku: variant.sku?.trim() || product.sku?.trim() || '',
            imageUrl,
            variants: [],
          });
        }

        // Add variant to the color
        seen.get(name)!.variants!.push(variant);
      }
    }
    return Array.from(seen.values());
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
