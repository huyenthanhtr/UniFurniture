import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { AdminProductsService } from '../../services/admin-products';

@Component({
  selector: 'app-admin-variant-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-variant-detail.html',
  styleUrls: ['./admin-variant-detail.css'],
})
export class AdminVariantDetail implements OnInit {
  private api = inject(AdminProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  id!: string;
  isLoading = false;

  variant: any = null;
  product: any = null;

  showConfirm = false;
  confirmMessage = '';
  confirmAction: null | (() => void) = null;

  form = this.fb.group({
    variant_name: ['', [Validators.required]],
    sku: [''],
    color: [''],
    price: [0],
    compare_at_price: [0],
    stock_quantity: [0],
    status: ['available'],
    variant_status: ['active'],
  });

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
    this.variant = null;
    this.product = null;
    this.cdr.detectChanges();

    this.api.getVariantById(this.id).subscribe({
      next: (v: any) => {
        this.variant = v;

        this.form.patchValue({
          variant_name: v.variant_name || v.name || '',
          sku: v.sku || '',
          color: v.color || '',
          price: v.price ?? 0,
          compare_at_price: v.compare_at_price ?? 0,
          stock_quantity: v.stock_quantity ?? 0,
          status: v.status || 'available',
          variant_status: v.variant_status || 'active',
        });

        if (v.product_id) {
          this.api.getProductById(String(v.product_id)).subscribe({
            next: (p: any) => {
              this.product = p;
              this.cdr.detectChanges();
            },
            error: () => {},
          });
        }

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  backToProduct() {
    if (this.variant?.product_id) {
      this.router.navigate(['/admin/products', this.variant.product_id]);
    } else {
      this.router.navigate(['/admin/products']);
    }
  }

  askSave() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirmMessage = 'Lưu chỉnh sửa variant?';
    this.confirmAction = () => this.save();
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  save() {
    this.showConfirm = false;
    this.isLoading = true;
    this.cdr.detectChanges();

    const payload = this.form.getRawValue();
    this.api.updateVariant(this.id, payload).subscribe({
      next: () => this.load(),
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  askToggleStatus() {
    const cur = String(this.form.value.variant_status || 'active').toLowerCase();
    const next = cur === 'active' ? 'inactive' : 'active';
    const label = next.toUpperCase();

    this.confirmMessage = `Chuyển variant sang ${label}?`;
    this.confirmAction = () => this.toggleStatus(next);
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  toggleStatus(next: 'active' | 'inactive') {
    this.showConfirm = false;
    this.isLoading = true;
    this.cdr.detectChanges();

    this.api.patchVariant(this.id, { variant_status: next }).subscribe({
      next: () => this.load(),
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  closeConfirm() {
    this.showConfirm = false;
    this.confirmAction = null;
    this.cdr.detectChanges();
  }

  runConfirm() {
    if (this.confirmAction) this.confirmAction();
  }
}