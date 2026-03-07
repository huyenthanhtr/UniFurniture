import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, finalize } from 'rxjs';
import { ProductFilterComponent } from '../../shared/product-filter/product-filter';
import { ProductSortComponent } from '../../shared/product-sort/product-sort';
import { ProductGridComponent } from '../../shared/product-grid/product-grid';
import { ProductDataService, ProductListItem } from '../../services/product-data.service';

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
  private loadingGuard: ReturnType<typeof setTimeout> | null = null;

  readonly products = signal<ProductListItem[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');

  readonly currentPage = signal(1);
  readonly totalItems = signal(0);
  readonly totalPages = signal(1);
  readonly pageSize = 24;

  readonly pageNumbers = computed(() => {
    return Array.from({ length: this.totalPages() }, (_, index) => index + 1);
  });

  ngOnInit(): void {
    this.loadProducts(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.loadProducts(page);
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

  private loadProducts(page: number): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.clearLoadingGuard();
    this.loadingGuard = setTimeout(() => {
      this.isLoading.set(false);
      this.errorMessage.set('Tai du lieu qua lau. Vui long thu lai.');
    }, 12000);

    this.productDataService
      .getProducts(page, this.pageSize)
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

  private clearLoadingGuard(): void {
    if (this.loadingGuard !== null) {
      clearTimeout(this.loadingGuard);
      this.loadingGuard = null;
    }
  }
}
