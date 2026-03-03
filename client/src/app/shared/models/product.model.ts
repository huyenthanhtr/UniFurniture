export interface Product {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    imageUrl: string;
    category?: string;
    color?: string;
    size?: string;
    discountBadge?: string;
    rating?: number;
    reviewsCount?: number;
    soldCount?: number;
    colors?: string[]; // hex codes for swatches
}
