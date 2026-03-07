import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { NewsPost, PostDataService } from '../../services/post-data.service';

const FALLBACK_NEWS_IMAGE =
  'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=1200';

@Component({
  selector: 'app-news-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './news-detail.html',
  styleUrl: './news-detail.css',
})
export class NewsDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly postDataService = inject(PostDataService);

  readonly fallbackImageUrl = FALLBACK_NEWS_IMAGE;

  post: NewsPost | null = null;
  latestPosts: NewsPost[] = [];
  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const slug = (params.get('slug') || '').trim();
          this.loading = true;
          this.errorMessage = '';
          this.post = null;

          return forkJoin({
            post: this.postDataService.getPostBySlug(slug),
            latest: this.postDataService.getLatestPosts(10, slug),
          });
        }),
      )
      .subscribe({
        next: ({ post, latest }) => {
          this.loading = false;
          this.latestPosts = latest;

          if (!post) {
            this.errorMessage = 'Khong tim thay bai viet.';
            return;
          }

          this.post = post;
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'Khong the tai noi dung bai viet.';
        },
      });
  }

  get sidebarPosts(): NewsPost[] {
    if (!this.post) {
      return this.latestPosts.slice(0, 8);
    }
    const others = this.latestPosts.filter((item) => item.slug !== this.post?.slug);
    return [this.post, ...others].slice(0, 8);
  }

  trackByPostId(index: number, post: NewsPost): string {
    return post.id || post.slug || String(index);
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
}
