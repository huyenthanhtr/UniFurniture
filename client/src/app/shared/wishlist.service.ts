import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';

export interface WishlistEntry {
  _id?: string;
  product_id: string;
  account_name?: string;
  account_phone?: string;
  product_slug?: string;
  name: string;
  image_url: string;
  sale_price: number;
  price: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly http = inject(HttpClient);
  private readonly revision = signal(0);
  private readonly cachedItems = signal<WishlistEntry[]>([]);
  private loadedProfileId = '';
  private loadingPromise: Promise<void> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => this.handleExternalProfileChange());
      window.addEventListener('user-profile-updated', () => this.handleExternalProfileChange());
    }
  }

  isLoggedIn(): boolean {
    const token = String(localStorage.getItem('access_token') || '').trim();
    if (token) return true;
    return Boolean(this.getCurrentProfileId());
  }

  getItems(): WishlistEntry[] {
    this.revision();
    const profileId = this.getCurrentProfileId();
    if (!profileId) return [];

    if (this.loadedProfileId !== profileId && !this.loadingPromise) {
      void this.refresh(true);
    }

    return this.cachedItems();
  }

  isInWishlist(productId: string): boolean {
    const target = String(productId || '').trim();
    if (!target) return false;
    return this.getItems().some((item) => item.product_id === target);
  }

  async refresh(force = false): Promise<void> {
    const profileId = this.getCurrentProfileId();
    if (!profileId) {
      this.cachedItems.set([]);
      this.loadedProfileId = '';
      this.bump();
      return;
    }

    if (!force && this.loadedProfileId === profileId) {
      return;
    }

    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    this.loadingPromise = this.fetchItems(profileId);
    try {
      await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  async toggle(entry: Omit<WishlistEntry, '_id' | 'createdAt'>): Promise<{ added: boolean; ok: boolean; reason?: 'guest' }> {
    if (!this.isLoggedIn()) {
      return { added: false, ok: false, reason: 'guest' };
    }

    const profileId = this.getCurrentProfileId();
    if (!profileId) {
      return { added: false, ok: false, reason: 'guest' };
    }

    const productId = String(entry.product_id || '').trim();
    if (!productId) {
      return { added: false, ok: false };
    }

    await this.refresh();

    const exists = this.cachedItems().some((item) => item.product_id === productId);

    try {
      if (exists) {
        await firstValueFrom(this.http.delete(`${API_BASE_URL}/wishlist/profiles/${profileId}/items/${productId}`));
        this.cachedItems.update((list) => list.filter((item) => item.product_id !== productId));
        this.bump();
        return { added: false, ok: true };
      }

      const res = await firstValueFrom(
        this.http.post<{ item?: WishlistEntry }>(`${API_BASE_URL}/wishlist/profiles/${profileId}/items`, {
          product_id: productId,
          product_slug: String(entry.product_slug || '').trim(),
          name: String(entry.name || '').trim() || 'Sản phẩm',
          image_url: String(entry.image_url || '').trim(),
          sale_price: Math.max(0, Number(entry.sale_price || 0)),
          price: Math.max(0, Number(entry.price || 0)),
        })
      );

      const created = this.normalizeItem(res?.item) || {
        product_id: productId,
        product_slug: String(entry.product_slug || '').trim(),
        name: String(entry.name || '').trim() || 'Sản phẩm',
        image_url: String(entry.image_url || '').trim(),
        sale_price: Math.max(0, Number(entry.sale_price || 0)),
        price: Math.max(0, Number(entry.price || 0)),
        createdAt: new Date().toISOString(),
      };

      this.cachedItems.update((list) => [created, ...list.filter((item) => item.product_id !== productId)]);
      this.bump();
      return { added: true, ok: true };
    } catch {
      return { added: exists ? false : true, ok: false };
    }
  }

  async remove(productId: string): Promise<boolean> {
    const profileId = this.getCurrentProfileId();
    if (!profileId) return false;

    const target = String(productId || '').trim();
    if (!target) return false;

    try {
      await firstValueFrom(this.http.delete(`${API_BASE_URL}/wishlist/profiles/${profileId}/items/${target}`));
      this.cachedItems.update((list) => list.filter((item) => item.product_id !== target));
      this.bump();
      return true;
    } catch {
      return false;
    }
  }

  private async fetchItems(profileId: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ items?: WishlistEntry[] }>(`${API_BASE_URL}/wishlist/profiles/${profileId}`)
      );

      const normalized = Array.isArray(res?.items)
        ? res.items.map((item) => this.normalizeItem(item)).filter((item): item is WishlistEntry => Boolean(item))
        : [];

      this.cachedItems.set(normalized);
      this.loadedProfileId = profileId;
      this.bump();
    } catch {
      this.cachedItems.set([]);
      this.loadedProfileId = profileId;
      this.bump();
    }
  }

  private normalizeItem(item: any): WishlistEntry | null {
    const productId = String(item?.product_id || '').trim();
    if (!productId) return null;

    return {
      _id: String(item?._id || '').trim(),
      product_id: productId,
      account_name: String(item?.account_name || '').trim(),
      account_phone: String(item?.account_phone || '').trim(),
      product_slug: String(item?.product_slug || '').trim(),
      name: String(item?.name || '').trim() || 'Sản phẩm',
      image_url: String(item?.image_url || '').trim(),
      sale_price: Math.max(0, Number(item?.sale_price || 0)),
      price: Math.max(0, Number(item?.price || 0)),
      createdAt: String(item?.createdAt || new Date().toISOString()),
    };
  }

  private getCurrentProfileId(): string {
    const raw = String(localStorage.getItem('user_profile') || '').trim();
    if (!raw) return '';

    try {
      const profile = JSON.parse(raw);
      return String(profile?._id || profile?.id || '').trim();
    } catch {
      return '';
    }
  }

  private handleExternalProfileChange(): void {
    const current = this.getCurrentProfileId();
    if (!current) {
      this.cachedItems.set([]);
      this.loadedProfileId = '';
      this.bump();
      return;
    }

    if (current !== this.loadedProfileId) {
      this.cachedItems.set([]);
      this.loadedProfileId = '';
      this.bump();
      void this.refresh(true);
    }
  }

  private bump(): void {
    this.revision.update((v) => v + 1);
  }
}
