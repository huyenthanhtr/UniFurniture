import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../ui-state.service';

@Component({
    selector: 'app-cart-popup',
    imports: [CommonModule],
    templateUrl: './cart-popup.html',
    styleUrl: './cart-popup.css',
})
export class CartPopup {
    ui = inject(UiStateService);

    cartItems = [
        // Sample empty state — real data will come from CartService later
    ];

    closeOnBackdrop(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('cart-overlay')) {
            this.ui.closeCart();
        }
    }
}
