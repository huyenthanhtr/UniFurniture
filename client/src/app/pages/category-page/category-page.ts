import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ProductsService } from '../../services/product/product';
import { ProductCardComponent } from '../../shared/product-card/product-card';
import { forkJoin, of, timer, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';

const BASE_URL = 'http://localhost:3000/api';

interface Category {
    _id: string;
    name: string;
    slug: string;
    image_url?: string;
    description?: string;
}

@Component({
    selector: 'app-category-page',
    standalone: true,
    imports: [CommonModule, RouterLink, ProductCardComponent],
    templateUrl: './category-page.html',
    styleUrl: './category-page.css',
})
export class CategoryPageComponent implements OnInit, OnDestroy {
    category: Category | null = null;
    products: any[] = [];
    loading = true;
    error = '';

    currentPage = 1;
    totalPages = 1;
    totalItems = 0;
    readonly limit = 16;

    groupTitle = '';
    categoryIds = '';   // comma-separated IDs

    slideshowImages: string[] = [];
    currentSlideIndex = 0;
    private slideSubscription?: Subscription;

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private productsService: ProductsService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.route.queryParams.subscribe(params => {
            this.groupTitle = params['title'] || '';
            this.categoryIds = params['categories'] || '';
            const slug = params['slug'] || '';

            this.stopSlideshow();
            this.slideshowImages = [];
            this.category = null;

            if (slug) {
                // Fetch banner for single category asynchronously
                this.loadBySlug(slug);
            } else if (this.categoryIds) {
                // Fetch banner for multi-category asynchronously
                this.loadMultiCategoryBanner(this.categoryIds);
            }

            // ALWAYS load products immediately (parallel with banner)
            // If we have categoryIds (group), use it. 
            // If we only have slug... wait, `loadProducts` needs the _id which we don't have yet.
            // So if we ONLY have slug, we MUST fetch category first to get _id.

            if (this.categoryIds) {
                this.loadProducts(this.categoryIds, 1);
            } else if (slug) {
                // We have no choice but to wait for slug -> _id mapping
            } else {
                // fallback to load all
                this.loadProducts('', 1);
            }
        });
    }

    ngOnDestroy() {
        this.stopSlideshow();
    }

    loadBySlug(slug: string) {
        // We only show loading for banner if we don't have products loading
        const isStandalone = !this.categoryIds;
        if (isStandalone) this.loading = true;

        this.http
            .get<any>(`${BASE_URL}/categories?slug=${slug}&limit=1`)
            .pipe(catchError(() => of({ items: [] })))
            .subscribe(res => {
                const items: Category[] = res.items || [];
                this.category = items[0] || null;

                // Single banner
                if (this.category && this.category.image_url) {
                    this.slideshowImages = [this.category.image_url];
                }

                if (isStandalone && this.category) {
                    this.loadProducts(this.category._id, 1);
                } else if (isStandalone) {
                    this.loading = false;
                }
            });
    }

    loadMultiCategoryBanner(categoryIds: string) {
        // Runs in background, doesn't block UI
        this.http.get<any>(`${BASE_URL}/categories?limit=100`)
            .pipe(catchError(() => of({ items: [] })))
            .subscribe(res => {
                const allCats: Category[] = res.items || [];
                const idsList = categoryIds.split(',');
                const matchedCats = allCats.filter(c => idsList.includes(c._id) && c.image_url);

                this.slideshowImages = matchedCats.map(c => c.image_url as string);

                if (this.slideshowImages.length > 1) {
                    this.startSlideshow();
                }
                this.cdr.detectChanges();
            });
    }

    startSlideshow() {
        this.currentSlideIndex = 0;
        this.slideSubscription = timer(2000, 2000).subscribe(() => {
            this.currentSlideIndex = (this.currentSlideIndex + 1) % this.slideshowImages.length;
            this.cdr.detectChanges();
        });
    }

    stopSlideshow() {
        if (this.slideSubscription) {
            this.slideSubscription.unsubscribe();
            this.slideSubscription = undefined;
        }
    }

    loadProducts(categoryIds: string, page: number) {
        this.loading = true;
        this.productsService
            .getProducts({
                page,
                limit: this.limit,
                sortBy: 'bestSelling',
                order: 'desc',
                category: categoryIds,
            })
            .pipe(catchError(() => of({ items: [], total: 0, totalPages: 1, page: 1 })))
            .subscribe(res => {
                this.products = (res.items || []).map((p: any) => this.mapProduct(p));
                this.currentPage = res.page || 1;
                this.totalPages = res.totalPages || 1;
                this.totalItems = res.total || 0;
                this.loading = false;
                this.cdr.detectChanges();
            });
    }

    mapProduct(p: any): any {
        return {
            _id: p._id,
            name: p.name,
            imageUrl: p.thumbnail || p.thumbnail_url || 'assets/images/placeholder.png',
            price: p.min_price || p.price || 0,
            originalPrice: null,
            soldCount: p.sold ?? 0,
            discountBadge: null,
            reviewsCount: 0,
            colors: [],
        };
    }

    goToPage(page: number) {
        if (page < 1 || page > this.totalPages) return;
        const ids = this.category ? this.category._id : this.categoryIds;
        this.loadProducts(ids, page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    get pageNumbers(): number[] {
        const pages: number[] = [];
        for (let i = 1; i <= this.totalPages; i++) pages.push(i);
        return pages;
    }

    formatPrice(price: number): string {
        if (!price) return '';
        return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
    }
}

