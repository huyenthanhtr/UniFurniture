import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductCardComponent } from '../product-card/product-card';
import { ProductListItem } from '../../services/product-data.service';

@Component({
    selector: 'app-product-grid',
    standalone: true,
    imports: [CommonModule, ProductCardComponent],
    templateUrl: './product-grid.html',
    styleUrl: './product-grid.css'
})
export class ProductGridComponent {

    @Input() products: ProductListItem[] = [];

    trackById(index: number, item: ProductListItem): string | number {
        return item.id || index;
    }

}
