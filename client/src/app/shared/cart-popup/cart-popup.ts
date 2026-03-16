import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartItem, UiStateService } from '../ui-state.service';

@Component({
    selector: 'app-cart-popup',
    imports: [CommonModule],
    templateUrl: './cart-popup.html',
    styleUrl: './cart-popup.css',
})
export class CartPopup {
    ui = inject(UiStateService);

    closeOnBackdrop(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('cart-overlay')) {
            this.ui.closeCart();
        }
    }

    decreaseQuantity(item: CartItem) {
        if (item.quantity <= 1) {
            this.ui.removeFromCart(item.cartKey);
            return;
        }
        this.ui.updateCartItemQuantity(item.cartKey, item.quantity - 1);
    }

    increaseQuantity(item: CartItem) {
        this.ui.updateCartItemQuantity(item.cartKey, item.quantity + 1);
    }

    removeItem(item: CartItem) {
        this.ui.removeFromCart(item.cartKey);
    }

    formatPrice(price: number | null): string {
        if (typeof price !== 'number') {
            return 'Li\u00ean h\u1ec7';
        }
        return `${new Intl.NumberFormat('vi-VN').format(price)}\u0111`;
    }
}
