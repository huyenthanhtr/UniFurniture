import { Component, OnInit, inject, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, FormsModule],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css']
})
export class AdminLayout implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  currentUser: any = { fullname: 'Admin', role: 'admin' };
  isMobileMenuOpen = false;
  showLogoutConfirmPopup = false;
  showUserOptions = false;
  currentUrl = '';

  showLoginModal = false;
  loginData = { email: '', password: '' };
  loginErrorMessage = '';
  isLoggingIn = false;

  ngOnInit() {
    // Start of URL profile interception
    const urlParams = new URLSearchParams(window.location.search);
    const profileParam = urlParams.get('profile');
    if (profileParam) {
      try {
        const decodedProfile = JSON.parse(decodeURIComponent(profileParam));
        if (decodedProfile && decodedProfile.role === 'admin') {
          localStorage.setItem('user_profile', JSON.stringify(decodedProfile));
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (e) {
        console.error('Lỗi khi parse profile từ URL', e);
      }
    }

    this.checkAuth();
    this.currentUrl = this.router.url;
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentUrl = event.urlAfterRedirects;
      this.showUserOptions = false;
      this.checkAuth();
    });
  }

  checkAuth() {
    const profileStr = localStorage.getItem('user_profile');
    if (profileStr) {
      try {
        const profile = JSON.parse(profileStr);
        if (profile && profile.role === 'admin') {
          this.currentUser = { fullname: profile.full_name || 'Admin', role: profile.role };
          this.showLoginModal = false;
          return;
        }
      } catch (e) {}
    }
    this.showLoginModal = true;
  }

  onLogin() {
    this.loginErrorMessage = '';
    if (!this.loginData.email || !this.loginData.password) {
      this.loginErrorMessage = 'Vui lòng điền đủ thông tin.';
      return;
    }
    this.isLoggingIn = true;
    this.http.post('http://localhost:3000/api/auth/login', {
      emailOrPhone: this.loginData.email,
      password: this.loginData.password
    }).subscribe({
      next: (res: any) => {
        this.isLoggingIn = false;
        if (res.profile && res.profile.role === 'admin') {
          localStorage.setItem('user_profile', JSON.stringify(res.profile));
          this.checkAuth();
        } else {
          this.loginErrorMessage = 'Tài khoản không có quyền truy cập Admin.';
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoggingIn = false;
        this.loginErrorMessage = err.error?.message || 'Đăng nhập thất bại. Kiểm tra lại thông tin.';
        this.cdr.detectChanges();
      }
    });
  }

  @HostListener('document:click', ['$event'])
  clickout(event: any) {
    if (!event.target.closest('.admin-footer')) {
      this.showUserOptions = false;
    }
  }

  isLinkActive(basePath: string): boolean {
    return this.currentUrl.startsWith(basePath);
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  toggleUserOptions(event: Event) {
    event.stopPropagation();
    this.showUserOptions = !this.showUserOptions;
  }

  goToHomePage() {
    console.log("Navigating to Home Page...");
    this.showUserOptions = false;
    const clientUrl = 'http://localhost:4200';
    window.open(clientUrl, '_blank');
  }

  logout() {
    this.showLogoutConfirmPopup = true;
    this.showUserOptions = false;
  }

  cancelLogout() {
    this.showLogoutConfirmPopup = false;
  }

  confirmLogout() {
    this.showLogoutConfirmPopup = false;
    localStorage.removeItem('user_profile');
    this.showLoginModal = true;
    this.loginData = { email: '', password: '' };
  }
}