import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../ui-state.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  ui = inject(UiStateService);
  userProfile: any = null;

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
