import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';

@Component({
  selector: 'app-account-wishlist',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class AccountWishlistTab implements OnInit {
  @Input() profile: any = null;
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  items = signal<any[]>([]);
  loading = signal(false);
  error = signal('');

  get accountId(): string {
    return String(this.profile?._id || this.profile?.id || '').trim();
  }

  ngOnInit(): void {
    void this.loadWishlist();
  }

  async loadWishlist(): Promise<void> {
    if (!this.accountId) return;
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ items: any[] }>(`${API_BASE_URL}/accounts/${this.accountId}/wishlist`)
      );
      this.items.set(Array.isArray(res?.items) ? res.items : []);
    } catch {
      this.error.set('Không thể tải danh sách yêu thích.');
    } finally {
      this.loading.set(false);
    }
  }

  viewProduct(item: any): void {
    const slug = item?.slug || item?.product_slug || item?.productSlug;
    if (slug) void this.router.navigate(['/products', slug]);
  }

  async removeFromWishlist(item: any): Promise<void> {
    const productId = item?.product_id || item?.productId || item?._id;
    if (!productId) return;
    try {
      await firstValueFrom(
        this.http.delete(`${API_BASE_URL}/accounts/${this.accountId}/wishlist/${productId}`)
      );
      this.items.update(list => list.filter(i => (i.product_id || i.productId || i._id) !== productId));
    } catch {
      this.error.set('Không thể xóa khỏi danh sách yêu thích.');
    }
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))}₫`;
  }
}