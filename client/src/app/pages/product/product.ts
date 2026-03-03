import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductFilterComponent } from '../../shared/product-filter/product-filter';
import { ProductSortComponent } from '../../shared/product-sort/product-sort';
import { ProductGridComponent } from '../../shared/product-grid/product-grid';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, ProductFilterComponent, ProductSortComponent, ProductGridComponent],
  templateUrl: './product.html',
  styleUrl: './product.css',
})
export class ProductComponent {
}
