import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './admin-layout.html',
  styleUrls: ['./admin-layout.css']
})
export class AdminLayout implements OnInit {
  private router = inject(Router);

  currentUser: any = { fullname: 'Admin Nội Thất', role: 'Quản trị viên' };
  isMobileMenuOpen = false;
  showLogoutConfirmPopup = false;
  showUserOptions = false; // Biến điều khiển menu con
  currentUrl = '';

  ngOnInit() {
    this.currentUrl = this.router.url;
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.currentUrl = event.urlAfterRedirects;
      this.showUserOptions = false; // Đóng menu khi chuyển trang
    });
  }

  // Click ra ngoài thì đóng menu
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
    // Tạm thời log ra, sau này bạn gắn router.navigate hoặc window.location
    console.log("Navigating to Home Page...");
    this.showUserOptions = false;
    const clientUrl = 'http://localhost:4200';
    window.open(clientUrl, '_blank');
    // this.router.navigate(['/']); 
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
    // Xử lý logic logout tại đây (clear token...)
    this.router.navigate(['/login']);
  }
}