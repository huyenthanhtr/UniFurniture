import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductsService, Product } from '../../services/product/product';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

const BASE_URL = 'http://localhost:3000/api';

interface Category {
  _id: string;
  name: string;
  slug: string;
}

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './homepage.html',
  styleUrl: './homepage.css',
})
export class Homepage implements OnInit {
  cheapProducts: Product[] = [];
  bestSellingProducts: Product[] = [];
  suggestedProducts: Product[] = [];
  bedroomProducts: Product[] = [];

  loading = true;
  error = '';

  constructor(
    private productsService: ProductsService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    this.error = '';

    const categories$ = this.http
      .get<any>(`${BASE_URL}/categories?limit=100`)
      .pipe(catchError(() => of({ items: [] })));

    const cheap$ = this.productsService
      .getProducts({ page: 1, limit: 4, sortBy: 'createdAt', order: 'asc' })
      .pipe(catchError(() => of({ items: [] })));

    const bestSelling$ = this.productsService
      .getProducts({ page: 1, limit: 16, sortBy: 'bestSelling', order: 'desc' })
      .pipe(catchError(() => of({ items: [] })));

    const suggested$ = this.productsService
      .getProducts({ page: 1, limit: 8, sortBy: 'createdAt', order: 'desc' })
      .pipe(catchError(() => of({ items: [] })));

    forkJoin([categories$, cheap$, bestSelling$, suggested$]).subscribe({
      next: ([catRes, cheapRes, bestSellingRes, suggestedRes]) => {
        this.ngZone.run(() => {
          this.cheapProducts = cheapRes.items || [];
          this.bestSellingProducts = bestSellingRes.items || [];
          this.suggestedProducts = suggestedRes.items || [];
          this.loading = false;
          this.cdr.detectChanges();
        });

        // Bedroom in background
        const categories: Category[] = catRes.items || [];
        const bedroom = categories.find(
          (c) =>
            c.name?.toLowerCase().includes('phòng ngủ') ||
            c.slug?.toLowerCase().includes('phong-ngu') ||
            c.slug?.toLowerCase().includes('bedroom')
        );

        if (bedroom) {
          this.productsService
            .getProducts({
              page: 1, limit: 8, sortBy: 'bestSelling', order: 'desc',
              category: bedroom._id,
            })
            .pipe(catchError(() => of({ items: [] })))
            .subscribe((bedroomRes) => {
              this.ngZone.run(() => {
                this.bedroomProducts = bedroomRes.items || [];
                this.cdr.detectChanges();
              });
            });
        }
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.error = err.message || 'Lỗi khi tải sản phẩm';
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
    });
  }

  formatPrice(price: number): string {
    if (!price) return '';
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
  }
}