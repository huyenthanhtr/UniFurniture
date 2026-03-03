import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-product-filter',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './product-filter.html',
    styleUrl: './product-filter.css'
})
export class ProductFilterComponent {
    categories = ['Tất cả', 'Ghế', 'Bàn', 'Tủ', 'Giường'];
    colors = [
        { name: 'Đen', code: '#000000' },
        { name: 'Trắng', code: '#ffffff' },
        { name: 'Xám', code: '#808080' },
        { name: 'Nâu', code: '#8B4513' }
    ];
    sizes = ['Nhỏ', 'Vừa', 'Lớn'];
}
