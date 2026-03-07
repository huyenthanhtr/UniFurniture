import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminProductsService } from '../../services/admin-products';

@Component({
  selector: 'app-admin-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-product-detail.html',
  styleUrls: ['./admin-product-detail.css'],
})
export class AdminProductDetail implements OnInit {
  private api = inject(AdminProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  product: any = null;
  images: any[] = [];
  variants: any[] = [];

  selectedImageUrl = '';

  showConfirm = false;
  confirmMessage = '';
  confirmAction: null | (() => void) = null;

  pendingNextStatus: 'active' | 'inactive' | null = null;
  pendingPrevStatus: 'active' | 'inactive' | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id');
      if (id) this.load(id);
    });
  }

  load(id: string) {
    this.isLoading = true;
    this.product = null;
    this.images = [];
    this.variants = [];
    this.selectedImageUrl = '';
    this.cdr.detectChanges();

    forkJoin({
      product: this.api.getProductById(id),
      images: this.api.getImages({ product_id: id, limit: 200 }),
      variants: this.api.getVariants({ product_id: id, limit: 200 }),
    }).subscribe({
      next: (res: any) => {
        this.product = res.product;
        this.images = res.images?.items ?? res.images ?? [];
        this.variants = res.variants?.items ?? res.variants ?? [];

        const primary = this.images.find((x: any) => x.is_primary);
        this.selectedImageUrl = primary?.image_url || this.images[0]?.image_url || '';

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectImage(url: string) {
    this.selectedImageUrl = url;
    this.cdr.detectChanges();
  }

  goEdit() {
    this.router.navigate(['/admin/products', this.product._id, 'edit']);
  }

  askToggleStatus() {
    const cur = String(this.product?.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
    const next: 'active' | 'inactive' = cur === 'active' ? 'inactive' : 'active';
    const label = next.toUpperCase();

    this.pendingPrevStatus = cur;
    this.pendingNextStatus = next;

    this.confirmMessage = `Bạn có chắc muốn chuyển sản phẩm sang ${label} không?`;
    this.confirmAction = () => this.toggleStatus();
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  toggleStatus() {
    if (!this.product?._id || !this.pendingNextStatus || !this.pendingPrevStatus) return;

    const id = String(this.product._id);
    const next = this.pendingNextStatus;
    const prev = this.pendingPrevStatus;

    this.showConfirm = false;

    this.product.status = next;
    this.cdr.detectChanges();

    this.isLoading = true;
    this.cdr.detectChanges();

    this.api.patchProduct(id, { status: next }).subscribe({
      next: (updated: any) => {
        const uStatus = String(updated?.status || '').toLowerCase();
        this.product.status = uStatus === 'inactive' ? 'inactive' : 'active';

        this.pendingNextStatus = null;
        this.pendingPrevStatus = null;

        this.isLoading = false;
        this.cdr.detectChanges();

        this.load(id);
      },
      error: () => {
        this.product.status = prev;

        this.pendingNextStatus = null;
        this.pendingPrevStatus = null;

        this.isLoading = false;
        this.cdr.detectChanges();

        alert('Không đổi được trạng thái sản phẩm. Kiểm tra API /products PATCH trên server.');
      },
    });
  }

  viewVariant(v: any) {
    this.router.navigate(['/admin/variants', v._id]);
  }

  closeConfirm() {
    this.showConfirm = false;
    this.confirmAction = null;
    this.pendingNextStatus = null;
    this.pendingPrevStatus = null;
    this.cdr.detectChanges();
  }

  runConfirm() {
    if (this.confirmAction) this.confirmAction();
  }

  askToggleVariant(v: any) {
    const cur = String(v.variant_status || '').toLowerCase() || 'active';
    const next = cur === 'active' ? 'inactive' : 'active';
    const label = next.toUpperCase();

    this.confirmMessage = `Bạn có chắc muốn chuyển variant "${v.variant_name || v.name}" sang ${label} không?`;
    this.confirmAction = () => this.toggleVariant(v, next);
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  toggleVariant(v: any, next: 'active' | 'inactive') {
    this.isLoading = true;
    this.showConfirm = false;
    this.cdr.detectChanges();

    this.api.patchVariant(String(v._id), { variant_status: next }).subscribe({
      next: () => this.load(String(this.product._id)),
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }
}