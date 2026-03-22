import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UiStateService } from '../../shared/ui-state.service';
import { AccountProfileTab } from './tabs/profile/profile';
import { AccountAddressesTab } from './tabs/addresses/addresses';
import { AccountOrdersTab } from './tabs/orders/orders';
import { AccountWishlistTab } from './tabs/wishlist/wishlist';
import { AccountSecurityTab } from './tabs/security/security';

export type AccountTab = 'profile' | 'addresses' | 'orders' | 'wishlist' | 'security';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AccountProfileTab,
    AccountAddressesTab,
    AccountOrdersTab,
    AccountWishlistTab,
    AccountSecurityTab,
  ],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class AccountComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly ui = inject(UiStateService);

  activeTab = signal<AccountTab>('profile');
  profile = signal<any>(null);
  needsLogin = signal(false);
  avatarLoadFailed = signal(false);
  showLogoutConfirm = signal(false);

  readonly tabs: { key: AccountTab; label: string; icon: string }[] = [
    { key: 'profile', label: 'Hồ sơ cá nhân', icon: '👤' },
    { key: 'addresses', label: 'Sổ địa chỉ', icon: '📍' },
    { key: 'orders', label: 'Đơn hàng của tôi', icon: '📦' },
    { key: 'wishlist', label: 'Danh sách yêu thích', icon: '❤️' },
    { key: 'security', label: 'Đổi mật khẩu', icon: '🔐' },
  ];

  ngOnInit(): void {
    const raw = localStorage.getItem('user_profile');
    if (!raw) {
      this.needsLogin.set(true);
      return;
    }

    try {
      this.profile.set(JSON.parse(raw));
      this.avatarLoadFailed.set(false);
    } catch {
      this.needsLogin.set(true);
    }

    const fallbackTab = this.route.snapshot.data['tab'] as AccountTab | undefined;
    if (fallbackTab && this.tabs.some((t) => t.key === fallbackTab)) {
      this.activeTab.set(fallbackTab);
    }

    this.route.queryParamMap.subscribe((params) => {
      const tabFromUrl = params.get('tab') as AccountTab | null;
      if (tabFromUrl && this.tabs.some((t) => t.key === tabFromUrl)) {
        this.activeTab.set(tabFromUrl);
      }
    });
  }

  setTab(tab: AccountTab): void {
    this.activeTab.set(tab);
    this.router.navigate(['/tai-khoan'], { queryParams: { tab }, replaceUrl: true });
  }

  requestLogout(): void {
    this.showLogoutConfirm.set(true);
  }

  cancelLogout(): void {
    this.showLogoutConfirm.set(false);
  }

  confirmLogout(): void {
    this.showLogoutConfirm.set(false);
    localStorage.removeItem('user_profile');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.ui.clearCart();
    void this.router.navigate(['/']);
  }

  openLogin(): void {
    this.ui.openAuth('login');
  }

  openRegister(): void {
    this.ui.openAuth('register');
  }

  get avatarUrl(): string {
    if (this.avatarLoadFailed()) return '';
    const p = this.profile();
    return p?.avatar_url || p?.avatarUrl || '';
  }

  get displayName(): string {
    const p = this.profile();
    return p?.full_name || p?.fullName || p?.phone || 'Tài khoản';
  }

  get displayInitial(): string {
    const name = String(this.displayName || '').trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  get displayPhone(): string {
    return this.profile()?.phone || '';
  }

  onSidebarAvatarError(): void {
    this.avatarLoadFailed.set(true);
  }
}
