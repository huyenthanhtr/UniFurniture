import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

const API_BASE_URL = 'http://localhost:3000/api';

type OrderTab = 'in_progress' | 'completed' | 'cancelled';

interface OrderPreviewItem {
  _id?: string;
  product_name?: string;
  variant_name?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  image_url?: string;
}

@Component({
  selector: 'app-account-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class AccountOrdersTab implements OnInit {
  @Input() profile: any = null;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  orders = signal<any[]>([]);
  displayOrders = signal<any[]>([]);
  loading = signal(false);
  error = signal('');

  activeTab = signal<OrderTab>('in_progress');
  showAdvancedFilters = signal(false);

  searchKeyword = signal('');
  sortMode = signal<'newest' | 'oldest'>('newest');
  dateFrom = signal('');
  dateTo = signal('');

  orderDetailsMap = signal<Record<string, any>>({});
  orderDetailsLoadingMap = signal<Record<string, boolean>>({});
  orderDetailsErrorMap = signal<Record<string, string>>({});

  private expandedOrderIds = new Set<string>();
  private openedWarrantyOrderIds = new Set<string>();

  get accountId(): string {
    return String(this.profile?._id || this.profile?.id || '').trim();
  }

  ngOnInit(): void {
    void this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    if (!this.accountId) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const res = await firstValueFrom(
        this.http.get<{ items: any[] }>(`${API_BASE_URL}/orders`, {
          params: { accountId: this.accountId, limit: '200', sortBy: 'ordered_at', order: 'desc' },
        })
      );
      this.orders.set(Array.isArray(res?.items) ? res.items : []);
      this.applyFilters();
    } catch {
      this.error.set('Không thể tải danh sách đơn hàng. Vui lòng thử lại.');
      this.displayOrders.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  setActiveTab(tab: OrderTab): void {
    this.activeTab.set(tab);
    this.applyFilters();
  }

  tabCount(tab: OrderTab): number {
    return this.orders().filter((order) => this.belongsToTab(order, tab)).length;
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update((v) => !v);
  }

  onSortModeChange(value: 'newest' | 'oldest'): void {
    this.sortMode.set(value);
    this.applyFilters();
  }

  onSearchChange(value: string): void {
    this.searchKeyword.set(String(value || ''));
    this.applyFilters();
  }

  onDateFromChange(value: string): void {
    this.dateFrom.set(value);
    this.applyFilters();
  }

  onDateToChange(value: string): void {
    this.dateTo.set(value);
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchKeyword.set('');
    this.sortMode.set('newest');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.applyFilters();
  }

  viewTracking(orderCode: string): void {
    void this.router.navigate(['/tra-cuu-van-don'], { queryParams: { code: orderCode } });
  }

  async toggleWarrantySection(order: any): Promise<void> {
    const key = this.orderKey(order);
    if (!key) return;

    if (this.openedWarrantyOrderIds.has(key)) {
      this.openedWarrantyOrderIds.delete(key);
      return;
    }

    this.openedWarrantyOrderIds.add(key);
    if (this.orderDetailsMap()[key]) return;

    await this.loadOrderDetails(order);
  }

  isWarrantySectionOpen(order: any): boolean {
    return this.openedWarrantyOrderIds.has(this.orderKey(order));
  }

  isOrderDetailsLoading(order: any): boolean {
    return Boolean(this.orderDetailsLoadingMap()[this.orderKey(order)]);
  }

  orderDetailsError(order: any): string {
    return String(this.orderDetailsErrorMap()[this.orderKey(order)] || '');
  }

  orderWarrantyHistory(order: any): any[] {
    const detail = this.orderDetailsMap()[this.orderKey(order)];
    return Array.isArray(detail?.warranty?.history) ? detail.warranty.history : [];
  }

  orderWarrantyInfo(order: any): any {
    const detail = this.orderDetailsMap()[this.orderKey(order)];
    return detail?.warranty || null;
  }

  formatDateOnly(value: string): string {
    const d = new Date(value);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('vi-VN');
  }

  canShowWarranty(order: any): boolean {
    const status = String(order?.status || '').toLowerCase();
    return status === 'completed' || status === 'exchanged';
  }

  warrantyTypeLabel(type: string): string {
    return String(type || '').toLowerCase() === 'warranty' ? 'Bảo hành' : 'Sửa chữa';
  }

  warrantyTypeClass(type: string): string {
    return String(type || '').toLowerCase() === 'warranty' ? 'type-warranty' : 'type-maintenance';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      cancel_pending: 'Chờ xác nhận hủy',
      processing: 'Đang xử lý',
      shipping: 'Đang giao',
      delivered: 'Đã giao',
      completed: 'Hoàn tất',
      cancelled: 'Đã hủy',
      refunded: 'Đã hoàn tiền',
      exchanged: 'Đã đổi hàng',
    };
    return map[String(status || '').toLowerCase()] || status || '-';
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      cancel_pending: 'status-warning',
      processing: 'status-processing',
      shipping: 'status-shipping',
      delivered: 'status-delivered',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      refunded: 'status-refunded',
      exchanged: 'status-completed',
    };
    return map[String(status || '').toLowerCase()] || '';
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))}đ`;
  }

  formatDate(value: string): string {
    const d = new Date(value);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('vi-VN');
  }

  remainingAmount(order: any): number {
    const total = Number(order?.payment_summary?.total_amount || order?.total_amount || 0);
    const paid = Number(order?.payment_summary?.paid_total || 0);
    return Math.max(total - paid, 0);
  }

  productPreviewItems(order: any): OrderPreviewItem[] {
    const all = this.orderItems(order);
    if (this.isExpanded(order)) return all;
    return all.slice(0, 2);
  }

  hasMoreItems(order: any): boolean {
    return this.orderItems(order).length > 2 && !this.isExpanded(order);
  }

  hiddenItemsCount(order: any): number {
    return Math.max(this.orderItems(order).length - 2, 0);
  }

  toggleExpand(order: any): void {
    const key = this.orderKey(order);
    if (!key) return;

    if (this.expandedOrderIds.has(key)) {
      this.expandedOrderIds.delete(key);
    } else {
      this.expandedOrderIds.add(key);
    }
  }

  isExpanded(order: any): boolean {
    return this.expandedOrderIds.has(this.orderKey(order));
  }

  productImageUrl(item: OrderPreviewItem): string {
    const fromApi = String(item?.image_url || '').trim();
    return fromApi || 'assets/images/placeholder.png';
  }

  private applyFilters(): void {
    const raw = [...this.orders()];
    const keyword = this.normalize(this.searchKeyword());
    const fromTime = this.toStartOfDay(this.dateFrom());
    const toTime = this.toEndOfDay(this.dateTo());
    const sortMode = this.sortMode();
    const activeTab = this.activeTab();

    const filtered = raw.filter((order) => {
      if (!this.belongsToTab(order, activeTab)) return false;

      const orderTime = this.orderTime(order);
      if (fromTime !== null && orderTime < fromTime) return false;
      if (toTime !== null && orderTime > toTime) return false;

      if (!keyword) return true;

      const code = this.normalize(String(order?.order_code || ''));
      const status = this.normalize(this.statusLabel(order?.status));
      const itemNames = this.orderItems(order)
        .map((item) => this.normalize(String(item?.product_name || '')))
        .join(' ');

      return code.includes(keyword) || status.includes(keyword) || itemNames.includes(keyword);
    });

    filtered.sort((a, b) => {
      const delta = this.orderTime(a) - this.orderTime(b);
      return sortMode === 'oldest' ? delta : -delta;
    });

    this.displayOrders.set(filtered);
  }

  private belongsToTab(order: any, tab: OrderTab): boolean {
    const status = String(order?.status || '').toLowerCase();

    if (tab === 'in_progress') {
      return ['pending', 'confirmed', 'cancel_pending', 'processing', 'shipping', 'delivered'].includes(status);
    }

    if (tab === 'completed') {
      return ['completed', 'exchanged'].includes(status);
    }

    return ['cancelled', 'refunded'].includes(status);
  }

  private orderItems(order: any): OrderPreviewItem[] {
    return Array.isArray(order?.order_items_preview) ? order.order_items_preview : [];
  }

  private orderKey(order: any): string {
    return String(order?._id || order?.order_code || '');
  }

  private orderTime(order: any): number {
    return new Date(order?.ordered_at || order?.createdAt || 0).getTime() || 0;
  }

  private toStartOfDay(value: string): number | null {
    const v = String(value || '').trim();
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  private toEndOfDay(value: string): number | null {
    const v = String(value || '').trim();
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  private normalize(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  private async loadOrderDetails(order: any): Promise<void> {
    const key = this.orderKey(order);
    if (!key) return;

    this.orderDetailsLoadingMap.update((prev) => ({ ...prev, [key]: true }));
    this.orderDetailsErrorMap.update((prev) => ({ ...prev, [key]: '' }));

    try {
      const identifier = String(order?._id || order?.order_code || '').trim();
      const detail = await firstValueFrom(this.http.get<any>(`${API_BASE_URL}/orders/${identifier}`));
      this.orderDetailsMap.update((prev) => ({ ...prev, [key]: detail }));
    } catch {
      this.orderDetailsErrorMap.update((prev) => ({
        ...prev,
        [key]: 'Không thể tải thông tin bảo hành/sửa chữa của đơn này.',
      }));
    } finally {
      this.orderDetailsLoadingMap.update((prev) => ({ ...prev, [key]: false }));
    }
  }
}
