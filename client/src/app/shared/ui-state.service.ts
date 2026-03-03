import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiStateService {
    // Auth modal
    isAuthOpen = signal(false);
    authTab = signal<'login' | 'register'>('login');

    openAuth(tab: 'login' | 'register' = 'login') {
        this.authTab.set(tab);
        this.isAuthOpen.set(true);
    }
    closeAuth() { this.isAuthOpen.set(false); }

    // Cart popup
    isCartOpen = signal(false);
    cartCount = signal(0);

    openCart() { this.isCartOpen.set(true); }
    closeCart() { this.isCartOpen.set(false); }

    // Contact float
    isContactOpen = signal(false);
    toggleContact() { this.isContactOpen.update(v => !v); }
    closeContact() { this.isContactOpen.set(false); }
}
