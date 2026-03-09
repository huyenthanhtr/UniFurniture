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
    this.router.navigate(['/admin/customers']);
  }

  viewAddress(address: any) {
    this.router.navigate(['/admin/customers', this.id, 'addresses', address._id]);
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

  accountStatusLabel(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'active') return '\u0110ang ho\u1ea1t \u0111\u1ed9ng';
    if (key === 'inactive') return 'T\u1ea1m ng\u01b0ng';
    if (key === 'banned') return 'B\u1ecb kh\u00f3a';
    return 'Kh\u00f4ng c\u00f3 t\u00e0i kho\u1ea3n';
  }

  genderLabel(gender: any): string {
    const key = String(gender || '').toLowerCase();
    if (key === 'male') return 'Nam';
    if (key === 'female') return 'N\u1eef';
    if (key === 'other') return 'Kh\u00e1c';
    return '-';
  }

  addressStatusLabel(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'active') return '\u0110ang s\u1eed d\u1ee5ng';
    if (key === 'inactive') return 'Ng\u1eebng s\u1eed d\u1ee5ng';
    return '-';
  }
}
