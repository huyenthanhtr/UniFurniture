import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize, forkJoin, of } from 'rxjs';
import {
  ProductDataService,
  ProductListItem,
  TaxonomyItem,
  ProductQueryOptions,
} from '../../services/product-data.service';
import { ProductFilterComponent, ProductFilterState } from '../../shared/product-filter/product-filter';
import { ProductSortComponent, ProductSortValue } from '../../shared/product-sort/product-sort';
import { ProductGridComponent } from '../../shared/product-grid/product-grid';

interface SortQueryConfig {
  sortBy: NonNullable<ProductQueryOptions['sortBy']>;
  order: NonNullable<ProductQueryOptions['order']>;
}

const DEFAULT_BANNER_IMAGE =
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=1920';

const GROUP_CATEGORY_SLUGS: Record<string, string[]> = {
  'bo-suu-tap': [],
  'phong-ngu': ['combo-phong-ngu', 'tu-quan-ao', 'giuong-ngu', 'tu-dau-giuong', 'ban-trang-diem'],
  'phong-khach': ['ghe-sofa', 'ban-sofa-ban-cafe-ban-tra', 'tu-ke-tivi', 'tu-giay-tu-trang-tri', 'tu-ke'],
  'phong-an': ['ban-an', 'ghe-an', 'bo-ban-an'],
  'phong-lam-viec': ['ban-lam-viec', 'ghe-van-phong'],
  'tu-bep': ['tu-ke'],
  nem: ['combo-phong-ngu', 'giuong-ngu'],
};

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductFilterComponent, ProductSortComponent, ProductGridComponent],
  templateUrl: './product.html',
  styleUrl: './product.css',
})
export class ProductComponent implements OnInit {
  private readonly productDataService = inject(ProductDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private loadingGuard: ReturnType<typeof setTimeout> | null = null;
  private bannerRotationTimer: ReturnType<typeof setInterval> | null = null;
  private hasRequestedCollectionLinks = false;
  private lastLoadSignature = '';

  readonly products = signal<ProductListItem[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  readonly collections = signal<TaxonomyItem[]>([]);
  readonly categories = signal<TaxonomyItem[]>([]);
  readonly collectionCategoryLinks = signal<Record<string, string[]>>({});
  readonly selectedGroupSlug = signal('');
  readonly selectedGroupLabel = signal('');
  readonly selectedCollectionId = signal('');
  readonly searchQuery = signal('');
  readonly selectedCategoryIds = signal<string[]>([]);
  readonly selectedCategoryId = signal('');
  readonly selectedPriceRange = signal('price-asc');
  readonly selectedColor = signal('all');
  readonly selectedSize = signal('all');
  readonly selectedSort = signal<ProductSortValue>('best-selling');
  readonly currentBannerIndex = signal(0);

  readonly currentPage = signal(1);
  readonly totalItems = signal(0);
  readonly totalPages = signal(1);
  readonly pageSize = 24;

  readonly pageNumbers = computed(() => {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  });

  readonly selectedCollectionName = computed(() => {
    const item = this.collections().find((entry) => entry.id === this.selectedCollectionId());
    return item?.name || '';
  });

  readonly selectedCategoryName = computed(() => {
    const item = this.categories().find((entry) => entry.id === this.selectedCategoryId());
    return item?.name || '';
  });

  readonly pageTitle = computed(() => {
    if (this.searchQuery()) {
      return `Kết quả tìm kiếm cho: '${this.searchQuery()}'`;
    }
    if (this.selectedCategoryName()) {
      return this.selectedCategoryName();
    }
    if (this.selectedCollectionName()) {
      return this.selectedCollectionName();
    }
    if (this.selectedGroupLabel()) {
      return this.selectedGroupLabel();
    }
    return 'Tất cả sản phẩm';
  });

  readonly breadcrumbParentName = computed(() => {
    const parent = this.selectedGroupLabel();
    if (!parent) {
      return '';
    }
    return parent !== this.pageTitle() ? parent : '';
  });

  readonly categoryFilterLabel = computed(() => {
    if (this.selectedCategoryName()) {
      return this.selectedCategoryName();
    }
    if (this.selectedCollectionName()) {
      return this.selectedCollectionName();
    }
    if (this.selectedGroupLabel()) {
      return this.selectedGroupLabel();
    }
    return 'Tat ca danh muc';
  });

  readonly bannerImageUrls = computed(() => {
    const selectedCategoryId = this.selectedCategoryId();
    if (selectedCategoryId) {
      const category = this.categories().find((item) => item.id === selectedCategoryId);
      if (category?.imageUrl) {
        return [category.imageUrl];
      }
    }

    const selectedCollectionId = this.selectedCollectionId();
    if (selectedCollectionId) {
      const collection = this.collections().find((item) => item.id === selectedCollectionId);
      if (collection?.imageUrl) {
        return [collection.imageUrl];
      }
    }

    const selectedCategoryIds = this.selectedCategoryIds();
    if (selectedCategoryIds.length > 0) {
      const idSet = new Set(selectedCategoryIds);
      const categoryImages = this.categories()
        .filter((item) => idSet.has(item.id) && Boolean(item.imageUrl))
        .map((item) => item.imageUrl as string);
      if (categoryImages.length > 0) {
        return Array.from(new Set(categoryImages));
      }
    }

    const groupSlug = this.selectedGroupSlug();
    if (groupSlug) {
      if (groupSlug === 'bo-suu-tap') {
        const collectionImages = this.collections()
          .map((item) => item.imageUrl || '')
          .filter(Boolean);
        if (collectionImages.length > 0) {
          return Array.from(new Set(collectionImages));
        }
      }

      const groupCategorySlugs = GROUP_CATEGORY_SLUGS[groupSlug] || [];
      if (groupCategorySlugs.length > 0) {
        const groupSlugSet = new Set(groupCategorySlugs);
        const groupImages = this.categories()
          .filter((item) => groupSlugSet.has(item.slug) && Boolean(item.imageUrl))
          .map((item) => item.imageUrl as string);
        if (groupImages.length > 0) {
          return Array.from(new Set(groupImages));
        }
      }
    }

    return [DEFAULT_BANNER_IMAGE];
  });

  readonly bannerImageUrl = computed(() => {
    const images = this.bannerImageUrls();
    if (!images.length) {
      return DEFAULT_BANNER_IMAGE;
    }
    const index = this.currentBannerIndex() % images.length;
    return images[index];
  });

  readonly filterCategoryOptions = computed(() => {
    const allCategories = this.categories();
    const collectionId = this.selectedCollectionId();
    const links = this.collectionCategoryLinks();
    if (collectionId && links[collectionId] && links[collectionId].length > 0) {
      const availableCategoryIds = new Set(links[collectionId]);
      return allCategories
        .filter((category) => availableCategoryIds.has(category.id))
        .map((item) => ({ value: item.id, label: item.name }));
    }

    const selectedCategoryIds = this.selectedCategoryIds();
    if (selectedCategoryIds.length > 1) {
      const selectedIdSet = new Set(selectedCategoryIds);
      return allCategories
        .filter((category) => selectedIdSet.has(category.id))
        .map((item) => ({ value: item.id, label: item.name }));
    }

    return allCategories.map((item) => ({ value: item.id, label: item.name }));
  });

  readonly visibleProducts = computed(() => this.applyLocalFilters(this.products()));

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.stopBannerRotation();
    });

    this.loadTaxonomyData();

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const nextGroupSlug = String(params['group'] || '').trim();
      const nextGroupLabel = String(params['groupLabel'] || '').trim();
      const rawCollectionId = String(params['collection'] || '').trim();
      const nextCategoryParam = String(params['category'] || '').trim();
      const nextCategoryIds = nextCategoryParam
        .split(',')
        .map((value) => value.trim())
        .filter((value) => Boolean(value) && this.isMongoObjectId(value));
      const nextCollectionId = this.isMongoObjectId(rawCollectionId) ? rawCollectionId : '';
      const nextCategoryId = nextCategoryIds.length === 1 ? nextCategoryIds[0] : '';
      const nextSort = this.normalizeSortValue(String(params['sort'] || '').trim());
      const nextPage = this.normalizePageValue(params['page']);
      const nextSearchQuery = String(params['q'] || '').trim();

      const loadSignature = JSON.stringify({
        groupSlug: nextGroupSlug,
        groupLabel: nextGroupLabel,
        collectionId: nextCollectionId,
        categoryIds: nextCategoryIds,
        sort: nextSort,
        page: nextPage,
        searchQuery: nextSearchQuery,
      });

      if (loadSignature === this.lastLoadSignature) {
        return;
      }
      this.lastLoadSignature = loadSignature;

      this.selectedGroupSlug.set(nextGroupSlug);
      this.selectedGroupLabel.set(nextGroupLabel);
      this.selectedCollectionId.set(nextCollectionId);
      this.selectedCategoryIds.set(nextCategoryIds);
      this.selectedCategoryId.set(nextCategoryId);
      this.selectedSort.set(nextSort);
      this.currentPage.set(nextPage);
      this.searchQuery.set(nextSearchQuery);
      this.loadCollectionCategoryLinksIfNeeded();
      this.syncSelectedCategoryWithCollection();
      this.updateBannerRotation();

      this.loadProducts(this.currentPage());
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.updateRouteQuery({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  retry(): void {
    this.loadProducts(this.currentPage());
  }

  onFilterChange(filters: ProductFilterState): void {
    this.selectedPriceRange.set(filters.priceRange);
    this.selectedColor.set(filters.color);
    this.selectedSize.set(filters.size);
    this.selectedCategoryIds.set(filters.categoryId ? [filters.categoryId] : []);

    if (filters.categoryId !== this.selectedCategoryId()) {
      this.updateRouteQuery({
        category: filters.categoryId || null,
        page: 1,
      });
    }
  }

  onSortChange(sortValue: ProductSortValue): void {
    if (sortValue === this.selectedSort()) {
      return;
    }
    this.updateRouteQuery({ sort: sortValue, page: 1 });
  }

  private loadTaxonomyData(): void {
    forkJoin({
      categories: this.productDataService.getCategories().pipe(catchError(() => of([]))),
      collections: this.productDataService.getCollections().pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, collections }) => {
        this.categories.set(categories);
        this.collections.set(collections);
        this.syncSelectedCategoryWithCollection();
        this.updateBannerRotation();
      });
  }

  private loadCollectionCategoryLinksIfNeeded(): void {
    if (!this.selectedCollectionId() || this.hasRequestedCollectionLinks) {
      return;
    }

    this.hasRequestedCollectionLinks = true;
    this.productDataService
      .getCollectionCategoryLinks()
      .pipe(catchError(() => of({})), takeUntilDestroyed(this.destroyRef))
      .subscribe((links) => {
        this.collectionCategoryLinks.set(links);
        this.syncSelectedCategoryWithCollection();
      });
  }

  private loadProducts(page: number): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.clearLoadingGuard();
    this.loadingGuard = setTimeout(() => {
      this.isLoading.set(false);
      this.errorMessage.set('Tai du lieu qua lau. Vui long thu lai.');
    }, 12000);

    const sortConfig = this.toSortConfig(this.selectedSort());

    this.productDataService
      .getProducts(page, this.pageSize, {
        sortBy: sortConfig.sortBy,
        order: sortConfig.order,
        collectionId: this.selectedCollectionId() || undefined,
        categoryIds: this.selectedCategoryIds(),
        search: this.searchQuery() || undefined,
      })
      .pipe(
        catchError(() => {
          this.errorMessage.set('Khong the tai danh sach san pham.');
          this.products.set([]);
          this.totalItems.set(0);
          this.totalPages.set(1);
          return EMPTY;
        }),
        finalize(() => {
          this.clearLoadingGuard();
          this.isLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.products.set(response.items);
        this.currentPage.set(response.page);
        this.totalItems.set(response.total);
        this.totalPages.set(response.totalPages);
      });
  }

  private syncSelectedCategoryWithCollection(): void {
    const collectionId = this.selectedCollectionId();
    const categoryIds = this.selectedCategoryIds();
    if (!collectionId || categoryIds.length !== 1) {
      return;
    }
    const categoryId = categoryIds[0];

    const links = this.collectionCategoryLinks();
    const linkedCategoryIds = links[collectionId];
    if (!linkedCategoryIds || linkedCategoryIds.length === 0) {
      return;
    }

    if (!linkedCategoryIds.includes(categoryId)) {
      this.selectedCategoryIds.set([]);
      this.selectedCategoryId.set('');
      this.updateRouteQuery({ category: null, page: 1 });
    }
  }

  private applyLocalFilters(items: ProductListItem[]): ProductListItem[] {
    const filteredItems = items.filter((item) => {
      if (!this.matchesPriceFilter(item.price, this.selectedPriceRange())) {
        return false;
      }
      if (!this.matchesKeywordFilter(item, this.selectedColor())) {
        return false;
      }
      if (!this.matchesKeywordFilter(item, this.selectedSize())) {
        return false;
      }
      return true;
    });

    return this.applyPriceOrdering(filteredItems, this.selectedPriceRange());
  }

  private matchesPriceFilter(price: number | null, range: string): boolean {
    if (range === 'price-asc' || range === 'price-desc') {
      return true;
    }
    if (price === null) {
      return false;
    }
    if (range === 'under-2m') {
      return price < 2_000_000;
    }
    if (range === '2m-5m') {
      return price >= 2_000_000 && price < 5_000_000;
    }
    if (range === '5m-10m') {
      return price >= 5_000_000 && price < 10_000_000;
    }
    if (range === '10m-15m') {
      return price >= 10_000_000 && price <= 15_000_000;
    }
    if (range === 'over-15m') {
      return price > 15_000_000;
    }
    return true;
  }

  private applyPriceOrdering(items: ProductListItem[], range: string): ProductListItem[] {
    if (range !== 'price-asc' && range !== 'price-desc') {
      return items;
    }

    return [...items].sort((a, b) => {
      const priceA = a.price;
      const priceB = b.price;

      if (priceA === null && priceB === null) {
        return 0;
      }
      if (priceA === null) {
        return 1;
      }
      if (priceB === null) {
        return -1;
      }

      return range === 'price-asc' ? priceA - priceB : priceB - priceA;
    });
  }

  private matchesKeywordFilter(item: ProductListItem, keyword: string): boolean {
    if (keyword === 'all') {
      return true;
    }

    const normalizedKeyword = this.normalizeText(keyword);
    const searchContent = this.normalizeText(`${item.name} ${item.materialText} ${item.sizeText}`);
    return searchContent.includes(normalizedKeyword);
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private normalizeSortValue(value: string): ProductSortValue {
    if (value === 'newest' || value === 'oldest' || value === 'best-selling') {
      return value;
    }
    return 'best-selling';
  }

  private normalizePageValue(value: unknown): number {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue) || nextValue < 1) {
      return 1;
    }
    return Math.trunc(nextValue);
  }

  private toSortConfig(sortValue: ProductSortValue): SortQueryConfig {
    if (sortValue === 'newest') {
      return { sortBy: 'createdAt', order: 'desc' };
    }
    if (sortValue === 'oldest') {
      return { sortBy: 'createdAt', order: 'asc' };
    }
    return { sortBy: 'bestSelling', order: 'desc' };
  }

  private updateRouteQuery(changes: {
    collection?: string | null;
    category?: string | null;
    sort?: ProductSortValue | null;
    page?: number | null;
  }): void {
    const queryParams: Record<string, string | number | null> = {};

    if (changes.collection !== undefined) {
      queryParams['collection'] = changes.collection || null;
    }
    if (changes.category !== undefined) {
      queryParams['category'] = changes.category || null;
    }
    if (changes.sort !== undefined) {
      queryParams['sort'] = changes.sort || null;
    }
    if (changes.page !== undefined) {
      queryParams['page'] = changes.page && changes.page > 1 ? changes.page : null;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  private clearLoadingGuard(): void {
    if (this.loadingGuard !== null) {
      clearTimeout(this.loadingGuard);
      this.loadingGuard = null;
    }
  }

  private stopBannerRotation(): void {
    if (this.bannerRotationTimer !== null) {
      clearInterval(this.bannerRotationTimer);
      this.bannerRotationTimer = null;
    }
  }

  private updateBannerRotation(): void {
    const images = this.bannerImageUrls();
    this.currentBannerIndex.set(0);
    this.stopBannerRotation();

    if (images.length > 1) {
      this.bannerRotationTimer = setInterval(() => {
        this.currentBannerIndex.update((index) => (index + 1) % images.length);
      }, 3000);
    }
  }

  private isMongoObjectId(value: string): boolean {
    return /^[a-fA-F0-9]{24}$/.test(String(value || ''));
  }
}
