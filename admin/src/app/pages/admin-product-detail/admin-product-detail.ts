import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminProductsService } from '../../services/admin-products';

@Component({
  selector: 'app-admin-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
  galleryImages: any[] = [];
  variants: any[] = [];
  selectedImageUrl = '';
  selectedImage: any = null;

  showAddImageForm = false;

  newImage = {
    image_url: '',
    alt_text: '',
    sort_order: 0,
    is_primary: false,
    variant_id: '',
  };

  showConfirm = false;
  confirmMessage = '';
  confirmAction: null | (() => void) = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id');
      if (id) this.load(id);
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

  dedupeImagesByUrl(arr: any[]) {
    const map = new Map<string, any>();

    for (const img of this.sortImages(arr)) {
      const key = String(img.image_url || '').trim();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, img);
      }
    }

    return Array.from(map.values());
  }

  load(id: string) {
    this.isLoading = true;
    this.product = null;
    this.images = [];
    this.galleryImages = [];
    this.variants = [];
    this.selectedImageUrl = '';
    this.selectedImage = null;

    forkJoin({
      product: this.api.getProductById(id),
      images: this.api.getImages({ product_id: id, limit: 500 }),
      variants: this.api.getVariants({ product_id: id, limit: 200 }),
    }).subscribe({
      next: (res: any) => {
        this.product = res.product;
        this.images = this.sortImages(res.images?.items ?? res.images ?? []);
        this.galleryImages = this.dedupeImagesByUrl(this.images);
        this.variants = res.variants?.items ?? res.variants ?? [];

        this.selectedImageUrl =
          this.galleryImages.find((x: any) => x.is_primary)?.image_url ||
          this.galleryImages[0]?.image_url ||
          this.product?.thumbnail ||
          this.product?.thumbnail_url ||
          '';

        this.selectedImage =
          this.galleryImages.find((x: any) => x.image_url === this.selectedImageUrl) ||
          this.galleryImages[0] ||
          null;

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectImage(img: any) {
    this.selectedImage = { ...img };
    this.selectedImageUrl = img.image_url;
    this.showAddImageForm = false;
  }

  toggleAddImageForm() {
    this.showAddImageForm = !this.showAddImageForm;
    if (this.showAddImageForm) {
      this.selectedImage = null;
    }
  }

  goEdit() {
    this.router.navigate(['/admin/products', this.product._id, 'edit']);
  }

  getVariantLabel(v: any): string {
    return v.variant_name || v.name || 'Variant';
  }

  getVariantThumbnail(v: any): string {
    const own = this.sortImages(this.images.filter((img) => String(img.variant_id || '') === String(v._id)));
    if (own.length) return own[0].image_url;
    return this.product?.thumbnail || this.product?.thumbnail_url || this.galleryImages[0]?.image_url || '';
  }

  addImage() {
    if (!this.product?._id || !this.newImage.image_url.trim()) return;

    const payload = {
      product_id: this.product._id,
      variant_id: this.newImage.variant_id || null,
      image_url: this.newImage.image_url.trim(),
      alt_text: this.newImage.alt_text.trim(),
      sort_order: Number(this.newImage.sort_order || 0),
      is_primary: !!this.newImage.is_primary,
    };

    this.isLoading = true;
    this.api.createImage(payload).subscribe({
      next: () => {
        this.newImage = {
          image_url: '',
          alt_text: '',
          sort_order: 0,
          is_primary: false,
          variant_id: '',
        };
        this.showAddImageForm = false;
        this.load(String(this.product._id));
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  saveSelectedImage() {
    if (!this.selectedImage?._id) return;

    this.isLoading = true;
    this.api.updateImage(String(this.selectedImage._id), {
      product_id: this.product._id,
      variant_id: this.selectedImage.variant_id || null,
      image_url: this.selectedImage.image_url,
      alt_text: this.selectedImage.alt_text || '',
      sort_order: Number(this.selectedImage.sort_order || 0),
      is_primary: !!this.selectedImage.is_primary,
    }).subscribe({
      next: () => this.load(String(this.product._id)),
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  setPrimaryImage(img: any) {
    this.isLoading = true;
    this.api.patchImage(String(img._id), { is_primary: true }).subscribe({
      next: () => this.load(String(this.product._id)),
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  askDeleteImage(img: any) {
    this.confirmMessage = `Xóa ảnh này khỏi sản phẩm?`;
    this.confirmAction = () => this.deleteImage(img);
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  deleteImage(img: any) {
    this.showConfirm = false;
    this.isLoading = true;
    this.api.deleteImage(String(img._id)).subscribe({
      next: () => this.load(String(this.product._id)),
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  askToggleStatus() {
    const cur = String(this.product?.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active';
    const next = cur === 'active' ? 'inactive' : 'active';
    this.confirmMessage = `Chuyển sản phẩm sang ${next.toUpperCase()}?`;
    this.confirmAction = () => this.toggleStatus(next as 'active' | 'inactive');
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  toggleStatus(next: 'active' | 'inactive') {
    this.showConfirm = false;
    this.isLoading = true;

    this.api.patchProduct(String(this.product._id), { status: next }).subscribe({
      next: () => this.load(String(this.product._id)),
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  askToggleVariant(v: any) {
    const cur = String(v.variant_status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
    const next = cur === 'active' ? 'inactive' : 'active';
    this.confirmMessage = `Chuyển variant "${this.getVariantLabel(v)}" sang ${next.toUpperCase()}?`;
    this.confirmAction = () => this.toggleVariant(v, next as 'active' | 'inactive');
    this.showConfirm = true;
    this.cdr.detectChanges();
  }

  toggleVariant(v: any, next: 'active' | 'inactive') {
    this.showConfirm = false;
    this.isLoading = true;

    this.api.patchVariant(String(v._id), { variant_status: next }).subscribe({
      next: () => this.load(String(this.product._id)),
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  viewVariant(v: any) {
    this.router.navigate(['/admin/variants', v._id]);
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