import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UiStateService } from '../ui-state.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  ui = inject(UiStateService);
  router = inject(Router);
  userProfile: any = null;

  onSearch(event: Event, query: string) {
    event.preventDefault();
    if (query.trim()) {
      this.router.navigate(['/products'], { queryParams: { q: query.trim() } });
    }
  }

  toggleMobileMenu() {
    this.ui.toggleMobileMenu();
  }

  ngOnInit() {
    const saved = localStorage.getItem('user_profile');
    if (saved) {
      try {
        this.userProfile = JSON.parse(saved);
      } catch (e) { console.error('Error parsing user profile'); }
    }
  }

  logout() {
    localStorage.removeItem('user_profile');
    this.userProfile = null;
    window.location.reload();
  }
}
