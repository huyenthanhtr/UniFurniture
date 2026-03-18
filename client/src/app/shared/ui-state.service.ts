import { Injectable, computed, signal } from '@angular/core';
import { getStockConstrainedQuantity, normalizeCartQuantity } from './cart-stock.util';

export interface CartItem {
    cartKey: string;
    productId: string;
    variantId?: string;
    variantLabel?: string;
    colorName?: string;
    name: string;
    imageUrl: string;
    quantity: number;
    price: number | null;
    originalPrice?: number | null;
    maxStock?: number;
}

export interface CartMutationResult {
    quantity: number;
    exceededStock: boolean;
    changed: boolean;
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
    selectedCartKeys = signal<Set<string>>(this.loadSelectedKeysFromStorage());

    cartCount = computed(() =>
        this.cartItems().reduce((total, item) => {
            if (this.selectedCartKeys().has(item.cartKey)) {
                return total + item.quantity;
            }
            return total;
        }, 0)
    );
    
    cartSubtotal = computed(() =>
        this.cartItems().reduce((total, item) => {
            if (this.selectedCartKeys().has(item.cartKey)) {
                const unitPrice = typeof item.price === 'number' ? item.price : 0;
                return total + unitPrice * item.quantity;
            }
            return total;
        }, 0)
    );

    openCart() { this.isCartOpen.set(true); }
    closeCart() { this.isCartOpen.set(false); }

    addToCart(item: Omit<CartItem, 'quantity'>, quantity = 1): CartMutationResult {
        const safeQuantity = normalizeCartQuantity(quantity);
        let mutationResult: CartMutationResult = {
            quantity: 0,
            exceededStock: false,
            changed: false,
        };

        this.cartItems.update((currentItems) => {
            const existingIndex = currentItems.findIndex((cartItem) => cartItem.cartKey === item.cartKey);

            if (existingIndex >= 0) {
                const existingItem = currentItems[existingIndex];
                const maxStock = item.maxStock ?? existingItem.maxStock;
                const quantityState = getStockConstrainedQuantity(existingItem.quantity + safeQuantity, maxStock);

                if (quantityState.exceededStock || quantityState.allowedQuantity < 1) {
                    mutationResult = {
                        quantity: existingItem.quantity,
                        exceededStock: true,
                        changed: false,
                    };
                    return currentItems;
                }

                const updatedItems = [...currentItems];
                updatedItems[existingIndex] = {
                    ...existingItem,
                    quantity: quantityState.allowedQuantity,
                    price: item.price ?? existingItem.price,
                    imageUrl: item.imageUrl || existingItem.imageUrl,
                    variantId: item.variantId ?? existingItem.variantId,
                    variantLabel: item.variantLabel ?? existingItem.variantLabel,
                    colorName: item.colorName ?? existingItem.colorName,
                    maxStock,
                    originalPrice: typeof item.originalPrice === 'number' ? item.originalPrice : existingItem.originalPrice ?? null,
                };
                mutationResult = {
                    quantity: quantityState.allowedQuantity,
                    exceededStock: false,
                    changed: true,
                };
                this.persistCart(updatedItems);
                
                // Ensure it's selected when added/updated
                this.selectedCartKeys.update(set => {
                    const newSet = new Set(set);
                    newSet.add(item.cartKey);
                    this.persistSelectedKeys(newSet);
                    return newSet;
                });
                return updatedItems;
            }

            const quantityState = getStockConstrainedQuantity(safeQuantity, item.maxStock);

            if (quantityState.exceededStock || quantityState.allowedQuantity < 1) {
                mutationResult = {
                    quantity: 0,
                    exceededStock: true,
                    changed: false,
                };
                return currentItems;
            }

            const nextItems = [...currentItems, { ...item, quantity: quantityState.allowedQuantity }];
            mutationResult = {
                quantity: quantityState.allowedQuantity,
                exceededStock: false,
                changed: true,
            };
            this.persistCart(nextItems);
            
            this.selectedCartKeys.update(set => {
                const newSet = new Set(set);
                newSet.add(item.cartKey);
                this.persistSelectedKeys(newSet);
                return newSet;
            });
            return nextItems;
        });

        return mutationResult;
    }

    updateCartItemQuantity(cartKey: string, quantity: number): CartMutationResult {
        const safeQuantity = normalizeCartQuantity(quantity);
        let mutationResult: CartMutationResult = {
            quantity: safeQuantity,
            exceededStock: false,
            changed: false,
        };

        this.cartItems.update((currentItems) => {
            const nextItems = currentItems.map((item) => {
                if (item.cartKey !== cartKey) {
                    return item;
                }

                const quantityState = getStockConstrainedQuantity(safeQuantity, item.maxStock);

                if (quantityState.allowedQuantity < 1) {
                    mutationResult = {
                        quantity: item.quantity,
                        exceededStock: true,
                        changed: false,
                    };
                    return item;
                }

                mutationResult = {
                    quantity: quantityState.allowedQuantity,
                    exceededStock: quantityState.exceededStock,
                    changed: quantityState.allowedQuantity !== item.quantity,
                };

                if (!mutationResult.changed) {
                    return item;
                }

                return { ...item, quantity: quantityState.allowedQuantity };
            });
            this.persistCart(nextItems);
            return nextItems;
        });

        return mutationResult;
    }

    removeFromCart(cartKey: string) {
        this.cartItems.update((currentItems) => {
            const nextItems = currentItems.filter((item) => item.cartKey !== cartKey);
            this.persistCart(nextItems);
            return nextItems;
        });
        
        this.selectedCartKeys.update(set => {
            const newSet = new Set(set);
            newSet.delete(cartKey);
            this.persistSelectedKeys(newSet);
            return newSet;
        });
    }

    clearCart() {
        this.cartItems.set([]);
        this.persistCart([]);
        this.selectedCartKeys.set(new Set());
        this.persistSelectedKeys(new Set());
    }

    toggleItemSelection(cartKey: string, isSelected: boolean) {
        this.selectedCartKeys.update(set => {
            const newSet = new Set(set);
            if (isSelected) {
                newSet.add(cartKey);
            } else {
                newSet.delete(cartKey);
            }
            this.persistSelectedKeys(newSet);
            return newSet;
        });
    }

    toggleAllSelection(isSelected: boolean) {
        this.selectedCartKeys.update(() => {
            const newSet = new Set<string>();
            if (isSelected) {
                this.cartItems().forEach(item => newSet.add(item.cartKey));
            }
            this.persistSelectedKeys(newSet);
            return newSet;
        });
    }

    removeSelectedItems() {
        const keysToRemove = this.selectedCartKeys();
        if (keysToRemove.size === 0) return;

        this.cartItems.update((currentItems) => {
            const nextItems = currentItems.filter(item => !keysToRemove.has(item.cartKey));
            this.persistCart(nextItems);
            return nextItems;
        });

        this.selectedCartKeys.set(new Set());
        this.persistSelectedKeys(new Set());
    }

    // Contact float
    isContactOpen = signal(false);
    toggleContact() { this.isContactOpen.update(v => !v); }
    closeContact() { this.isContactOpen.set(false); }

    // Mobile menu
    isMobileMenuOpen = signal(false);
    toggleMobileMenu() { this.isMobileMenuOpen.update(v => !v); }
    closeMobileMenu() { this.isMobileMenuOpen.set(false); }

    getCartItemQuantity(cartKey: string): number {
        return this.cartItems().find((item) => item.cartKey === cartKey)?.quantity ?? 0;
    }

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
                    cartKey: String(item?.cartKey || item?.variantId || item?.productId || ''),
                    productId: String(item?.productId || ''),
                    variantId: String(item?.variantId || ''),
                    variantLabel: String(item?.variantLabel || ''),
                    colorName: String(item?.colorName || ''),
                    name: String(item?.name || ''),
                    imageUrl: String(item?.imageUrl || ''),
                    quantity: Math.max(1, Number(item?.quantity) || 1),
                    price: typeof item?.price === 'number' ? item.price : null,
                    originalPrice: typeof item?.originalPrice === 'number' ? item.originalPrice : null,
                    maxStock: typeof item?.maxStock === 'number' ? item.maxStock : undefined,
                }))
                .filter((item: CartItem) => item.cartKey && item.productId && item.name);
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

    private loadSelectedKeysFromStorage(): Set<string> {
        if (typeof window === 'undefined') {
            return new Set();
        }

        try {
            const raw = window.localStorage.getItem(this.cartStorageKey + '_selected');
            if (!raw) return new Set();
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return new Set(parsed);
            }
            return new Set();
        } catch {
            return new Set();
        }
    }

    private persistSelectedKeys(keys: Set<string>): void {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(this.cartStorageKey + '_selected', JSON.stringify(Array.from(keys)));
    }
}
