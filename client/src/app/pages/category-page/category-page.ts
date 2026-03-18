import { Component, OnDestroy, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, Subscription, timer } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ProductDataService, ProductListItem } from '../../services/product-data.service';
import { ProductCardComponent } from '../../shared/product-card/product-card';

const BASE_URL = 'http://localhost:3000/api';

interface Category {
  _id: string;
  name: string;
  slug: string;
  image_url?: string;
  description?: string;
}

interface CategoryGroup {
  title: string;
  categorySlugs: string[];
}

const CATEGORY_GROUPS: Record<string, CategoryGroup> = {
  'bo-suu-tap': {
    title: 'Bộ sưu tập',
    categorySlugs: [],
  },
  'phong-ngu': {
    title: 'Phòng ngủ',
    categorySlugs: ['combo-phong-ngu', 'tu-quan-ao', 'giuong-ngu', 'tu-dau-giuong', 'ban-trang-diem'],
  },
  'phong-khach': {
    title: 'Phòng khách',
    categorySlugs: ['ghe-sofa', 'ban-sofa-ban-cafe-ban-tra', 'tu-ke-tivi', 'tu-giay-tu-trang-tri', 'tu-ke'],
  },
  'phong-an': {
    title: 'Phòng ăn',
    categorySlugs: ['ban-an', 'ghe-an', 'bo-ban-an'],
  },
  'phong-lam-viec': {
    title: 'Phòng làm việc',
    categorySlugs: ['ban-lam-viec', 'ghe-van-phong'],
  },
  'tu-bep': {
    title: 'Tủ bếp',
    categorySlugs: ['tu-ke'],
  },
  nem: {
    title: 'Nệm',
    categorySlugs: ['combo-phong-ngu', 'giuong-ngu'],
  },
};

const KEYWORDS_BY_SLUG: Record<string, string[]> = {
  'bo-suu-tap': [],
  'phong-ngu': ['phong ngu', 'giuong', 'tu quan ao', 'tu dau giuong', 'ban trang diem', 'nem'],
  'phong-khach': ['phong khach', 'sofa', 'ban sofa', 'ban cafe', 'ban tra', 'ke tivi', 'tu giay'],
  'phong-an': ['phong an', 'ban an', 'ghe an', 'bo ban an'],
  'phong-lam-viec': ['lam viec', 'ban lam viec', 'ghe van phong'],
  'tu-bep': ['tu bep', 'tu ke'],
  nem: ['nem', 'giuong'],
};

@Component({
  selector: 'app-category-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './category-page.html',
  styleUrl: './category-page.css',
})
export class CategoryPageComponent implements OnInit, OnDestroy {
  @ViewChild('categorySectionRef') private categorySectionRef?: ElementRef<HTMLElement>;
  category: Category | null = null;
  products: ProductListItem[] = [];
  loading = true;

  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  readonly limit = 16;

  groupTitle = '';
  categoryIds = '';
  currentSlug = '';
  keywordFilters: string[] = [];
  localFilteredProducts: ProductListItem[] | null = null;

  slideshowImages: string[] = [];
  currentSlideIndex = 0;
  private slideSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private productDataService: ProductDataService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.groupTitle = String(params['title'] || '').trim();
      this.categoryIds = String(params['categories'] || '').trim();
      const slug = String(params['slug'] || '').trim().toLowerCase();
      const sort = params['sort'] || 'bestSelling';
      const order = params['order'] || 'desc';
      const q = params['q'] || '';

      this.currentSlug = slug;
      this.keywordFilters = q ? [this.normalizeText(q)] : this.getKeywordFilters(slug, this.groupTitle);
      this.localFilteredProducts = null;
      this.scrollToCategorySection();

      this.stopSlideshow();
      this.slideshowImages = [];
      this.category = null;

      if (this.categoryIds) {
        this.loadMultiCategoryBanner(this.categoryIds);
        this.loadProducts(this.categoryIds, 1, this.keywordFilters, { sort, order, search: q });
        return;
      }

      if (slug) {
        this.loadBySlug(slug); // Note: loadBySlug might need internal updates for sort if we want precise sorting there too
        return;
      }

      this.loadProducts('', 1, this.keywordFilters, { sort, order, search: q });
    });
  }

  ngOnDestroy(): void {
    this.stopSlideshow();
  }

  private loadBySlug(slug: string): void {
    this.loading = true;

    this.http
      .get<any>(`${BASE_URL}/categories?slug=${slug}&limit=1`)
      .pipe(catchError(() => of({ items: [] })))
      .subscribe((res) => {
        const items: Category[] = Array.isArray(res?.items) ? res.items : [];
        const matchedCategory = items[0] || null;

        if (matchedCategory) {
          this.category = matchedCategory;
          if (matchedCategory.image_url) {
            this.slideshowImages = [matchedCategory.image_url];
          }
          this.keywordFilters = this.getKeywordFilters(slug, matchedCategory.name);
          this.loadProducts(matchedCategory._id, 1, this.keywordFilters);
          return;
        }

        this.loadByGroupSlug(slug);
      });
  }

  private loadByGroupSlug(slug: string): void {
    const group = CATEGORY_GROUPS[slug];

    if (!group) {
      this.finishWithEmptyState();
      return;
    }

    if (!this.groupTitle) {
      this.groupTitle = group.title;
    }

    this.http
      .get<any>(`${BASE_URL}/categories?limit=200`)
      .pipe(catchError(() => of({ items: [] })))
      .subscribe((res) => {
        const allCategories: Category[] = Array.isArray(res?.items) ? res.items : [];
        const matchedCategories =
          group.categorySlugs.length > 0
            ? allCategories.filter((category) => group.categorySlugs.includes(category.slug))
            : allCategories;

        const ids = matchedCategories.map((category) => category._id).filter(Boolean);
        this.categoryIds = ids.join(',');
        this.keywordFilters = this.getKeywordFilters(slug, this.groupTitle);

        this.slideshowImages = matchedCategories
          .map((category) => category.image_url || '')
          .filter((imageUrl) => Boolean(imageUrl));

        if (this.slideshowImages.length > 1) {
          this.startSlideshow();
        }

        this.loadProductsByKeywords(this.keywordFilters, 1);
      });
  }

  private loadMultiCategoryBanner(categoryIds: string): void {
    this.http
      .get<any>(`${BASE_URL}/categories?limit=200`)
      .pipe(catchError(() => of({ items: [] })))
      .subscribe((res) => {
        const allCategories: Category[] = Array.isArray(res?.items) ? res.items : [];
        const idsList = categoryIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
        const matchedCategories = allCategories.filter(
          (category) => idsList.includes(category._id) && Boolean(category.image_url),
        );

        this.slideshowImages = matchedCategories
          .map((category) => category.image_url || '')
          .filter((imageUrl) => Boolean(imageUrl));

        if (this.slideshowImages.length > 1) {
          this.startSlideshow();
        }

        this.cdr.detectChanges();
      });
  }

  private startSlideshow(): void {
    this.currentSlideIndex = 0;
    this.slideSubscription = timer(2000, 2000).subscribe(() => {
      if (!this.slideshowImages.length) {
        return;
      }
      this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
      this.cdr.detectChanges();
    });
  }

  private stopSlideshow(): void {
    if (!this.slideSubscription) {
      return;
    }

    this.slideSubscription.unsubscribe();
    this.slideSubscription = undefined;
  }

  private loadProducts(categoryIds: string, page: number, fallbackKeywords: string[] = [], sorting?: any): void {
    this.loading = true;
    this.localFilteredProducts = null;
    const parsedCategoryIds = this.parseCategoryIds(categoryIds);

    this.productDataService
      .getProducts(page, this.limit, {
        sortBy: sorting?.sort || 'bestSelling',
        order: sorting?.order || 'desc',
        search: sorting?.search || '',
        categoryIds: parsedCategoryIds.length > 0 ? parsedCategoryIds : undefined,
      })
      .pipe(catchError(() => of({ items: [], total: 0, totalPages: 1, page: 1 })))
      .subscribe((res) => {
        const items: ProductListItem[] = Array.isArray(res?.items) ? res.items : [];

        if (parsedCategoryIds.length > 0 && page === 1 && items.length === 0 && fallbackKeywords.length > 0) {
          this.loadProductsByKeywords(fallbackKeywords, 1);
          return;
        }

        this.products = items;
        this.currentPage = Number(res?.page) || 1;
        this.totalPages = Number(res?.totalPages) || 1;
        this.totalItems = Number(res?.total) || 0;
        this.loading = false;
        this.cdr.detectChanges();
      });
  }

  private loadProductsByKeywords(keywords: string[], page: number): void {
    this.loading = true;

    this.productDataService
      .getProducts(1, 500, {
        sortBy: 'bestSelling',
        order: 'desc',
      })
      .pipe(catchError(() => of({ items: [] })))
      .subscribe((res) => {
        const allItems: ProductListItem[] = Array.isArray(res?.items) ? res.items : [];
        const filteredItems =
          keywords.length > 0
            ? allItems.filter((item) => this.matchesKeywords(item?.name || '', keywords))
            : allItems;

        this.localFilteredProducts = filteredItems;
        this.applyLocalPagination(page);
      });
  }

  private finishWithEmptyState(): void {
    this.products = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalItems = 0;
    this.localFilteredProducts = [];
    this.loading = false;
    this.cdr.detectChanges();
  }

  private applyLocalPagination(page: number): void {
    const source = this.localFilteredProducts || [];
    this.totalItems = source.length;
    this.totalPages = Math.max(Math.ceil(this.totalItems / this.limit), 1);
    this.currentPage = Math.min(Math.max(page, 1), this.totalPages);

    const start = (this.currentPage - 1) * this.limit;
    this.products = source.slice(start, start + this.limit);
    this.loading = false;
    this.cdr.detectChanges();
  }

  private getKeywordFilters(slug: string, name: string): string[] {
    if (slug && KEYWORDS_BY_SLUG[slug]) {
      return KEYWORDS_BY_SLUG[slug].map((keyword) => this.normalizeText(keyword)).filter(Boolean);
    }

    if (!name) {
      return [];
    }

    return [this.normalizeText(name)].filter(Boolean);
  }

  private matchesKeywords(name: string, keywords: string[]): boolean {
    if (!keywords.length) {
      return true;
    }

    const normalizedName = this.normalizeText(name);
    return keywords.some((keyword) => normalizedName.includes(keyword));
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private parseCategoryIds(categoryIds: string): string[] {
    return String(categoryIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }

    if (this.localFilteredProducts) {
      this.applyLocalPagination(page);
      this.scrollToCategorySection();
      return;
    }

    const ids = this.category ? this.category._id : this.categoryIds;
    const params = this.route.snapshot.queryParams;
    this.loadProducts(ids, page, this.keywordFilters, { 
      sort: params['sort'], 
      order: params['order'], 
      search: params['q'] 
    });
    this.scrollToCategorySection();
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i += 1) {
      pages.push(i);
    }
    return pages;
  }

  formatPrice(price: number): string {
    if (!price) {
      return '';
    }

    return `${new Intl.NumberFormat('vi-VN').format(price)}\u0111`;
  }

  private scrollToCategorySection(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    setTimeout(() => {
      this.cdr.detectChanges(); // Ensure DOM is updated before measuring
      const section = this.categorySectionRef?.nativeElement;
      if (!section) {
        return;
      }
      const top = section.getBoundingClientRect().top + window.scrollY - this.getStickyHeaderOffset();
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }, 100); // Small delay to ensure layout is stable
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
