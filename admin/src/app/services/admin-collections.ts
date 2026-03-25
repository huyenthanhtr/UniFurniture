import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CollectionService {
  private apiUrl = 'http://localhost:3000/api/collections';

  constructor(private http: HttpClient) {}

getProductsByCollection(collectionId: string) {
  return this.http.get<any>(`${this.apiUrl}/${collectionId}/products`);
}
  getAllCollections(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  createCollection(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  updateCollection(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }

  deleteCollection(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}