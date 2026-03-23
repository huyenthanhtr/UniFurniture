import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WishlistEntry, WishlistService } from '../../../../shared/wishlist.service';

type WishlistSortMode = 'newest' | 'name_az' | 'name_za' | 'price_low' | 'price_high';

@Component({
  selector: 'app-account-wishlist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class AccountWishlistTab implements OnInit {
  @Input() profile: any = null;

  private readonly router = inject(Router);
  private readonly wishlist = inject(WishlistService);

  loading = signal(false);
  error = signal('');

  searchKeyword = signal('');
  sortMode = signal<WishlistSortMode>('newest');
  showAdvancedFilters = signal(false);
  minPriceInput = signal('');
  maxPriceInput = signal('');

  readonly items = computed<WishlistEntry[]>(() => this.wishlist.getItems());

  ngOnInit(): void {
    void this.loadWishlist();
  }

  async loadWishlist(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.wishlist.refresh(true);
    } catch {
      this.error.set('Không thể tải danh sách yêu thích. Vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  setSearchKeyword(value: string): void {
    this.searchKeyword.set(String(value || ''));
  }

  setSortMode(value: WishlistSortMode): void {
    this.sortMode.set(value);
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update((v) => !v);
  }

  setMinPriceInput(value: string): void {
    this.minPriceInput.set(String(value || ''));
  }

  setMaxPriceInput(value: string): void {
    this.maxPriceInput.set(String(value || ''));
  }

  clearFilters(): void {
    this.searchKeyword.set('');
    this.sortMode.set('newest');
    this.minPriceInput.set('');
    this.maxPriceInput.set('');
  }

  visibleItems(): WishlistEntry[] {
    const keyword = this.normalize(this.searchKeyword());
    const mode = this.sortMode();
    const minPrice = this.parsePrice(this.minPriceInput());
    const maxPrice = this.parsePrice(this.maxPriceInput());

    const filtered = this.items().filter((item) => {
      const price = this.effectivePrice(item);
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;

      if (!keyword) return true;
      const haystack = this.normalize(item.name || '');
      return haystack.includes(keyword);
    });

    return [...filtered].sort((a, b) => {
      if (mode === 'name_az') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'vi', {
          sensitivity: 'base',
        });
      }

      if (mode === 'name_za') {
        return String(b.name || '').localeCompare(String(a.name || ''), 'vi', {
          sensitivity: 'base',
        });
      }

      if (mode === 'price_low') {
        return this.effectivePrice(a) - this.effectivePrice(b);
      }

      if (mode === 'price_high') {
        return this.effectivePrice(b) - this.effectivePrice(a);
      }

      const ta = new Date(String(a.createdAt || 0)).getTime() || 0;
      const tb = new Date(String(b.createdAt || 0)).getTime() || 0;
      return tb - ta;
    });
  }

  hasItemsAfterFilter(): boolean {
    return this.visibleItems().length > 0;
  }

  viewProduct(item: WishlistEntry): void {
    const slug = String(item?.product_slug || '').trim();
    if (slug) {
      void this.router.navigate(['/products', slug]);
      return;
    }

    const id = String(item?.product_id || '').trim();
    if (id) {
      void this.router.navigate(['/products', id]);
    }
  }

  async removeFromWishlist(item: WishlistEntry): Promise<void> {
    const productId = String(item?.product_id || '').trim();
    if (!productId) return;

    const ok = await this.wishlist.remove(productId);
    if (!ok) {
      this.error.set('Không thể xóa khỏi danh sách yêu thích. Vui lòng thử lại.');
    }
  }

  openAllProducts(): void {
    void this.router.navigate(['/products'], {
      queryParams: {
        group: null,
        groupLabel: null,
        collection: null,
        collections: null,
        category: null,
        categories: null,
        q: null,
        title: null,
        page: 1,
        sort: 'best-selling',
        navScroll: Date.now(),
      },
      queryParamsHandling: 'merge',
    });
  }

  productImage(item: WishlistEntry): string {
    return String(item.image_url || 'assets/images/placeholder.png');
  }

  productName(item: WishlistEntry): string {
    return String(item.name || 'Sản phẩm yêu thích');
  }

  effectivePrice(item: WishlistEntry): number {
    const sale = Number(item.sale_price || 0);
    if (sale > 0) return sale;
    return Number(item.price || 0);
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(Math.max(0, Number(value || 0)))}đ`;
  }

  trackByProduct(_: number, item: WishlistEntry): string {
    return String(item.product_id || this.productName(item));
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private parsePrice(value: string): number | null {
    const cleaned = String(value || '')
      .replace(/[^\d]/g, '')
      .trim();

    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
  }
}
