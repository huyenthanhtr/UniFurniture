import { Injectable, computed, signal, inject } from '@angular/core';
import { getStockConstrainedQuantity, normalizeCartQuantity } from './cart-stock.util';
import { CartApiService, ServerCartItem } from './cart-api.service';

export interface CartItem {
    _id?: string; // Server item ID
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
    private readonly cartApi = inject(CartApiService);
    private readonly cartStorageKey = 'unifurniture_cart_items';

    // Auth modal
    isAuthOpen = signal(false);
    authTab = signal<'login' | 'register' | 'forgot'>('login');

    openAuth(tab: 'login' | 'register' = 'login') {
        this.authTab.set(tab);
        this.isAuthOpen.set(true);
    }
    closeAuth() { this.isAuthOpen.set(false); }
    
    // AI Chat modal/container
    isAiChatOpen = signal(false);
    toggleAiChat() { this.isAiChatOpen.update(v => !v); }
    closeAiChat() { this.isAiChatOpen.set(false); }

    // Cart popup
    isCartOpen = signal(false);
    cartItems = signal<CartItem[]>(this.loadCartFromStorage());
    selectedCartKeys = signal<Set<string>>(this.loadSelectedKeysFromStorage());
    serverCartId = signal<string | null>(null);

    cartCount = computed(() => this.cartItems().length);
    
    cartSubtotal = computed(() =>
        this.cartItems().reduce((total, item) => {
            if (this.selectedCartKeys().has(item.cartKey)) {
                const unitPrice = typeof item.price === 'number' ? item.price : 0;
                return total + unitPrice * item.quantity;
            }
            return total;
        }, 0)
    );

    constructor() {
        this.initCart();
    }

    async initCart() {
        if (typeof window === 'undefined') return;
        const profileStr = localStorage.getItem('user_profile');
        if (profileStr) {
            try {
                const profile = JSON.parse(profileStr);
                if (profile && profile._id) {
                    await this.loadUserCart(profile._id);
                }
            } catch (e) {
                console.error('Failed to init user cart', e);
            }
        }
    }

    private mapServerItemToCartItem(serverItem: any): CartItem {
        const variant = serverItem.variant_id || {};
        const product = variant.product_id || {};
        
        const salePrice = typeof serverItem.unit_price === 'number' ? serverItem.unit_price : (variant.price ?? product.min_price ?? null);
        const vid = String(variant._id || '');
        const pid = String(product._id || '');
        const key = serverItem.variant_id && typeof serverItem.variant_id === 'string' 
            ? serverItem.variant_id 
            : (vid || pid || serverItem._id);
        
        return {
            _id: serverItem._id,
            cartKey: String(key),
            productId: pid,
            variantId: vid,
            variantLabel: variant.label || variant.color || '',
            colorName: variant.color || '',
            name: product.name || 'Sản phẩm',
            imageUrl: variant.images?.[0] || product.thumbnail || product.thumbnail_url || 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&q=80&w=900',
            quantity: serverItem.quantity,
            price: salePrice,
            originalPrice: variant.compare_at_price ?? product.compare_at_price ?? null,
            maxStock: variant.stock_quantity ?? product.stock_quantity ?? 99
        };
    }

    async loadUserCart(customerId: string) {
        try {
            const res = await this.cartApi.getActiveCart(customerId);
            this.serverCartId.set(res.cart._id);
            
            const serverItems = res.items.map(i => this.mapServerItemToCartItem(i));
            
            // Merge guest cart
            const guestItems = this.loadCartFromStorage().filter(i => !i._id);
            
            if (guestItems.length > 0) {
                for (const guestItem of guestItems) {
                    const existingIndex = serverItems.findIndex(si => si.cartKey === guestItem.cartKey);
                    if (existingIndex >= 0) {
                        const existing = serverItems[existingIndex];
                        const newQty = existing.quantity + guestItem.quantity;
                        try {
                            const updated = await this.cartApi.updateItem(existing._id!, { quantity: newQty });
                            serverItems[existingIndex] = this.mapServerItemToCartItem(updated.item);
                        } catch(e){}
                    } else {
                        try {
                            const added = await this.cartApi.upsertItem({
                                cart_id: res.cart._id,
                                variant_id: guestItem.variantId || guestItem.productId,
                                quantity: guestItem.quantity,
                                unit_price: guestItem.price || 0
                            });
                            serverItems.push(this.mapServerItemToCartItem(added));
                        } catch(e){}
                    }
                }
            }
            
            this.cartItems.set(serverItems);
            this.persistCart(serverItems);
        } catch (error) {
            console.error('Failed to load user cart', error);
        }
    }

    openCart() { this.isCartOpen.set(true); }
    closeCart() { this.isCartOpen.set(false); }

    addToCart(item: Omit<CartItem, 'quantity' | '_id'>, quantity = 1): CartMutationResult {
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
                
                // Server Sync
                const cartId = this.serverCartId();
                if (cartId) {
                    this.cartApi.upsertItem({
                        cart_id: cartId,
                        variant_id: updatedItems[existingIndex].variantId || updatedItems[existingIndex].productId,
                        quantity: updatedItems[existingIndex].quantity,
                        unit_price: updatedItems[existingIndex].price || 0
                    }).then(serverItem => {
                        this.updateItemFromServer(item.cartKey, serverItem);
                    }).catch(e => console.error(e));
                }
                
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
            
            // Server Sync
            const cartId = this.serverCartId();
            if (cartId) {
                this.cartApi.upsertItem({
                    cart_id: cartId,
                    variant_id: item.variantId || item.productId,
                    quantity: quantityState.allowedQuantity,
                    unit_price: item.price || 0
                }).then(serverItem => {
                    this.updateItemFromServer(item.cartKey, serverItem);
                }).catch(e => console.error(e));
            }

            return nextItems;
        });

        return mutationResult;
    }

    private updateItemFromServer(localCartKey: string, serverItem: ServerCartItem) {
        const mapped = this.mapServerItemToCartItem(serverItem);
        this.cartItems.update(items => {
            const next = items.map(i => i.cartKey === localCartKey ? mapped : i);
            this.persistCart(next);
            return next;
        });
        
        if (localCartKey !== mapped.cartKey) {
            this.selectedCartKeys.update(set => {
                const newSet = new Set(set);
                if (newSet.has(localCartKey)) {
                    newSet.delete(localCartKey);
                    newSet.add(mapped.cartKey);
                }
                this.persistSelectedKeys(newSet);
                return newSet;
            });
        }
    }

    updateCartItemQuantity(cartKey: string, quantity: number): CartMutationResult {
        const safeQuantity = normalizeCartQuantity(quantity);
        let mutationResult: CartMutationResult = {
            quantity: safeQuantity,
            exceededStock: false,
            changed: false,
        };

        let target_id: string | undefined;

        this.cartItems.update((currentItems) => {
            const nextItems = currentItems.map((item) => {
                if (item.cartKey !== cartKey) {
                    return item;
                }

                target_id = item._id;

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

        if (mutationResult.changed && this.serverCartId() && target_id) {
            this.cartApi.updateItem(target_id, { quantity: mutationResult.quantity })
                .catch(e => console.error('Failed to update server quantity', e));
        }

        return mutationResult;
    }
    
    removeFromCart(cartKey: string) {
        let target_id: string | undefined;
        this.cartItems.update((currentItems) => {
            target_id = currentItems.find(i => i.cartKey === cartKey)?._id;
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
        
        if (this.serverCartId() && target_id) {
            this.cartApi.deleteItem(target_id).catch(e => console.error(e));
        }
    }

    clearCart() {
        const items = this.cartItems();
        const promises = [];
        if (this.serverCartId()) {
            for (const item of items) {
                if (item._id) promises.push(this.cartApi.deleteItem(item._id));
            }
        }
        
        this.cartItems.set([]);
        this.persistCart([]);
        this.selectedCartKeys.set(new Set());
        this.persistSelectedKeys(new Set());
        
        Promise.all(promises).catch(e => console.error(e));
    }
    
    clearLocalCart() {
        this.cartItems.set([]);
        this.persistCart([]);
        this.selectedCartKeys.set(new Set());
        this.persistSelectedKeys(new Set());
        this.serverCartId.set(null);
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

        let itemsToRemove: CartItem[] = [];

        this.cartItems.update((currentItems) => {
            itemsToRemove = currentItems.filter(item => keysToRemove.has(item.cartKey));
            const nextItems = currentItems.filter(item => !keysToRemove.has(item.cartKey));
            this.persistCart(nextItems);
            return nextItems;
        });

        this.selectedCartKeys.set(new Set());
        this.persistSelectedKeys(new Set());
        
        if (this.serverCartId()) {
            for (const item of itemsToRemove) {
                if (item._id) this.cartApi.deleteItem(item._id).catch(e => console.error(e));
            }
        }
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
                    _id: item?._id || undefined,
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
                    maxStock: typeof item?.maxStock === 'number' ? item.maxStock : 99,
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
