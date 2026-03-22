import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UiStateService } from '../ui-state.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  ui = inject(UiStateService);
  router = inject(Router);

  userProfile: any = null;
  isAccountDropdownOpen = false;
  showLogoutConfirm = false;

  readonly accountMenuItems = [
    { label: 'Hồ sơ cá nhân',     icon: '👤', tab: 'profile' },
    { label: 'Sổ địa chỉ',         icon: '📍', tab: 'addresses' },
    { label: 'Đơn hàng của tôi',  icon: '📦', tab: 'orders' },
    { label: 'Danh sách yêu thích', icon: '❤️', tab: 'wishlist' },
    { label: 'Đổi mật khẩu',      icon: '🔑', tab: 'security' },
  ];

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    const saved = localStorage.getItem('user_profile');
    if (saved) {
      try { 
        this.userProfile = JSON.parse(saved); 
      } catch { 
        this.userProfile = null; 
      }
      return;
    }
    this.userProfile = null;
  }

  @HostListener('window:user-profile-updated', ['$event'])
  onUserProfileUpdated(event: Event): void {
    const profile = (event as CustomEvent<any>)?.detail;
    if (profile && typeof profile === 'object') {
      this.userProfile = profile;
      return;
    }
    this.loadProfile();
  }

  @HostListener('window:storage', ['$event'])
  onStorageChange(event: StorageEvent): void {
    if (event.key === 'user_profile') {
      this.loadProfile();
    }
  }

  get displayName(): string {
    return this.userProfile?.full_name || this.userProfile?.phone || 'Tài khoản';
  }

  get avatarUrl(): string {
    return this.userProfile?.avatar_url || this.userProfile?.avatarUrl || '';
  }

  get initials(): string {
    return this.displayName.charAt(0).toUpperCase();
  }

  toggleAccountDropdown(event: Event): void {
    event.stopPropagation();
    this.isAccountDropdownOpen = !this.isAccountDropdownOpen;
  }

  closeAccountDropdown(): void {
    this.isAccountDropdownOpen = false;
  }

  navigateToTab(tab: string): void {
    this.closeAccountDropdown();
    void this.router.navigate(['/tai-khoan'], { queryParams: { tab } });
  }

  requestLogout(event?: Event): void {
    event?.stopPropagation();
    this.closeAccountDropdown();
    this.showLogoutConfirm = true;
  }

  cancelLogout(): void {
    this.showLogoutConfirm = false;
  }

  confirmLogout(): void {
    this.showLogoutConfirm = false;
    localStorage.removeItem('user_profile');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.userProfile = null;
    this.ui.clearCart();
    void this.router.navigate(['/']);
  }

  onSearch(event: Event, query: string): void {
    event.preventDefault();
    if (query.trim()) {
      void this.router.navigate(['/products'], { queryParams: { q: query.trim() } });
    }
  }

  toggleMobileMenu(): void {
    this.ui.toggleMobileMenu();
  }

  // Đóng dropdown khi click ra ngoài
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeAccountDropdown();
  }
}
