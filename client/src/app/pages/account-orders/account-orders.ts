import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiStateService } from '../../shared/ui-state.service';

const API_BASE_URL = 'http://localhost:3000/api';

@Component({
  selector: 'app-account-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-orders.html',
  styleUrl: './account-orders.css',
})
export class AccountOrdersComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly ui = inject(UiStateService);

  loading = false;
  errorMessage = '';
  needsLogin = false;
  profile: any = null;
  orders: any[] = [];

  async ngOnInit(): Promise<void> {
    const raw = localStorage.getItem('user_profile');
    if (!raw) {
      this.needsLogin = true;
      return;
    }

    try {
      this.profile = JSON.parse(raw);
    } catch {
      this.needsLogin = true;
      return;
    }

    const accountId = String(this.profile?._id || '').trim();
    if (!accountId) {
      this.needsLogin = true;
      return;
    }

    await this.loadOrders(accountId);
  }

  async loadOrders(accountId: string): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      const response = await firstValueFrom(
        this.http.get<{ items?: any[] }>(`${API_BASE_URL}/orders`, {
          params: {
            accountId,
            limit: '100',
            sortBy: 'ordered_at',
            order: 'desc',
          },
        }),
      );

      this.orders = Array.isArray(response?.items) ? response.items : [];
    } catch {
      this.errorMessage = 'Khong the tai danh sach don hang. Vui long thu lai.';
      this.orders = [];
    } finally {
      this.loading = false;
    }
  }

  openLogin(): void {
    this.ui.openAuth('login');
  }

  viewTracking(orderCode: string): void {
    const code = String(orderCode || '').trim();
    if (!code) return;
    void this.router.navigate(['/tra-cuu-van-don'], { queryParams: { code } });
  }

  statusLabel(status: string): string {
    const key = String(status || '').toLowerCase();
    if (key === 'pending') return 'Da dat hang';
    if (key === 'confirmed') return 'Da xac nhan';
    if (key === 'processing') return 'Dang xu ly';
    if (key === 'shipping') return 'Dang giao';
    if (key === 'delivered') return 'Da giao';
    if (key === 'completed') return 'Hoan tat';
    if (key === 'cancelled') return 'Da huy';
    return status || '-';
  }

  formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))}?`;
  }

  formatDate(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('vi-VN');
  }
}
