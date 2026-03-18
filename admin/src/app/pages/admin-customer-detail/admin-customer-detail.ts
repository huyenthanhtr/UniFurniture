import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AdminCustomersService } from '../../services/admin-customers';

@Component({
  selector: 'app-admin-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-customer-detail.html',
  styleUrls: ['./admin-customer-detail.css'],
})
export class AdminCustomerDetail implements OnInit {
  private api = inject(AdminCustomersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  id!: string;
  isLoading = false;

  merged: any = null;
  customer: any = null;
  profile: any = null;
  addresses: any[] = [];

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id');
      if (id) {
        this.id = id;
        this.load();
      }
    });
  }

  load() {
    this.isLoading = true;

    this.api.getCustomerById(this.id).subscribe({
      next: (res: any) => {
        this.merged = res?.merged ?? null;
        this.customer = res?.customer ?? null;
        this.profile = res?.profile ?? null;
        this.addresses = res?.addresses ?? [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  back() {
    this.router.navigate(['/admin/customers'], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  get visibleAddresses(): any[] {
    if (!Array.isArray(this.addresses) || this.addresses.length === 0) return [];
    if (this.merged?.has_account && this.addresses.length > 1) {
      return [this.addresses[0]];
    }
    return this.addresses;
  }

  viewAddress(address: any) {
    this.router.navigate(['/admin/customers', this.id, 'addresses', address._id], {
      queryParams: this.route.snapshot.queryParams,
    });
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

  genderLabel(gender: any): string {
    const key = String(gender || '').toLowerCase();
    if (key === 'male') return 'Nam';
    if (key === 'female') return 'N\u1eef';
    if (key === 'other') return 'Kh\u00e1c';
    return '-';
  }

  addressStatusLabel(): string {
    return '\u0110ang s\u1eed d\u1ee5ng';
  }
}
