import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

const BASE_URL = 'http://localhost:3000/api';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly productsUrl = `${BASE_URL}/products`;

  constructor(private http: HttpClient) { }

  getProducts(options?: {
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'bestSelling';
    order?: 'asc' | 'desc';
    category?: string;
    collection?: string;
  }): Observable<any> {

    let params = new HttpParams();

    if (options?.page)
      params = params.set('page', options.page.toString());

    if (options?.limit)
      params = params.set('limit', options.limit.toString());

    // Use "sort" for compatibility with both generic and dedicated product APIs
    if (options?.sortBy) {
      const sortDirection = options.order === 'asc' ? '' : '-';
      const sortField = options.sortBy === 'bestSelling' ? 'sold' : 'createdAt';
      params = params.set('sort', `${sortDirection}${sortField}`);
    }

    if (options?.category)
      params = params.set('category_id', options.category);

    if (options?.collection)
      params = params.set('collection_id', options.collection);

    return this.http
      .get<any>(this.productsUrl, { params })
      .pipe(
        catchError((error) => this.handleError(error))
      );
  }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => new Error(error.message || 'Server Error'));
  }
}
export interface Product {
  _id: string;
  name: string;
  price?: number;
  min_price?: number;
  thumbnail?: string;
  thumbnail_url?: string;
  url?: string;
  slug?: string;
  brand?: string;
  short_description?: string;
  category_id?: string;
  collection_id?: string;
  createdAt?: string;
  sold?: number;
}
