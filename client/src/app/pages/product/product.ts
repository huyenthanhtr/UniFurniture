import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ProductFilterComponent } from '../../shared/product-filter/product-filter';
import { ProductSortComponent } from '../../shared/product-sort/product-sort';
import { ProductGridComponent } from '../../shared/product-grid/product-grid';
import { ProductsService } from '../../services/product/product';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, ProductFilterComponent, ProductSortComponent, ProductGridComponent],
  templateUrl: './product.html',
  styleUrl: './product.css',
})
export class ProductComponent implements OnInit {
  products: any[] = [];
  pageTitle = 'Tất Cả Sản Phẩm';
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private productsService: ProductsService
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.pageTitle = params['title'] || 'Tất Cả Sản Phẩm';
      const categories = params['categories'] || '';
      const collection = params['collection'] || '';
      this.loadProducts(categories, collection);
    });
  }

  loadProducts(categories: string, collection: string) {
    this.loading = true;
    this.productsService.getProducts({
      page: 1,
      limit: 48,
      sortBy: 'bestSelling',
      order: 'desc',
      category: categories || undefined,
      collection: collection || undefined,
    }).subscribe({
      next: (res) => {
        this.products = res.items || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }
}
