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

    closeOnBackdrop(event: MouseEvent) {
        if ((event.target as HTMLElement).classList.contains('cart-overlay')) {
            this.ui.closeCart();
        }
    }

    decreaseQuantity(item: CartItem) {
        if (item.quantity <= 1) {
            this.removeItem(item);
            return;
        }
        this.clearError(item.cartKey);
        this.ui.updateCartItemQuantity(item.cartKey, item.quantity - 1);
    }

    increaseQuantity(item: CartItem) {
        const nextQty = item.quantity + 1;
        if (typeof item.maxStock === 'number' && nextQty > item.maxStock) {
            this.setError(item.cartKey);
            return;
        }
        this.clearError(item.cartKey);
        this.ui.updateCartItemQuantity(item.cartKey, nextQty);
    }

    onQuantityInput(event: Event, item: CartItem) {
        const input = event.target as HTMLInputElement;
        let value = parseInt(input.value, 10);

        if (isNaN(value) || value < 1) {
            value = 1;
        }

        if (typeof item.maxStock === 'number' && value > item.maxStock) {
            this.setError(item.cartKey);
            value = item.maxStock;
            input.value = String(value);
        } else {
            this.clearError(item.cartKey);
        }

        this.ui.updateCartItemQuantity(item.cartKey, value);
    }

    removeItem(item: CartItem) {
        this.clearError(item.cartKey);
        this.ui.removeFromCart(item.cartKey);
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
        if (confirm('Bạn có chắc chắn muốn xóa các sản phẩm đã chọn khỏi giỏ hàng?')) {
            const selectedKeys = this.ui.selectedCartKeys();
            selectedKeys.forEach(key => this.clearError(key));
            this.ui.removeSelectedItems();
        }
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


