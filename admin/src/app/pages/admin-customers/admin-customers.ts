import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminCustomersService } from '../../services/admin-customers';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-customers.html',
  styleUrls: ['./admin-customers.css'],
})
export class AdminCustomers implements OnInit, OnDestroy {
  private api = inject(AdminCustomersService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  customers: any[] = [];

  filter = {
    search: '',
    status: '',
    customerType: '',
    startDate: '',
    endDate: '',
  };

  sortConfig: { column: string; direction: 'asc' | 'desc' } = {
    column: '',
    direction: 'asc',
  };

  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;

  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadCustomers(1);
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

  loadCustomers(page: number): void {
    this.isLoading = true;
    this.page = Math.max(1, page);

    const params: any = {
      page: this.page,
      limit: this.limit,
    };

    const { sortBy, order } = this.getSortParams();
    if (sortBy) {
      params.sortBy = sortBy;
      params.order = order;
    }

    if (this.filter.search.trim()) params.q = this.filter.search.trim();
    if (this.filter.status) params.status = this.filter.status;
    if (this.filter.customerType) params.customer_type = this.filter.customerType;
    if (this.filter.startDate) params.startDate = this.filter.startDate;
    if (this.filter.endDate) params.endDate = this.filter.endDate;

    this.api.getCustomers(params).subscribe({
      next: (res: any) => {
        const items = res?.items ?? [];
        this.customers = items;
        this.total = Number(res?.total ?? items.length ?? 0);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.limit));
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
      this.loadCustomers(1);
    }, 300);
  }

  applySearch(): void {
    this.page = 1;
    this.loadCustomers(1);
  }

  onChangeFilters(): void {
    this.page = 1;
    this.loadCustomers(1);
  }

  resetFilters(): void {
    this.filter = {
      search: '',
      status: '',
      customerType: '',
      startDate: '',
      endDate: '',
    };
    this.sortConfig = { column: '', direction: 'asc' };
    this.page = 1;
    this.loadCustomers(1);
  }

  toggleSort(column: string): void {
    if (this.sortConfig.column === column) {
      this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortConfig = { column, direction: 'asc' };
    }

    this.page = 1;
    this.loadCustomers(1);
  }

  resetSortToDefault(): void {
    this.sortConfig = { column: '', direction: 'asc' };
    this.page = 1;
    this.loadCustomers(1);
  }

  viewDetail(customer: any): void {
    this.router.navigate(['/admin/customers', customer._id]);
  }

  goPrev(): void {
    if (this.page > 1) this.loadCustomers(this.page - 1);
  }

  goNext(): void {
    if (this.page < this.totalPages) this.loadCustomers(this.page + 1);
  }

  goPage(p: any): void {
    const n = Number(p);
    if (!Number.isFinite(n)) return;
    if (n >= 1 && n <= this.totalPages) this.loadCustomers(n);
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

  getSortIconClass(column: string): string {
    if (this.sortConfig.column !== column) return 'fa-sort';
    return this.sortConfig.direction === 'asc' ? 'fa-sort-up active' : 'fa-sort-down active';
  }

  customerTypeLabel(type: any): string {
    const key = String(type || '').toLowerCase();
    if (key === 'guest') return 'Khách vãng lai';
    if (key === 'member') return 'Có tài khoản';
    return '-';
  }

  customerStatusLabel(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'active') return 'Đang hoạt động';
    if (key === 'inactive') return 'Ngừng hoạt động';
    return '-';
  }

  private getSortParams(): { sortBy?: string; order?: 'asc' | 'desc' } {
    const sortMap: Record<string, string> = {
      customer_code: 'customer_code',
      full_name: 'full_name',
      customer_type: 'customer_type',
      status: 'status',
      address_count: 'address_count',
      updatedAt: 'updatedAt',
    };

    const sortBy = sortMap[this.sortConfig.column];
    if (!sortBy) return {};

    return { sortBy, order: this.sortConfig.direction };
  }
}
