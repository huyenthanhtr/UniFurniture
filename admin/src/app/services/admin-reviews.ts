import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Review } from '../models/review.model';
@Injectable({
  providedIn: 'root',
})
export class AdminReviews {
  private apiUrl = 'http://localhost:3000/api/reviews';

  constructor(private http: HttpClient) { }

  getReviews(): Observable<Review[]> {
    return this.http.get<Review[]>(this.apiUrl);
  }

  updateStatus(id: string, status: string): Observable<Review> {
    return this.http.patch<Review>(`${this.apiUrl}/${id}/status`, { status });
  }

  sendReply(id: string, content: string): Observable<Review> {
    return this.http.post<Review>(`${this.apiUrl}/${id}/reply`, { content });
  }
}