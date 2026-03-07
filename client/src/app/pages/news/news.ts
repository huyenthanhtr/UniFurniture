import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { NewsPost, PostDataService } from '../../services/post-data.service';

const FALLBACK_NEWS_IMAGE =
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=1200';

@Component({
  selector: 'app-news-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './news.html',
  styleUrl: './news.css',
})
export class NewsPageComponent implements OnInit {
  private readonly postDataService = inject(PostDataService);

  readonly fallbackImageUrl = FALLBACK_NEWS_IMAGE;

  posts: NewsPost[] = [];
  latestPosts: NewsPost[] = [];
  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.loadNews();
  }

  trackByPostId(index: number, post: NewsPost): string {
    return post.id || post.slug || String(index);
  }

  excerpt(content: string, maxLength = 140): string {
    const plainText = this.toPlainText(content);
    if (plainText.length <= maxLength) {
      return plainText;
    }
    return `${plainText.slice(0, maxLength).trim()}...`;
  }

  formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const [day, month, year] = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date).split('/');
    return `${day}.${month}.${year}`;
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (image) {
      image.src = this.fallbackImageUrl;
    }
  }

  private loadNews(): void {
    this.loading = true;
    this.errorMessage = '';

    this.postDataService
      .getNewsPosts(1, 24)
      .pipe(
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.posts = response.items;
          this.latestPosts = response.items.slice(0, 8);
        },
        error: () => {
          this.posts = [];
          this.latestPosts = [];
          this.errorMessage = 'Khong the tai danh sach bai viet.';
        },
      });
  }

  private toPlainText(value: string): string {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}
