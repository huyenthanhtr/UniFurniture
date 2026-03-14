import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminProductsService } from '../../services/admin-products';

type ProductStatus = 'active' | 'inactive';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-products.html',
  styleUrls: ['./admin-products.css'],
})
export class AdminProducts implements OnInit, OnDestroy {
  private api = inject(AdminProductsService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;

  products: any[] = [];
  categoryMap = new Map<string, string>();
  collectionMap = new Map<string, string>();

  filter = {
    search: '',
    status: '',
  };

  sortConfig: { column: string; direction: SortDirection } = {
    column: '',
    direction: 'asc',
  };

  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;

  showConfirmPopup = false;
  showResultPopup = false;
  confirmMessage = '';
  resultMessage = { title: '', message: '', type: 'success' as 'success' | 'error' };

  pendingStatusChange: { product: any; nextStatus: ProductStatus; prevStatus: ProductStatus } | null = null;
  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadLookupsAndProducts();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceId) {
      clearTimeout(this.searchDebounceId);
      this.searchDebounceId = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target || !this.sortConfig.column) return;

    const clickedSortableHeader = target.closest('th.sortable');
    if (clickedSortableHeader) return;

    this.resetSortToDefault();
  }

  loadLookupsAndProducts(): void {
    this.isLoading = true;

    forkJoin({
      categories: this.api.getCategories({ limit: 500, fields: 'name' }),
      collections: this.api.getCollections({ limit: 500, fields: 'name' }),
    }).subscribe({
      next: (res: any) => {
        const categoryItems = res.categories?.items ?? res.categories ?? [];
        const collectionItems = res.collections?.items ?? res.collections ?? [];

        this.categoryMap.clear();
        categoryItems.forEach((item: any) => this.categoryMap.set(String(item._id), item.name));

        this.collectionMap.clear();
        collectionItems.forEach((item: any) => this.collectionMap.set(String(item._id), item.name));

        this.loadProductsPage(1);
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadProductsPage(page: number): void {
    this.isLoading = true;
    this.page = Math.max(1, page);

    const params: any = {
      page: this.page,
      limit: this.limit,
      exclude: 'description,short_description,material,size',
    };

    const { sortBy, order } = this.getSortParams();
    if (sortBy) {
      params.sortBy = sortBy;
      params.order = order;
    }

    if (this.filter.status) params.status = this.filter.status;
    if (this.filter.search.trim()) params.q = this.filter.search.trim();

    this.api.getProducts(params).subscribe({
      next: (res: any) => {
        const items = res?.items ?? res ?? [];
        this.total = Number(res?.total ?? items.length ?? 0);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.limit));
        this.products = items.map((product: any) => ({
          ...product,
          _selectedStatus: this.normalizeStatus(product.status),
        }));
        this.applyLocalSortIfNeeded();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  onSearchChange(): void {
    if (this.searchDebounceId) clearTimeout(this.searchDebounceId);
    this.searchDebounceId = setTimeout(() => {
      this.page = 1;
      this.loadProductsPage(1);
    }, 300);
  }

  applyFilters(): void {
    this.page = 1;
    this.loadProductsPage(1);
  }

  resetFilters(): void {
    this.filter = {
      search: '',
      status: '',
    };
    this.sortConfig = { column: '', direction: 'asc' };
    this.page = 1;
    this.loadProductsPage(1);
  }

  toggleSort(column: string): void {
    if (this.sortConfig.column === column) {
      this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortConfig = { column, direction: 'asc' };
    }

    this.page = 1;
    this.loadProductsPage(1);
  }

  resetSortToDefault(): void {
    this.sortConfig = { column: '', direction: 'asc' };
    this.page = 1;
    this.loadProductsPage(1);
  }

  askStatusChange(product: any, nextStatus: string): void {
    const prevStatus = this.normalizeStatus(product.status);
    const normalizedNext = this.normalizeStatus(nextStatus);

    if (!product?._id || normalizedNext === prevStatus) {
      product._selectedStatus = prevStatus;
      return;
    }

    product._selectedStatus = normalizedNext;
    this.pendingStatusChange = { product, nextStatus: normalizedNext, prevStatus };
    this.confirmMessage = `Bạn có chắc muốn chuyển "${product.name}" sang "${this.statusLabel(normalizedNext)}" không?`;
    this.showConfirmPopup = true;
  }

  executeStatusChange(): void {
    if (!this.pendingStatusChange) return;

    const { product, nextStatus } = this.pendingStatusChange;
    this.showConfirmPopup = false;
    this.isLoading = true;

    this.api.patchProduct(String(product._id), { status: nextStatus }).subscribe({
      next: (updated: any) => {
        product.status = this.normalizeStatus(updated?.status || nextStatus);
        product._selectedStatus = product.status;
        this.pendingStatusChange = null;
        this.isLoading = false;
        this.showResult('Thành công', 'Đã cập nhật trạng thái sản phẩm.', 'success');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        product._selectedStatus = this.normalizeStatus(product.status);
        this.pendingStatusChange = null;
        this.isLoading = false;
        this.showResult('Thất bại', err?.error?.error || 'Không đổi được trạng thái sản phẩm.', 'error');
        this.cdr.detectChanges();
      },
    });
  }

  cancelConfirm(): void {
    if (this.pendingStatusChange) {
      const { product, prevStatus } = this.pendingStatusChange;
      product._selectedStatus = prevStatus;
    }
    this.pendingStatusChange = null;
    this.showConfirmPopup = false;
  }

  showResult(title: string, message: string, type: 'success' | 'error'): void {
    this.resultMessage = { title, message, type };
    this.showResultPopup = true;
  }

  viewDetail(product: any): void {
    this.router.navigate(['/admin/products', product._id]);
  }

  goNew(): void {
    this.router.navigate(['/admin/products/new']);
  }

  goEdit(product: any): void {
    this.router.navigate(['/admin/products', product._id, 'edit']);
  }

  categoryName(id: any): string {
    return this.categoryMap.get(String(id)) || '-';
  }

  collectionName(id: any): string {
    return this.collectionMap.get(String(id)) || '-';
  }

  statusLabel(status: any): string {
    const s = this.normalizeStatus(status);
    return s === 'inactive' ? 'Ngừng bán' : 'Đang bán';
  }

  getSortIconClass(column: string): string {
    if (this.sortConfig.column !== column) return 'fa-sort';
    return this.sortConfig.direction === 'asc' ? 'fa-sort-up active' : 'fa-sort-down active';
  }

  goPrev(): void {
    if (this.page > 1) this.loadProductsPage(this.page - 1);
  }

  goNext(): void {
    if (this.page < this.totalPages) this.loadProductsPage(this.page + 1);
  }

  goPage(p: any): void {
    const n = Number(p);
    if (!Number.isFinite(n)) return;
    if (n >= 1 && n <= this.totalPages) this.loadProductsPage(n);
  }

  pagesToShow(): (number | '...')[] {
    const total = this.totalPages;
    const cur = this.page;

    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const out: (number | '...')[] = [];
    out.push(1);

    const left = Math.max(2, cur - 1);
    const right = Math.min(total - 1, cur + 1);

    if (left > 2) out.push('...');
    for (let i = left; i <= right; i++) out.push(i);
    if (right < total - 1) out.push('...');

    out.push(total);
    return out;
  }

  private applyLocalSortIfNeeded(): void {
    if (!['category', 'collection'].includes(this.sortConfig.column)) return;

    const dir = this.sortConfig.direction === 'asc' ? 1 : -1;
    this.products = [...this.products].sort((left: any, right: any) => {
      const leftValue = this.sortConfig.column === 'category'
        ? this.categoryName(left.category_id)
        : this.collectionName(left.collection_id);
      const rightValue = this.sortConfig.column === 'category'
        ? this.categoryName(right.category_id)
        : this.collectionName(right.collection_id);

      return leftValue.localeCompare(rightValue, 'vi', { sensitivity: 'base' }) * dir;
    });
  }

  private getSortParams(): { sortBy?: string; order?: SortDirection } {
    const sortMap: Record<string, string> = {
      name: 'name',
      sku: 'sku',
      min_price: 'min_price',
      sold: 'sold',
      status: 'status',
    };

    const sortBy = sortMap[this.sortConfig.column];
    if (!sortBy) return {};

    return { sortBy, order: this.sortConfig.direction };
  }

  private normalizeStatus(status: any): ProductStatus {
    return String(status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
  }
}
