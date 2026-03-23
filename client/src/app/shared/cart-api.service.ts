import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const API = 'http://localhost:3000/api';

export interface ServerCartItem {
    _id: string;
    cart_id: string;
    variant_id?: {
        _id?: string | null;
        product_id?: {
            _id: string;
            name?: string;
            thumbnail?: string;
            thumbnail_url?: string;
            slug?: string;
            min_price?: number;
            compare_at_price?: number;
            stock_quantity?: number;
        };
        sku?: string;
        color?: string;
        label?: string;
        price?: number;
        compare_at_price?: number;
        stock_quantity?: number;
        images?: string[];
    } | string | null;
    quantity: number;
    unit_price: number;
    createdAt?: string;
}

export interface ServerCart {
    _id: string;
    customer_id: string;
    status: string;
}

export interface ActiveCartResponse {
    cart: ServerCart;
    items: ServerCartItem[];
}

@Injectable({ providedIn: 'root' })
export class CartApiService {
    private readonly http = inject(HttpClient);

    /**
     * Returns the active cart for a customer (creates if not exists),
     * with all items populated.
     */
    async getActiveCart(customerId: string): Promise<ActiveCartResponse> {
        return firstValueFrom(
            this.http.get<ActiveCartResponse>(`${API}/cart/active?customer_id=${customerId}`)
        );
    }

    /**
     * Add or update a cart item (upsert by cart_id + variant_id).
     */
    async upsertItem(params: {
        cart_id: string;
        variant_id: string;
        quantity: number;
        unit_price: number;
    }): Promise<ServerCartItem> {
        return firstValueFrom(
            this.http.post<ServerCartItem>(`${API}/cart/items/upsert`, params)
        );
    }

    /**
     * Update cart item's quantity or unit_price.
     * Returns { merged: boolean, item: ServerCartItem }
     */
    async updateItem(
        itemId: string,
        updates: { quantity?: number; unit_price?: number }
    ): Promise<{ merged: boolean; item: ServerCartItem }> {
        return firstValueFrom(
            this.http.patch<{ merged: boolean; item: ServerCartItem }>(
                `${API}/cart/items/${itemId}`,
                updates
            )
        );
    }

    /**
     * Delete a cart item by its _id.
     */
    async deleteItem(itemId: string): Promise<void> {
        await firstValueFrom(
            this.http.delete(`${API}/cart/items/${itemId}`)
        );
    }
}
