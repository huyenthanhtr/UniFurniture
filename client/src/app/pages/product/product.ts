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
  FilterSelectOption,
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

const ROOM_GROUP_ORDER = ['phong-ngu', 'phong-khach', 'phong-an', 'phong-lam-viec'];

const FALLBACK_COLOR_OPTIONS: FilterSelectOption[] = [
  { value: 'trang', label: 'Trắng', hex: '#f5f5f4' },
  { value: 'den', label: 'Đen', hex: '#111827' },
  { value: 'xam', label: 'Xám', hex: '#9ca3af' },
  { value: 'nau', label: 'Nâu', hex: '#8b5e3c' },
  { value: 'tu nhien', label: 'Màu tự nhiên', hex: '#c8a97e' },
  { value: 'xanh', label: 'Xanh', hex: '#6f96bf' },
];

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
  private categoryScrollFrame: number | null = null;
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
  readonly selectedCollectionIds = signal<string[]>([]);
  readonly searchQuery = signal('');
  readonly selectedCategoryIds = signal<string[]>([]);
  readonly selectedCategoryId = signal('');
  readonly selectedPriceRanges = signal<string[]>([]);
  readonly selectedColors = signal<string[]>([]);
  readonly selectedSizes = signal<string[]>([]);
  readonly topColorOptions = signal<FilterSelectOption[]>([]);
  readonly selectedSort = signal<ProductSortValue>('best-selling');
  readonly customTitle = signal<string>('');
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
    if (this.customTitle()) {
      return this.customTitle();
    }
    if (this.searchQuery()) {
      return `K\u1ebft qu\u1ea3 t\u00ecm ki\u1ebfm cho: '${this.searchQuery()}'`;
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
    return 'T\u1ea5t c\u1ea3 s\u1ea3n ph\u1ea9m';
  });

  readonly breadcrumbParentName = computed(() => {
    const parent = this.selectedGroupLabel();
    if (!parent) {
      return '';
    }
    return parent !== this.pageTitle() ? parent : '';
  });

  readonly categoryFilterLabel = computed(() => {
    if (this.selectedCollectionName()) {
      return this.selectedCollectionName();
    }
    if (this.selectedCategoryName()) {
      return this.selectedCategoryName();
    }
    if (this.selectedGroupSlug() === 'bo-suu-tap' && this.selectedGroupLabel()) {
      return this.selectedGroupLabel();
    }
    return '';
  });

  readonly selectedFilterCategoryId = computed(() => {
    return this.selectedCollectionId() || this.selectedCategoryId();
  });

  readonly selectedFilterCategoryGroupId = computed(() => {
    return this.selectedGroupSlug() === 'bo-suu-tap' && this.selectedCollectionIds().length === 0 ? 'bo-suu-tap' : '';
  });

  readonly selectedFilterCategoryIds = computed(() => {
    const ids = [...this.selectedCollectionIds(), ...this.selectedCategoryIds()];
    return Array.from(new Set(ids));
  });

  readonly categoryGroups = computed<FilterCategoryTreeGroup[]>(() => {
    const groupsMap = new Map<string, FilterCategoryTreeGroup>();

    for (const category of this.categories()) {
      const groupSlug = this.normalizeRoomToGroupSlug(category.room);
      if (!groupSlug) {
        continue;
      }

      if (!groupsMap.has(groupSlug)) {
        groupsMap.set(groupSlug, {
          id: groupSlug,
          label: this.getRoomLabelBySlug(groupSlug, category.room),
          children: [],
        });
      }

      groupsMap.get(groupSlug)?.children.push({
        value: category.id,
        label: category.name,
        type: 'category',
      });
    }

    return Array.from(groupsMap.values())
      .map((group) => ({
        ...group,
        children: [...group.children].sort((left, right) => left.label.localeCompare(right.label, 'vi')),
      }))
      .sort((left, right) => this.compareRoomGroupOrder(left.id, right.id));
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

      const groupImages = this.categories()
        .filter((item) => this.normalizeRoomToGroupSlug(item.room) === groupSlug && Boolean(item.imageUrl))
        .map((item) => item.imageUrl as string);
      if (groupImages.length > 0) {
        return Array.from(new Set(groupImages));
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
    return this.filterCategoryTree().flatMap((group) => group.children);
  });

  readonly filterColorOptions = computed<FilterSelectOption[]>(() => {
    const dynamicOptions = this.topColorOptions();
    return dynamicOptions.length > 0 ? dynamicOptions : FALLBACK_COLOR_OPTIONS;
  });

  readonly filterCategoryTree = computed<FilterCategoryTreeGroup[]>(() => {
    const collectionGroup: FilterCategoryTreeGroup = {
      id: 'bo-suu-tap',
      label: 'Bộ sưu tập',
      children: this.collections()
        .map((item) => ({
          value: item.id,
          label: item.name,
          type: 'collection' as const,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'vi')),
    };

    const roomGroups = this.categoryGroups();
    return [collectionGroup, ...roomGroups].filter((group) => group.children.length > 0);
  });

  readonly preferredExpandedFilterGroupIds = computed<string[]>(() => {
    const result = new Set<string>();
    const selectedGroupSlug = this.selectedGroupSlug();
    if (selectedGroupSlug && selectedGroupSlug !== 'bo-suu-tap') {
      result.add(selectedGroupSlug);
    }

    const selectedCategoryIds = new Set(this.selectedCategoryIds());
    if (selectedCategoryIds.size > 0) {
      for (const group of this.filterCategoryTree()) {
        const hasSelectedChild = group.children.some((child) => selectedCategoryIds.has(child.value));
        if (hasSelectedChild) {
          result.add(group.id);
        }
      }
    }

    return Array.from(result);
  });

  readonly visibleProducts = computed(() => this.applyLocalFilters(this.products()));

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => {
      this.stopBannerRotation();
      if (this.categoryScrollFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.categoryScrollFrame);
        this.categoryScrollFrame = null;
      }
    });

    this.loadTaxonomyData();

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const nextGroupSlug = String(params['group'] || '').trim();
      const nextGroupLabel = String(params['groupLabel'] || '').trim();
      const nextNavScrollToken = String(params['navScroll'] || '').trim();
      const nextCollectionParam = String(params['collections'] || params['collection'] || '').trim();
      const nextCategoryParam = String(params['categories'] || params['category'] || '').trim();
      const nextCollectionIds = nextCollectionParam
        .split(',')
        .map((value) => value.trim())
        .filter((value) => Boolean(value) && this.isMongoObjectId(value));
      const nextCategoryIds = nextCategoryParam
        .split(',')
        .map((value) => value.trim())
        .filter((value) => Boolean(value) && this.isCategoryQueryValue(value));
      const nextCollectionId = nextCollectionIds.length === 1 ? nextCollectionIds[0] : '';
      const nextCategoryId = nextCategoryIds.length === 1 ? nextCategoryIds[0] : '';
      const nextSort = this.normalizeSortValue(String(params['sort'] || '').trim());
      const nextPage = this.normalizePageValue(params['page']);
      const nextSearchQuery = String(params['q'] || '').trim();

      const nextCategoryScrollSignature = JSON.stringify({
        groupSlug: nextGroupSlug,
        collectionIds: nextCollectionIds,
        categoryIds: nextCategoryIds,
        navScroll: nextNavScrollToken,
        searchQuery: nextSearchQuery,
      });
      if (nextCategoryScrollSignature !== this.lastCategoryScrollSignature) {
        this.lastCategoryScrollSignature = nextCategoryScrollSignature;
        this.scrollToCategorySection();
      }

      const loadSignature = JSON.stringify({
        groupSlug: nextGroupSlug,
        groupLabel: nextGroupLabel,
        collectionIds: nextCollectionIds,
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
      this.selectedCollectionIds.set(nextCollectionIds);
      this.selectedCategoryIds.set(nextCategoryIds);
      this.selectedCategoryId.set(nextCategoryId);
      this.selectedSort.set(nextSort);
      this.currentPage.set(nextPage);
      this.searchQuery.set(nextSearchQuery);
      this.customTitle.set(String(params['title'] || '').trim());

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
    const nextCollectionIds = Array.from(new Set(filters.collectionIds || []));
    const nextCategoryIds = Array.from(new Set(filters.categoryIds || []));
    const isCollectionGroupSelected = filters.categoryGroupId === 'bo-suu-tap';
    const hasCollections = isCollectionGroupSelected || nextCollectionIds.length > 0;
    const hasCategories = nextCategoryIds.length > 0;

    this.selectedCollectionIds.set(nextCollectionIds);
    this.selectedCollectionId.set(nextCollectionIds.length === 1 ? nextCollectionIds[0] : '');
    this.selectedCategoryIds.set(nextCategoryIds);
    this.selectedCategoryId.set(nextCategoryIds.length === 1 ? nextCategoryIds[0] : '');
    this.selectedGroupSlug.set(hasCollections ? 'bo-suu-tap' : '');
    this.selectedGroupLabel.set(hasCollections ? 'Bộ sưu tập' : '');

    this.updateRouteQuery({
      group: hasCollections ? 'bo-suu-tap' : null,
      groupLabel: hasCollections ? 'Bộ sưu tập' : null,
      collections: nextCollectionIds.length > 1 ? nextCollectionIds.join(',') : null,
      collection: nextCollectionIds.length === 1 ? nextCollectionIds[0] : null,
      categories: hasCategories ? nextCategoryIds.join(',') : null,
      page: 1,
    });
  }

  onSortChange(sortValue: ProductSortValue): void {
    if (sortValue === this.selectedSort()) {
      return;
    }
    this.scrollToCategorySection();
    this.updateRouteQuery({ sort: sortValue, page: 1 });
  }

  private loadTaxonomyData(): void {
    forkJoin({
      categories: this.productDataService.getCategories().pipe(catchError(() => of([]))),
      collections: this.productDataService.getCollections().pipe(catchError(() => of([]))),
      topColors: this.productDataService.getTopColorOptions(20).pipe(catchError(() => of([]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, collections, topColors }) => {
        this.categories.set(categories);
        this.collections.set(collections);
        this.topColorOptions.set(topColors);
        this.syncSelectedCategoryWithCollection();
        this.updateBannerRotation();
      });
  }

  private loadCollectionCategoryLinksIfNeeded(): void {
    if (!this.selectedCollectionId() || this.selectedCollectionIds().length !== 1 || this.hasRequestedCollectionLinks) {
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
      this.errorMessage.set('Tải dữ liệu quá lâu. Vui lòng thử lại.');
    }, 12000);

    const sortConfig = this.toSortConfig(this.selectedSort());

    if (this.shouldLoadMixedSelectionProducts()) {
      this.loadMixedSelectionProducts(page, sortConfig);
      return;
    }

    if (this.shouldLoadCollectionGroupProducts()) {
      this.loadCollectionGroupProducts(page, sortConfig);
      return;
    }

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
          this.errorMessage.set('Không thể tải danh sách sản phẩm.');
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

  private loadMixedSelectionProducts(page: number, sortConfig: SortQueryConfig): void {
    this.productDataService
      .getProducts(1, 500, {
        sortBy: sortConfig.sortBy,
        order: sortConfig.order,
        search: this.searchQuery() || undefined,
      })
      .pipe(
        catchError(() => {
          this.errorMessage.set('Không thể tải danh sách sản phẩm.');
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
        const collectionIds = new Set(this.selectedCollectionIds());
        const categoryIds = new Set(this.selectedCategoryIds());
        const includeAllCollections = this.selectedGroupSlug() === 'bo-suu-tap' && collectionIds.size === 0;

        const filteredItems = response.items.filter((item) => {
          const matchesCollection = includeAllCollections
            ? Boolean(item.collectionId)
            : Boolean(item.collectionId) && collectionIds.has(item.collectionId as string);
          const matchesCategory = Boolean(item.categoryId) && categoryIds.has(item.categoryId as string);

          if ((includeAllCollections || collectionIds.size > 0) && categoryIds.size > 0) {
            return matchesCollection || matchesCategory;
          }
          if (includeAllCollections || collectionIds.size > 0) {
            return matchesCollection;
          }
          return matchesCategory;
        });

        const totalItems = filteredItems.length;
        const totalPages = Math.max(Math.ceil(totalItems / this.pageSize), 1);
        const currentPage = Math.min(Math.max(page, 1), totalPages);
        const startIndex = (currentPage - 1) * this.pageSize;

        this.products.set(filteredItems.slice(startIndex, startIndex + this.pageSize));
        this.currentPage.set(currentPage);
        this.totalItems.set(totalItems);
        this.totalPages.set(totalPages);
      });
  }

  private loadCollectionGroupProducts(page: number, sortConfig: SortQueryConfig): void {
    this.productDataService
      .getProducts(1, 500, {
        sortBy: sortConfig.sortBy,
        order: sortConfig.order,
        search: this.searchQuery() || undefined,
      })
      .pipe(
        catchError(() => {
          this.errorMessage.set('Không thể tải danh sách sản phẩm.');
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
        const collectionItems = response.items.filter((item) => Boolean(item.collectionId));
        const totalItems = collectionItems.length;
        const totalPages = Math.max(Math.ceil(totalItems / this.pageSize), 1);
        const currentPage = Math.min(Math.max(page, 1), totalPages);
        const startIndex = (currentPage - 1) * this.pageSize;

        this.products.set(collectionItems.slice(startIndex, startIndex + this.pageSize));
        this.currentPage.set(currentPage);
        this.totalItems.set(totalItems);
        this.totalPages.set(totalPages);
      });
  }

  private shouldLoadCollectionGroupProducts(): boolean {
    return (
      this.selectedGroupSlug() === 'bo-suu-tap'
      && this.selectedCollectionIds().length === 0
      && !this.selectedCollectionId()
      && this.selectedCategoryIds().length === 0
      && !this.selectedCategoryId()
    );
  }

  private shouldLoadMixedSelectionProducts(): boolean {
    return (
      this.selectedCollectionIds().length > 1
      || (this.selectedCollectionIds().length > 0 && this.selectedCategoryIds().length > 0)
      || (this.selectedGroupSlug() === 'bo-suu-tap' && this.selectedCategoryIds().length > 0)
    );
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

    const colorText = (item.colors || []).map((color) => color.name).join(' ');
    const searchContent = this.normalizeText(`${item.name} ${item.materialText} ${item.sizeText} ${colorText}`);
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
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
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

  private normalizeRoomToGroupSlug(room?: string): string {
    const normalized = this.normalizeText(room || '').replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return '';
    }
    if (normalized === 'phong ngu') return 'phong-ngu';
    if (normalized === 'phong khach') return 'phong-khach';
    if (normalized === 'phong an') return 'phong-an';
    if (normalized === 'phong lam viec') return 'phong-lam-viec';
    return '';
  }

  private getRoomLabelBySlug(slug: string, fallbackRoom?: string): string {
    if (slug === 'phong-ngu') return 'Phòng ngủ';
    if (slug === 'phong-khach') return 'Phòng khách';
    if (slug === 'phong-an') return 'Phòng ăn';
    if (slug === 'phong-lam-viec') return 'Phòng làm việc';
    return String(fallbackRoom || slug);
  }

  private compareRoomGroupOrder(leftSlug: string, rightSlug: string): number {
    const leftIndex = ROOM_GROUP_ORDER.indexOf(leftSlug);
    const rightIndex = ROOM_GROUP_ORDER.indexOf(rightSlug);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return normalizedLeft - normalizedRight;
  }

  private normalizeSortValue(value: string): ProductSortValue {
    if (value === 'newest' || value === 'oldest' || value === 'best-selling' || value === 'suggested' || value === 'price') {
      return value as ProductSortValue;
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
    if (sortValue === 'price') {
      return { sortBy: 'min_price', order: 'asc' };
    }
    if (sortValue === 'suggested') {
      return { sortBy: 'suggested', order: 'desc' };
    }
    return { sortBy: 'bestSelling', order: 'desc' };
  }

  private updateRouteQuery(changes: {
    group?: string | null;
    groupLabel?: string | null;
    collections?: string | null;
    collection?: string | null;
    categories?: string | null;
    sort?: ProductSortValue | null;
    page?: number | null;
  }): void {
    const queryParams: Record<string, string | number | null> = {};
    queryParams['navScroll'] = null;

    if (changes.group !== undefined) {
      queryParams['group'] = changes.group || null;
    }
    if (changes.groupLabel !== undefined) {
      queryParams['groupLabel'] = changes.groupLabel || null;
    }
    if (changes.collections !== undefined) {
      queryParams['collections'] = changes.collections || null;
    }
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

  private scrollToCategorySection(attempt = 0): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const sectionElement = this.categorySectionRef?.nativeElement || this.filterSectionRef?.nativeElement;
    if (!sectionElement) {
      if (attempt < 18 && typeof requestAnimationFrame !== 'undefined') {
        if (this.categoryScrollFrame !== null) {
          cancelAnimationFrame(this.categoryScrollFrame);
        }
        this.categoryScrollFrame = requestAnimationFrame(() => this.scrollToCategorySection(attempt + 1));
      }
      return;
    }

    if (this.categoryScrollFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.categoryScrollFrame);
      this.categoryScrollFrame = null;
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
