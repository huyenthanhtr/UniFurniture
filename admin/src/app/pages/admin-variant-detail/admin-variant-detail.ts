import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
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
  images: any[] = [];
  variantImages: any[] = [];
  thumbnail = '';

  showConfirm = false;
  confirmMessage = '';
  confirmAction: null | (() => void) = null;
  showLeaveConfirm = false;
  private pendingLeaveResolver: ((ok: boolean) => void) | null = null;

  form = this.fb.group({
    variant_name: ['', [Validators.required]],
    sku: ['', [Validators.required]],
    color: [''],
    price: [0, [Validators.required]],
    compare_at_price: [0],
    stock_quantity: [0],
    variant_status: ['active'],
    sold: [0],
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

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.form.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.form.dirty) return true;
    if (this.showLeaveConfirm) return false;
    this.showLeaveConfirm = true;
    return new Promise<boolean>((resolve) => {
      this.pendingLeaveResolver = resolve;
    });
  }

  sortImages(arr: any[]) {
    return [...arr].sort((a, b) => {
      if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
      const ao = Number(a.sort_order || 0);
      const bo = Number(b.sort_order || 0);
      if (ao !== bo) return ao - bo;
      const at = new Date(a.createdAt || 0).getTime();
      const bt = new Date(b.createdAt || 0).getTime();
      return at - bt;
    });
  }

  load() {
    this.isLoading = true;
    this.variant = null;
    this.product = null;
    this.images = [];
    this.variantImages = [];
    this.thumbnail = '';

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
          variant_status: v.variant_status || 'active',
          sold: v.sold ?? 0,
        });
        this.form.markAsPristine();

        forkJoin({
          product: this.api.getProductById(String(v.product_id)),
          images: this.api.getImages({ product_id: String(v.product_id), limit: 500 }),
        }).subscribe({
          next: (res: any) => {
            this.product = res.product;
            this.images = this.sortImages(res.images?.items ?? res.images ?? []);
            const own = this.images.filter((img: any) => String(img.variant_id || '') === String(this.variant._id));
            this.variantImages = own.length ? own : this.getFallbackImages();
            this.thumbnail =
              this.variantImages[0]?.image_url ||
              this.product?.thumbnail ||
              this.product?.thumbnail_url ||
              this.images[0]?.image_url ||
              '';

            this.isLoading = false;
            this.cdr.detectChanges();
          },
          error: () => {
            this.isLoading = false;
            this.cdr.detectChanges();
          },
        });
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  backToProduct() {
    if (this.product?.slug || this.variant?.product_id) {
      this.router.navigate(['/admin/products', this.product?.slug || this.variant.product_id]);
    }
    else this.router.navigate(['/admin/products']);
  }

  private getFallbackImages(): any[] {
    const fallbackUrl =
      this.sortImages(this.images.filter((img: any) => !img.variant_id))[0]?.image_url ||
      this.product?.thumbnail ||
      this.product?.thumbnail_url ||
      this.images[0]?.image_url ||
      '';

    return fallbackUrl
      ? [
          {
            _id: `fallback-${this.id}`,
            image_url: fallbackUrl,
            alt_text: this.variant?.variant_name || this.variant?.name || 'Bien the',
            is_primary: true,
            is_fallback: true,
          },
        ]
      : [];
  }

  selectThumbnail(imageUrl: string): void {
    this.thumbnail = String(imageUrl || '').trim();
  }

  normalizeImageUrl(value: any): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    if (raw.startsWith('/assets/upload/') || raw.startsWith('/uploads/')) return `http://localhost:3000${raw}`;
    return raw;
  }

  askSave() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirmMessage = 'Lưu chỉnh sửa biến thể?';
    this.confirmAction = () => this.save();
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  save() {
    this.showConfirm = false;
    this.isLoading = true;

    const raw = this.form.getRawValue();
    const payload = {
      product_id: this.variant.product_id,
      name: raw.variant_name,
      variant_name: raw.variant_name,
      sku: raw.sku,
      color: raw.color,
      price: Number(raw.price || 0),
      compare_at_price: Number(raw.compare_at_price || 0),
      stock_quantity: Number(raw.stock_quantity || 0),
      variant_status: raw.variant_status,
      sold: Number(raw.sold || 0),
    };

    this.api.updateVariant(this.id, payload).subscribe({
      next: () => {
        this.form.markAsPristine();
        this.load();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  askToggleStatus() {
    const cur = String(this.form.value.variant_status || 'active').toLowerCase();
    const next = cur === 'active' ? 'inactive' : 'active';
    this.confirmMessage = `Chuyển biến thể sang ${next === 'active' ? 'Đang bán' : 'Ngừng bán'}?`;
    this.confirmAction = () => this.toggleStatus(next as 'active' | 'inactive');
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  toggleStatus(next: 'active' | 'inactive') {
    this.showConfirm = false;
    this.isLoading = true;

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

  stayOnPage() {
    this.showLeaveConfirm = false;
    if (this.pendingLeaveResolver) {
      this.pendingLeaveResolver(false);
      this.pendingLeaveResolver = null;
    }
  }

  leavePage() {
    this.showLeaveConfirm = false;
    if (this.pendingLeaveResolver) {
      this.pendingLeaveResolver(true);
      this.pendingLeaveResolver = null;
    }
  }
}
