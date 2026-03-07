import { Injectable, computed, signal } from '@angular/core';

export interface CartItem {
    productId: string;
    name: string;
    imageUrl: string;
    quantity: number;
    price: number | null;
}

@Injectable({ providedIn: 'root' })
export class UiStateService {
    private readonly cartStorageKey = 'unifurniture_cart_items';

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
    cartItems = signal<CartItem[]>(this.loadCartFromStorage());
    cartCount = computed(() =>
        this.cartItems().reduce((total, item) => total + item.quantity, 0)
    );
    cartSubtotal = computed(() =>
        this.cartItems().reduce((total, item) => {
            const unitPrice = typeof item.price === 'number' ? item.price : 0;
            return total + unitPrice * item.quantity;
        }, 0)
    );

    openCart() { this.isCartOpen.set(true); }
    closeCart() { this.isCartOpen.set(false); }

    addToCart(item: Omit<CartItem, 'quantity'>, quantity = 1) {
        const safeQuantity = Math.max(1, Math.floor(quantity || 1));
        this.cartItems.update((currentItems) => {
            const existingIndex = currentItems.findIndex((cartItem) => cartItem.productId === item.productId);
            if (existingIndex >= 0) {
                const updatedItems = [...currentItems];
                updatedItems[existingIndex] = {
                    ...updatedItems[existingIndex],
                    quantity: updatedItems[existingIndex].quantity + safeQuantity,
                    price: item.price ?? updatedItems[existingIndex].price,
                    imageUrl: item.imageUrl || updatedItems[existingIndex].imageUrl,
                };
                this.persistCart(updatedItems);
                return updatedItems;
            }

            const nextItems = [...currentItems, { ...item, quantity: safeQuantity }];
            this.persistCart(nextItems);
            return nextItems;
        });
    }

    updateCartItemQuantity(productId: string, quantity: number) {
        const safeQuantity = Math.max(1, Math.floor(quantity || 1));
        this.cartItems.update((currentItems) => {
            const nextItems = currentItems.map((item) =>
                item.productId === productId ? { ...item, quantity: safeQuantity } : item
            );
            this.persistCart(nextItems);
            return nextItems;
        });
    }

    removeFromCart(productId: string) {
        this.cartItems.update((currentItems) => {
            const nextItems = currentItems.filter((item) => item.productId !== productId);
            this.persistCart(nextItems);
            return nextItems;
        });
    }

    clearCart() {
        this.cartItems.set([]);
        this.persistCart([]);
    }

    // Contact float
    isContactOpen = signal(false);
    toggleContact() { this.isContactOpen.update(v => !v); }
    closeContact() { this.isContactOpen.set(false); }

    private loadCartFromStorage(): CartItem[] {
        if (typeof window === 'undefined') {
            return [];
        }

        try {
            const raw = window.localStorage.getItem(this.cartStorageKey);
            if (!raw) {
                return [];
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed
                .map((item: any) => ({
                    productId: String(item?.productId || ''),
                    name: String(item?.name || ''),
                    imageUrl: String(item?.imageUrl || ''),
                    quantity: Math.max(1, Number(item?.quantity) || 1),
                    price: typeof item?.price === 'number' ? item.price : null,
                }))
                .filter((item: CartItem) => item.productId && item.name);
        } catch {
            return [];
        }
    }

    private persistCart(items: CartItem[]) {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(this.cartStorageKey, JSON.stringify(items));
    }
}
