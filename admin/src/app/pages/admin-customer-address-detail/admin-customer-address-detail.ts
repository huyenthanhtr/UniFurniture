import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminCustomersService } from '../../services/admin-customers';

@Component({
  selector: 'app-admin-customer-address-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-customer-address-detail.html',
  styleUrls: ['./admin-customer-address-detail.css'],
})
export class AdminCustomerAddressDetail implements OnInit {
  private api = inject(AdminCustomersService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  customerId = '';
  addressId = '';
  isLoading = false;

  merged: any = null;
  address: any = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const customerId = pm.get('id');
      const addressId = pm.get('addressId');
      if (customerId && addressId) {
        this.customerId = customerId;
        this.addressId = addressId;
        this.load();
      }
    });
  }

  load() {
    this.isLoading = true;

    this.api.getCustomerAddressById(this.customerId, this.addressId).subscribe({
      next: (res: any) => {
        this.merged = res?.merged ?? null;
        this.address = res?.address ?? null;
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
    this.router.navigate(['/admin/customers', this.customerId], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  addressStatusLabel(status: any): string {
    const key = String(status || '').toLowerCase();
    if (key === 'active') return '\u0110ang s\u1eed d\u1ee5ng';
    if (key === 'inactive') return 'Ng\u1eebng s\u1eed d\u1ee5ng';
    return '-';
  }
}
