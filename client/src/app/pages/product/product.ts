import { Component, DestroyRef, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
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
import {
  FilterCategoryTreeGroup,
  ProductFilterComponent,
  ProductFilterState,
} from '../../shared/product-filter/product-filter';
import { ProductSortComponent, ProductSortValue } from '../../shared/product-sort/product-sort';
import { ProductGridComponent } from '../../shared/product-grid/product-grid';

interface SortQueryConfig {
  sortBy: NonNullable<ProductQueryOptions['sortBy']>;
  order: NonNullable<ProductQueryOptions['order']>;
}

interface SizeFilterProfile {
  targetCm: number;
  toleranceCm: number;
  aliases: string[];
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

const CATEGORY_GROUP_LABELS: Record<string, string> = {
  'phong-ngu': 'Phòng ngủ',
  'phong-khach': 'Phòng khách',
  'phong-an': 'Phòng ăn',
  'phong-lam-viec': 'Phòng làm việc',
  'tu-bep': 'Tủ bếp',
  nem: 'Nệm',
};

const CATEGORY_GROUP_ORDER = ['phong-ngu', 'phong-khach', 'phong-an', 'phong-lam-viec', 'tu-bep', 'nem'];

const SIZE_FILTERS: Record<string, SizeFilterProfile> = {
  'size-90cm': {
    targetCm: 90,
    toleranceCm: 10,
    aliases: ['90cm', '0.9m', '900mm', '90x', 'x90'],
  },
  'size-1m2': {
    targetCm: 120,
    toleranceCm: 10,
    aliases: ['1m2', '1.2m', '120cm', '1200mm', '120x', 'x120'],
  },
  'size-1m4': {
    targetCm: 140,
    toleranceCm: 10,
    aliases: ['1m4', '1.4m', '140cm', '1400mm', '140x', 'x140'],
  },
  'size-1m6': {
    targetCm: 160,
    toleranceCm: 10,
    aliases: ['1m6', '1.6m', '160cm', '1600mm', '160x', 'x160'],
  },
  'size-1m8': {
    targetCm: 180,
    toleranceCm: 10,
    aliases: ['1m8', '1.8m', '180cm', '1800mm', '180x', 'x180'],
  },
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
  private lastCategoryScrollSignature = '';
  @ViewChild('filterSectionRef') private filterSectionRef?: ElementRef<HTMLElement>;
  @ViewChild('categorySectionRef') private categorySectionRef?: ElementRef<HTMLElement>;

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
  readonly selectedPriceRanges = signal<string[]>([]);
  readonly selectedColors = signal<string[]>([]);
  readonly selectedSizes = signal<string[]>([]);
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
    return 'Tat ca danh muc';
  });

  readonly selectedFilterCategoryId = computed(() => {
    return this.selectedCollectionId() || this.selectedCategoryId();
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
    const groupSlug = this.selectedGroupSlug();

    if (groupSlug === 'bo-suu-tap' || Boolean(this.selectedCollectionId())) {
      return this.collections().map((item) => ({
        value: item.id,
        label: item.name,
        type: 'collection' as const,
      }));
    }

    return this.categories().map((item) => ({ value: item.id, label: item.name, type: 'category' as const }));
  });

  readonly filterCategoryTree = computed<FilterCategoryTreeGroup[]>(() => {
    if (this.selectedGroupSlug() === 'bo-suu-tap' || Boolean(this.selectedCollectionId())) {
      return [];
    }

    const allCategories = this.categories();
    if (allCategories.length === 0) {
      return [];
    }

    const categoryBySlug = new Map(allCategories.map((item) => [item.slug, item] as const));
    return CATEGORY_GROUP_ORDER
      .map((slug) => {
        const childSlugs = GROUP_CATEGORY_SLUGS[slug] || [];
        const children = childSlugs
          .map((childSlug) => categoryBySlug.get(childSlug))
          .filter((item): item is TaxonomyItem => Boolean(item))
          .map((item) => ({
            value: item.id,
            label: item.name,
            type: 'category' as const,
          }));

        return {
          id: slug,
          label: CATEGORY_GROUP_LABELS[slug] || slug,
          children,
        };
      })
      .filter((group) => group.children.length > 0);
  });

  readonly preferredExpandedFilterGroupIds = computed<string[]>(() => {
    const result = new Set<string>();
    const selectedGroupSlug = this.selectedGroupSlug();
    if (selectedGroupSlug && selectedGroupSlug !== 'bo-suu-tap') {
      result.add(selectedGroupSlug);
    }

    const selectedCategoryIds = new Set(this.selectedCategoryIds());
    if (selectedCategoryIds.size > 0) {
      const slugToGroup = new Map<string, string>();
      for (const groupSlug of CATEGORY_GROUP_ORDER) {
        for (const categorySlug of GROUP_CATEGORY_SLUGS[groupSlug] || []) {
          slugToGroup.set(categorySlug, groupSlug);
        }
      }

      this.categories().forEach((category) => {
        if (!selectedCategoryIds.has(category.id)) {
          return;
        }
        const parentGroupSlug = slugToGroup.get(category.slug);
        if (parentGroupSlug) {
          result.add(parentGroupSlug);
        }
      });
    }

    return Array.from(result);
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
      const nextCategoryParam = String(params['categories'] || params['category'] || '').trim();
      const nextCategoryIds = nextCategoryParam
        .split(',')
        .map((value) => value.trim())
        .filter((value) => Boolean(value) && this.isCategoryQueryValue(value));
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

      const nextCategoryScrollSignature = JSON.stringify({
        groupSlug: nextGroupSlug,
        collectionId: nextCollectionId,
        categoryIds: nextCategoryIds,
      });
      if (nextCategoryScrollSignature !== this.lastCategoryScrollSignature) {
        this.lastCategoryScrollSignature = nextCategoryScrollSignature;
        this.scrollToCategorySection();
      }

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
    this.scrollToCategorySection();
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
    this.scrollToCategorySection();
    this.selectedPriceRanges.set(filters.priceRanges || (filters.priceRange ? [filters.priceRange] : []));
    this.selectedColors.set(filters.colors || (filters.color ? [filters.color] : []));
    this.selectedSizes.set(filters.sizes || (filters.size ? [filters.size] : []));

    if (filters.categoryType === 'collection') {
      this.selectedCollectionId.set(filters.categoryId);
      this.selectedCategoryIds.set([]);
      this.selectedCategoryId.set('');
      this.updateRouteQuery({
        collection: filters.categoryId || null,
        categories: null,
        page: 1,
      });
      return;
    }

    if (filters.categoryType === 'category') {
      const nextCategoryIds = filters.categoryIds.length > 0 ? filters.categoryIds : filters.categoryId ? [filters.categoryId] : [];
      this.selectedCollectionId.set('');
      this.selectedCategoryIds.set(nextCategoryIds);
      this.selectedCategoryId.set(nextCategoryIds.length === 1 ? nextCategoryIds[0] : '');
      this.updateRouteQuery({
        collection: null,
        categories: nextCategoryIds.length > 0 ? nextCategoryIds.join(',') : null,
        page: 1,
      });
      return;
    }

    this.selectedCollectionId.set('');
    this.selectedCategoryIds.set([]);
    this.selectedCategoryId.set('');
    this.updateRouteQuery({
      collection: null,
      categories: null,
      page: 1,
    });
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
      this.updateRouteQuery({ categories: null, page: 1 });
    }
  }

  private applyLocalFilters(items: ProductListItem[]): ProductListItem[] {
    return items.filter((item) => {
      if (!this.matchesPriceFilter(item.price, this.selectedPriceRanges())) {
        return false;
      }
      if (!this.matchesColorFilter(item, this.selectedColors())) {
        return false;
      }
      if (!this.matchesSizeFilter(item, this.selectedSizes())) {
        return false;
      }
      return true;
    });
  }

  private matchesPriceFilter(price: number | null, ranges: string[]): boolean {
    if (!ranges.length) {
      return true;
    }
    if (price === null) {
      return false;
    }
    return ranges.some((range) => {
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
      return false;
    });
  }

  private matchesColorFilter(item: ProductListItem, keywords: string[]): boolean {
    if (!keywords.length) {
      return true;
    }

    const searchContent = this.normalizeText(`${item.name} ${item.materialText} ${item.sizeText}`);
    return keywords.some((keyword) => searchContent.includes(this.normalizeText(keyword)));
  }

  private matchesSizeFilter(item: ProductListItem, sizeKeys: string[]): boolean {
    if (!sizeKeys.length) {
      return true;
    }

    const combinedText = `${item.sizeText} ${item.name}`;
    const normalized = this.normalizeSizeText(combinedText);
    const candidates = this.extractSizeValuesInCm(combinedText);

    return sizeKeys.some((sizeKey) => {
      const profile = SIZE_FILTERS[sizeKey];
      if (!profile) {
        return false;
      }

      if (profile.aliases.some((alias) => normalized.includes(alias))) {
        return true;
      }

      return candidates.some((valueCm) => Math.abs(valueCm - profile.targetCm) <= profile.toleranceCm);
    });
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private normalizeSizeText(value: string): string {
    return this.normalizeText(value).replace(/[\s_:-]+/g, '');
  }

  private extractSizeValuesInCm(rawValue: string): number[] {
    const source = String(rawValue || '').toLowerCase().replace(/,/g, '.');
    if (!source) {
      return [];
    }

    const values = new Set<number>();
    const addValue = (nextValue: number): void => {
      if (!Number.isFinite(nextValue)) {
        return;
      }
      const rounded = Math.round(nextValue);
      if (rounded >= 40 && rounded <= 260) {
        values.add(rounded);
      }
    };

    const compactMeterRegex = /(\d)\s*m\s*(\d{1,2})(?!\d)/g;
    for (const match of source.matchAll(compactMeterRegex)) {
      const base = Number(match[1]);
      const decimalPart = Number(match[2]);
      const divisor = Math.pow(10, String(match[2]).length);
      addValue((base + decimalPart / divisor) * 100);
    }

    const decimalMeterRegex = /(\d+(?:\.\d+)?)\s*m(?![a-z])/g;
    for (const match of source.matchAll(decimalMeterRegex)) {
      addValue(Number(match[1]) * 100);
    }

    const cmRegex = /(\d{2,3}(?:\.\d+)?)\s*cm\b/g;
    for (const match of source.matchAll(cmRegex)) {
      addValue(Number(match[1]));
    }

    const mmRegex = /(\d{3,4})\s*mm\b/g;
    for (const match of source.matchAll(mmRegex)) {
      addValue(Number(match[1]) / 10);
    }

    const dimensionRegex = /(\d{2,4})\s*[x*]\s*(\d{2,4})/g;
    for (const match of source.matchAll(dimensionRegex)) {
      const left = this.normalizeDimensionNumber(Number(match[1]));
      const right = this.normalizeDimensionNumber(Number(match[2]));
      if (left !== null) {
        addValue(left);
      }
      if (right !== null) {
        addValue(right);
      }
    }

    return Array.from(values);
  }

  private normalizeDimensionNumber(value: number): number | null {
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    if (value >= 1000 && value <= 2600) {
      return value / 10;
    }
    if (value >= 40 && value <= 260) {
      return value;
    }
    return null;
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
    categories?: string | null;
    sort?: ProductSortValue | null;
    page?: number | null;
  }): void {
    const queryParams: Record<string, string | number | null> = {};

    if (changes.collection !== undefined) {
      queryParams['collection'] = changes.collection || null;
    }
    if (changes.categories !== undefined) {
      queryParams['categories'] = changes.categories || null;
      queryParams['category'] = null;
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

  private isCategoryQueryValue(value: string): boolean {
    const nextValue = String(value || '').trim();
    if (!nextValue) {
      return false;
    }
    if (this.isMongoObjectId(nextValue)) {
      return true;
    }
    return /^[a-z0-9-]{2,80}$/i.test(nextValue);
  }

  private scrollToCategorySection(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const sectionElement = this.categorySectionRef?.nativeElement || this.filterSectionRef?.nativeElement;
    if (!sectionElement) {
      return;
    }

    setTimeout(() => {
      const top = sectionElement.getBoundingClientRect().top + window.scrollY - this.getStickyHeaderOffset();
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 0);
  }

  private getStickyHeaderOffset(): number {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 96;
    }

    const header = document.querySelector('.moho-header') as HTMLElement | null;
    const navbar = document.querySelector('.moho-navbar') as HTMLElement | null;

    const headerHeight = header?.getBoundingClientRect().height || 0;
    const navbarRect = navbar?.getBoundingClientRect();
    const navbarVisible = Boolean(navbarRect && navbarRect.height > 0 && navbarRect.bottom > 0);
    const navbarHeight = navbarVisible ? navbarRect?.height || 0 : 0;

    return Math.max(96, Math.round(headerHeight + navbarHeight + 12));
  }
}
