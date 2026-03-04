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

    if (options?.sortBy)
      params = params.set('sortBy', options.sortBy);

    if (options?.order)
      params = params.set('order', options.order);

    if (options?.category)
      params = params.set('category', options.category);

    if (options?.collection)
      params = params.set('collection', options.collection);

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
  thumbnail?: string;      // actual DB field name
  thumbnail_url?: string;  // keep for backward compat
  url?: string;
  slug?: string;
  brand?: string;
  short_description?: string;
  category_id?: string;
  collection_id?: string;
  createdAt?: string;
  sold?: number;
}