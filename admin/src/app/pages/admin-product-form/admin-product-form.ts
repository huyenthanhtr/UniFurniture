import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminProductsService } from '../../services/admin-products';

@Component({
  selector: 'app-admin-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './admin-product-form.html',
  styleUrls: ['./admin-product-form.css'],
})
export class AdminProductForm implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(AdminProductsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isEdit = false;
  id: string | null = null;
  isLoading = false;

  categories: any[] = [];
  collections: any[] = [];

  showConfirm = false;
  confirmMessage = '';
  confirmAction: null | (() => void) = null;

  form = this.fb.group({
    name: ['', [Validators.required]],
    sku: [''],
    brand: [''],
    status: ['active', [Validators.required]],
    category_id: ['', [Validators.required]],
    collection_id: [''],
    product_type: [''],
    url: [''],
    short_description: [''],
    description: [''],
  });

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id');
    this.isEdit = !!this.id;
    this.isLoading = true;

    const reqs: any = {
      categories: this.api.getCategories({ limit: 500 }),
      collections: this.api.getCollections({ limit: 500 }),
    };

    if (this.isEdit) reqs.product = this.api.getProductById(this.id!);

    forkJoin(reqs).subscribe({
      next: (res: any) => {
        this.categories = res.categories?.items ?? res.categories ?? [];
        this.collections = res.collections?.items ?? res.collections ?? [];

        if (this.isEdit && res.product) {
          this.form.patchValue({
            name: res.product.name ?? '',
            sku: res.product.sku ?? '',
            brand: res.product.brand ?? '',
            status: res.product.status ?? 'active',
            category_id: String(res.product.category_id ?? ''),
            collection_id: String(res.product.collection_id ?? ''),
            product_type: res.product.product_type ?? '',
            url: res.product.url ?? '',
            short_description: res.product.short_description ?? '',
            description: res.product.description ?? '',
          });
        }

        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
    });
  }

  get liveSlug(): string {
    return this.slugify(String(this.form.value.name || ''));
  }

  slugify(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }

  back() {
    if (this.isEdit) this.router.navigate(['/admin/products', this.id]);
    else this.router.navigate(['/admin/products']);
  }

  askSave() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.confirmMessage = this.isEdit ? 'Lưu chỉnh sửa sản phẩm?' : 'Tạo sản phẩm mới?';
    this.confirmAction = () => this.save();
    this.showConfirm = true;
  }

  save() {
    this.showConfirm = false;
    this.isLoading = true;

    const raw = this.form.getRawValue();

    const payload = {
      ...raw,
      category_id: raw.category_id || null,
      collection_id: raw.collection_id || null,
    };

    const req = this.isEdit
      ? this.api.updateProduct(this.id!, payload)
      : this.api.createProduct(payload);

    req.subscribe({
      next: (doc: any) => {
        this.isLoading = false;
        const newId = doc?._id || this.id;
        if (newId) this.router.navigate(['/admin/products', newId]);
        else this.router.navigate(['/admin/products']);
      },
      error: () => (this.isLoading = false),
    });
  }

  closeConfirm() {
    this.showConfirm = false;
    this.confirmAction = null;
  }

  runConfirm() {
    if (this.confirmAction) this.confirmAction();
  }
}