import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-product-card',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './product-card.html',
    styleUrl: './product-card.css'
})
export class ProductCardComponent {

    @Input() product?: any;

    // Mock mặc định nếu không truyền product
    get displayProduct() {
        return this.product || {
            id: 'mock',
            name: 'Giường Ngủ Gỗ Tràm DALUMD 301 Ver 2 Màu Nâu Hạnh Nhân',
            price: 8990000,
            originalPrice: 10000000,
            imageUrl: 'https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&q=80&w=800',
            discountBadge: '-13%',
            rating: 5,
            reviewsCount: 33,
            soldCount: 135,
            colors: ['#8D7B68', '#F8EDE3']
        };
    }

}