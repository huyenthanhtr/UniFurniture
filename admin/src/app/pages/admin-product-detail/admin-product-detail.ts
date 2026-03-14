import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminProductsService } from '../../services/admin-products';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

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
  private sanitizer = inject(DomSanitizer);

  isLoading = false;
  product: any = null;
  images: any[] = [];
  galleryImages: any[] = [];
  variants: any[] = [];
  selectedImageUrl = '';
  selectedImage: any = null;
  selectedVariant: any = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe((pm) => {
      const id = pm.get('id');
      if (id) this.load(id);
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('.thumbs') || target.closest('.image-panel') || target.closest('.main-image')) return;
    this.selectedImage = null;
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
      if (!map.has(key)) map.set(key, img);
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
    this.selectedVariant = null;

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

        this.selectedImage = null;

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
  }

  goEdit() {
    this.router.navigate(['/admin/products', this.product._id, 'edit']);
  }

  getVariantLabel(v: any): string {
    return v?.variant_name || v?.name || 'Biến thể';
  }

  getImageVariantLabel(variantId: any): string {
    if (!variantId) return 'Ảnh chung của sản phẩm';
    const found = this.variants.find((item) => String(item?._id) === String(variantId));
    return this.getVariantLabel(found);
  }

  getVariantThumbnail(v: any): string {
    const own = this.sortImages(this.images.filter((img) => String(img.variant_id || '') === String(v._id)));
    if (own.length) return own[0].image_url;
    return this.product?.thumbnail || this.product?.thumbnail_url || this.galleryImages[0]?.image_url || '';
  }

  normalizeImageUrl(value: any): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    if (raw.startsWith('/assets/upload/') || raw.startsWith('/uploads/')) return `http://localhost:3000${raw}`;
    return raw;
  }

  renderDescription(html: string): SafeHtml {
    const container = document.createElement('div');
    container.innerHTML = String(html || '');

    container.querySelectorAll<HTMLElement>('*').forEach((element) => {
      element.style.maxWidth = '100%';
      element.style.boxSizing = 'border-box';
    });

    container.querySelectorAll<HTMLElement>('img, video, iframe').forEach((element) => {
      const rawSrc = element.getAttribute('src') || '';
      if (rawSrc.startsWith('//')) element.setAttribute('src', `https:${rawSrc}`);
      if (rawSrc.startsWith('/uploads/')) element.setAttribute('src', `http://localhost:3000${rawSrc}`);
      element.style.display = 'block';
      element.style.width = '70%';
      element.style.maxWidth = '70%';
      element.style.height = 'auto';
      element.style.margin = '14px auto';
      if (element.tagName === 'IFRAME' || element.tagName === 'VIDEO') {
        element.style.aspectRatio = '16 / 9';
      }
    });

    return this.sanitizer.bypassSecurityTrustHtml(container.innerHTML);
  }

  viewVariant(v: any) {
    this.selectedVariant = { ...v };
  }

  activeStatusLabel(status: string): string {
    const s = String(status || '').toLowerCase();
    if (s === 'active') return 'Đang bán';
    if (s === 'inactive') return 'Ngừng bán';
    return status || '-';
  }
}
