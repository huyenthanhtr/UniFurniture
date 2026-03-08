import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminProductsService } from '../../services/admin-products';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-products.html',
  styleUrls: ['./admin-products.css'],
})
export class AdminProducts implements OnInit {
  private api = inject(AdminProductsService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;

  products: any[] = [];
  filtered: any[] = [];

  categoryMap = new Map<string, string>();
  collectionMap = new Map<string, string>();

  q = '';
  status = 'active';
  sortDir: 'asc' | 'desc' = 'desc';

  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;

  showConfirm = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmAction: null | (() => void) = null;

  pendingProductId: string | null = null;
  pendingNextStatus: 'active' | 'inactive' | null = null;
  pendingPrevStatus: 'active' | 'inactive' | null = null;

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll() {
    this.isLoading = true;

    forkJoin({
      categories: this.api.getCategories({ limit: 500, fields: 'name' }),
      collections: this.api.getCollections({ limit: 500, fields: 'name' }),
    }).subscribe({
      next: (res: any) => {
        const categoryItems = res.categories?.items ?? res.categories ?? [];
        const collectionItems = res.collections?.items ?? res.collections ?? [];

        this.categoryMap.clear();
        categoryItems.forEach((c: any) => this.categoryMap.set(String(c._id), c.name));

        this.collectionMap.clear();
        collectionItems.forEach((c: any) => this.collectionMap.set(String(c._id), c.name));

        this.page = 1;
        this.loadProductsPage(1);
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadProductsPage(page: number) {
    this.isLoading = true;
    this.page = Math.max(1, page);

    const params: any = {
      page: this.page,
      limit: this.limit,
      exclude: 'description,short_description,material,size',
      sort: '-updatedAt',
    };

    if (this.status) params.status = this.status;

    this.api.getProducts(params).subscribe({
      next: (res: any) => {
        const items = res?.items ?? res ?? [];
        this.total = Number(res?.total ?? items.length ?? 0);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.limit));

        this.products = items;
        this.applyFilterSort();

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  applyFilterSort() {
    const q = this.q.trim().toLowerCase();
    let arr = [...this.products];

    if (q) {
      arr = arr.filter(
        (p) =>
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.sku || '').toLowerCase().includes(q)
      );
    }

    arr.sort((a, b) => {
      const av = a.updatedAt || '';
      const bv = b.updatedAt || '';

      if (av < bv) return this.sortDir === 'asc' ? -1 : 1;
      if (av > bv) return this.sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    this.filtered = arr;
  }

  toggleSortUpdatedAt() {
    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    this.applyFilterSort();
  }

  onChangeStatus() {
    this.page = 1;
    this.loadProductsPage(1);
  }

  viewDetail(p: any) {
    this.router.navigate(['/admin/products', p._id]);
  }

  goNew() {
    this.router.navigate(['/admin/products/new']);
  }

  goEdit(p: any) {
    this.router.navigate(['/admin/products', p._id, 'edit']);
  }

  askToggleStatus(p: any) {
    const cur = String(p.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
    const next: 'active' | 'inactive' = cur === 'active' ? 'inactive' : 'active';
    const label = next.toUpperCase();

    this.pendingProductId = String(p._id);
    this.pendingPrevStatus = cur;
    this.pendingNextStatus = next;

    this.confirmTitle = 'Xác nhận';
    this.confirmMessage = `Bạn có chắc muốn chuyển "${p.name}" sang ${label} không?`;
    this.confirmAction = () => this.toggleStatus();
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  toggleStatus() {
    if (!this.pendingProductId || !this.pendingNextStatus || !this.pendingPrevStatus) return;

    const id = this.pendingProductId;
    const next = this.pendingNextStatus;
    const prev = this.pendingPrevStatus;

    this.showConfirm = false;

    const row = this.products.find((x) => String(x._id) === id);
    if (row) row.status = next;
    this.applyFilterSort();

    this.isLoading = true;
    this.cdr.detectChanges();

    this.api.patchProduct(id, { status: next }).subscribe({
      next: (updated: any) => {
        if (updated && typeof updated === 'object' && updated._id) {
          const uStatus = String(updated.status || '').toLowerCase();
          if (row) row.status = uStatus === 'inactive' ? 'inactive' : 'active';
          this.applyFilterSort();
        }

        this.pendingProductId = null;
        this.pendingNextStatus = null;
        this.pendingPrevStatus = null;

        this.isLoading = false;
        this.cdr.detectChanges();

        this.loadProductsPage(this.page);
      },
      error: () => {
        if (row) row.status = prev;
        this.applyFilterSort();

        this.pendingProductId = null;
        this.pendingNextStatus = null;
        this.pendingPrevStatus = null;

        this.isLoading = false;
        this.cdr.detectChanges();

        alert('Không đổi được trạng thái sản phẩm. Kiểm tra API /products PATCH trên server.');
      },
    });
  }

  closeConfirm() {
    this.showConfirm = false;
    this.confirmAction = null;
    this.pendingProductId = null;
    this.pendingNextStatus = null;
    this.pendingPrevStatus = null;
    this.cdr.detectChanges();
  }

  runConfirm() {
    if (this.confirmAction) this.confirmAction();
  }

  categoryName(id: any) {
    return this.categoryMap.get(String(id)) || '-';
  }

  collectionName(id: any) {
    return this.collectionMap.get(String(id)) || '-';
  }

  goPrev() {
    if (this.page > 1) this.loadProductsPage(this.page - 1);
  }

  goNext() {
    if (this.page < this.totalPages) this.loadProductsPage(this.page + 1);
  }

  goPage(p: any) {
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
}