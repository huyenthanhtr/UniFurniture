import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartItem, UiStateService } from '../ui-state.service';

@Component({
    selector: 'app-cart-popup',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './cart-popup.html',
    styleUrl: './cart-popup.css',
})
export class CartPopup {
    ui = inject(UiStateService);
    private readonly router = inject(Router);
    errorItems = signal<Set<string>>(new Set());
    confirmDeleteKey = signal<string | null>(null);

    closeOnBackdrop(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('cart-overlay')) {
            this.ui.closeCart();
        }
    }

    decreaseQuantity(item: CartItem) {
        if (item.quantity <= 1) {
            this.confirmDeleteKey.set(item.cartKey);
            return;
        }
        this.clearError(item.cartKey);
        this.ui.updateCartItemQuantity(item.cartKey, item.quantity - 1);
    }

    increaseQuantity(item: CartItem) {
        const result = this.ui.updateCartItemQuantity(item.cartKey, item.quantity + 1);
        if (result.exceededStock) {
            this.setError(item.cartKey);
            return;
        }
        this.clearError(item.cartKey);
    }

    onQuantityInput(event: Event, item: CartItem) {
        const input = event.target as HTMLInputElement;
        let value = parseInt(input.value, 10);

        if (isNaN(value) || value < 0) {
            value = 1;
        }

        if (value === 0) {
            input.value = String(item.quantity);
            this.confirmDeleteKey.set(item.cartKey);
            return;
        }

        const result = this.ui.updateCartItemQuantity(item.cartKey, value);

        if (result.exceededStock) {
            this.setError(item.cartKey);
        } else {
            this.clearError(item.cartKey);
        }

        input.value = String(result.quantity);
    }


    removeItem(item: CartItem) {
        this.confirmDeleteKey.set(item.cartKey);
    }

    get isAllSelected(): boolean {
        const items = this.ui.cartItems();
        if (items.length === 0) return false;
        const selectedCount = this.ui.selectedCartKeys().size;
        return selectedCount === items.length;
    }

    get hasSelectedItems(): boolean {
        return this.ui.selectedCartKeys().size > 0;
    }

    toggleSelectAll(event: Event) {
        const input = event.target as HTMLInputElement;
        this.ui.toggleAllSelection(input.checked);
    }

    toggleItem(cartKey: string, event: Event) {
        const input = event.target as HTMLInputElement;
        this.ui.toggleItemSelection(cartKey, input.checked);
    }

    deleteSelected() {
        this.confirmDeleteKey.set('bulk');
    }

    confirmDelete() {
        const key = this.confirmDeleteKey();
        if (!key) return;

        if (key === 'bulk') {
            const selectedKeys = this.ui.selectedCartKeys();
            selectedKeys.forEach(k => this.clearError(k));
            this.ui.removeSelectedItems();
        } else {
            this.clearError(key);
            this.ui.removeFromCart(key);
        }
        this.confirmDeleteKey.set(null);
    }

    cancelDelete() {
        this.confirmDeleteKey.set(null);
    }


    proceedToCheckout() {
        if (this.ui.cartItems().length === 0) {
            return;
        }

        if (this.ui.selectedCartKeys().size === 0) {
            this.ui.toggleAllSelection(true);
        }

        this.ui.closeCart();
        void this.router.navigate(['/checkout']);
    }

    formatPrice(price: number | null): string {
        if (typeof price !== 'number') {
            return 'Liên hệ';
        }
        return `${new Intl.NumberFormat('vi-VN').format(price)}₫`;
    }

    showOriginalPrice(item: CartItem): boolean {
        return this.getOriginalPrice(item) !== null;
    }

    getOriginalPrice(item: CartItem): number | null {
        const salePrice = typeof item.price === 'number' ? item.price : null;
        const originalPrice = typeof item.originalPrice === 'number' ? item.originalPrice : null;

        if (salePrice === null || originalPrice === null) {
            return null;
        }

        return originalPrice > salePrice ? originalPrice : null;
    }

    private setError(cartKey: string) {
        this.errorItems.update(set => {
            const newSet = new Set(set);
            newSet.add(cartKey);
            return newSet;
        });
    }

    private clearError(cartKey: string) {
        this.errorItems.update(set => {
            const newSet = new Set(set);
            newSet.delete(cartKey);
            return newSet;
        });
    }
}


