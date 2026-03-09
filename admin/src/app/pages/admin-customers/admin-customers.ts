import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
export class AdminCustomers implements OnInit {
  private api = inject(AdminCustomersService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  customers: any[] = [];

  q = '';
  status = '';
  customerType = '';
  sortBy: 'updatedAt' | 'full_name' | 'address_count' = 'updatedAt';
  sortDir: 'asc' | 'desc' = 'desc';

  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;

  ngOnInit(): void {
    this.loadCustomers(1);
  }

  loadCustomers(page: number) {
    this.isLoading = true;
    this.page = Math.max(1, page);

    const params: any = {
      page: this.page,
      limit: this.limit,
      sortBy: this.sortBy,
      order: this.sortDir,
    };

    if (this.q.trim()) params.q = this.q.trim();
    if (this.status) params.status = this.status;
    if (this.customerType) params.customer_type = this.customerType;

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

  applySearch() {
    this.page = 1;
    this.loadCustomers(1);
  }

  onChangeFilters() {
    this.page = 1;
    this.loadCustomers(1);
  }

  viewDetail(customer: any) {
    this.router.navigate(['/admin/customers', customer._id]);
  }

  goPrev() {
    if (this.page > 1) this.loadCustomers(this.page - 1);
  }

  goNext() {
    if (this.page < this.totalPages) this.loadCustomers(this.page + 1);
  }

  goPage(p: any) {
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

  customerTypeLabel(type: any): string {
    const key = String(type || '').toLowerCase();
    if (key === 'guest') return 'Kh\u00e1ch v\u00e3ng lai';
    if (key === 'member') return 'C\u00f3 t\u00e0i kho\u1ea3n';
    return '-';
  }

  customerStatusLabel(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'active') return '\u0110ang ho\u1ea1t \u0111\u1ed9ng';
    if (key === 'inactive') return 'Ng\u1eebng ho\u1ea1t \u0111\u1ed9ng';
    return '-';
  }
}
