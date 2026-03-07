import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, switchMap, timeout } from 'rxjs';

interface ApiListResponse<T> {
  page: number;
  limit: number;
  total: number;
  items: T[];
}

interface PostDocument {
  _id: string;
  title?: string;
  slug?: string;
  content?: string;
  thumbnail_url?: string;
  post_category?: string;
  status?: 'published' | 'draft';
  createdAt?: string;
  updatedAt?: string;
}

export interface NewsPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  thumbnailUrl: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewsPostListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: NewsPost[];
}

const FALLBACK_NEWS_IMAGE =
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=1200';

@Injectable({ providedIn: 'root' })
export class PostDataService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:3000/api';

  getNewsPosts(page = 1, limit = 24): Observable<NewsPostListResponse> {
    const baseParams = {
      page: String(page),
      limit: String(limit),
      sort: '-createdAt',
    };

    return this.requestPostList({ ...baseParams, status: 'published' }).pipe(
      switchMap((response) => (response.items.length ? of(response) : this.requestPostList(baseParams))),
    );
  }

  getLatestPosts(limit = 8, excludeSlug = ''): Observable<NewsPost[]> {
    const safeLimit = Math.max(limit, 1);
    return this.getNewsPosts(1, Math.max(safeLimit + 1, 8)).pipe(
      map((response) =>
        response.items.filter((post) => post.slug !== excludeSlug).slice(0, safeLimit),
      ),
    );
  }

  getPostBySlug(slug: string): Observable<NewsPost | null> {
    const safeSlug = slug.trim();
    if (!safeSlug) {
      return of(null);
    }

    const baseParams = { slug: safeSlug, page: '1', limit: '1', sort: '-createdAt' };

    return this.requestPostList({ ...baseParams, status: 'published' }).pipe(
      switchMap((response) => {
        if (response.items.length) {
          return of(response.items[0]);
        }
        return this.requestPostList(baseParams).pipe(
          map((fallbackResponse) => fallbackResponse.items[0] ?? null),
        );
      }),
    );
  }

  private requestPostList(params: Record<string, string>): Observable<NewsPostListResponse> {
    return this.http.get<ApiListResponse<PostDocument>>(`${this.apiBaseUrl}/post`, { params }).pipe(
      timeout(10000),
      map((response) => {
        const fallbackPage = Number(params['page'] || '1');
        const fallbackLimit = Number(params['limit'] || '24');
        const page = response.page || fallbackPage;
        const limit = response.limit || fallbackLimit;
        const total = response.total || 0;
        const items = (response.items || []).map((post) => this.mapPost(post));

        return {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / Math.max(limit, 1)), 1),
          items,
        };
      }),
    );
  }

  private mapPost(post: PostDocument): NewsPost {
    const id = post._id || '';
    const slug = post.slug?.trim() || id;
    return {
      id,
      title: post.title?.trim() || 'Bai viet',
      slug,
      content: post.content || '',
      thumbnailUrl: post.thumbnail_url?.trim() || FALLBACK_NEWS_IMAGE,
      category: post.post_category?.trim() || 'Media',
      status: post.status || 'draft',
      createdAt: post.createdAt || '',
      updatedAt: post.updatedAt || '',
    };
  }
}
