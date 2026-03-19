import { Component, DestroyRef, HostListener, effect, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml, Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductGalleryComponent } from '../../shared/product-gallery/product-gallery';
import { ProductInfoComponent } from '../../shared/product-info/product-info';
import { ProductRecommendations } from '../../shared/product-recommendations/product-recommendations';
import {
  ProductDataService,
  ProductDetailData,
  ColorSwatch,
  ProductVariantDocument,
  ProductReviewItem,
} from '../../services/product-data.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, combineLatest, finalize, map } from 'rxjs';

interface ReviewMediaItem {
  type: 'image' | 'video';
  url: string;
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, ProductGalleryComponent, ProductInfoComponent, ProductRecommendations],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productDataService = inject(ProductDataService);
  private readonly titleService = inject(Title);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private loadingGuard: ReturnType<typeof setTimeout> | null = null;
  private pendingDeepLinkFragment: 'product-top' | 'product-reviews' | 'product-review-summary' = 'product-top';

  readonly activeTab = signal<'desc' | 'review'>('desc');
  readonly product = signal<ProductDetailData | null>(null);
  readonly selectedColor = signal<ColorSwatch | null>(null);
  readonly selectedVariant = signal<ProductVariantDocument | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal('');
  readonly currentProductSlug = signal<string | null>(null);
  readonly isDescriptionExpanded = signal(false);
  readonly reviews = signal<ProductReviewItem[]>([]);
  readonly isReviewsLoading = signal(false);
  readonly reviewsError = signal('');
  readonly averageRating = signal(0);
  readonly reviewCount = signal(0);
  readonly reviewStars = [1, 2, 3, 4, 5];
  readonly reviewMediaLimit = 8;
  readonly reviewViewerOpen = signal(false);
  readonly initialReviewLimit = 3;
  readonly showAllReviews = signal(false);
  readonly reviewViewerItems = signal<ReviewMediaItem[]>([]);
  readonly reviewViewerIndex = signal(0);

  readonly visibleReviews = computed(() => (
    this.showAllReviews() ? this.reviews() : this.reviews().slice(0, this.initialReviewLimit)
  ));

  readonly hiddenReviewCount = computed(() => Math.max(0, this.reviews().length - this.initialReviewLimit));

  readonly displayImages = computed(() => {
    const current = this.product();
    if (!current) return [];

    const color = this.selectedColor();
    const variantId = this.selectedVariant()?._id;

    // Filter images by the selected variant if available, otherwise fallback to the selected color
    let filteredImages = [...current.images];
    if (variantId) {
      const matchVariantImages = filteredImages.filter(img => !img.variant_id || img.variant_id === variantId);
      if (matchVariantImages.length > 0) {
        filteredImages = matchVariantImages;
      }
    } else if (color && color.variants && color.variants.length > 0) {
      const validVariantIds = new Set(color.variants.map(v => v._id));
      const matchColorImages = filteredImages.filter(img => !img.variant_id || validVariantIds.has(img.variant_id));
      if (matchColorImages.length > 0) {
        filteredImages = matchColorImages;
      }
    }

    // Map to strings for the native gallery
    const imagesUrls = filteredImages.map(img => img.url);

    if (color?.imageUrl) {
      // If the selected color has a primary image, ensure it's at the front
      const colorImgIndex = imagesUrls.indexOf(color.imageUrl);
      if (colorImgIndex > -1) {
        imagesUrls.splice(colorImgIndex, 1);
        imagesUrls.unshift(color.imageUrl);
      } else {
        imagesUrls.unshift(color.imageUrl);
      }
    }
    return imagesUrls;
  });

  readonly normalizedDescriptionHtml = computed(() => {
    const current = this.product();
    const rawDescription = current?.description || current?.shortDescription || 'ThÃ´ng tin Ä‘ang cáº­p nháº­t.';
    return this.normalizeDescriptionMedia(rawDescription);
  });

  readonly descriptionHtml = computed<SafeHtml>(() => {
    return this.sanitizer.bypassSecurityTrustHtml(this.normalizedDescriptionHtml());
  });
  readonly shouldCollapseDescription = computed(() => {
    const html = this.normalizedDescriptionHtml();
    const imageCount = (html.match(/<img\b/gi) || []).length;
    const textLength = html.replace(/<[^>]+>/g, '').trim().length;
    return imageCount >= 2 || textLength > 1400;
  });

  private readonly resetDescriptionState = effect(() => {
    this.descriptionHtml();
    this.isDescriptionExpanded.set(false);
  });

  ngOnInit(): void {
    combineLatest([
      this.route.paramMap.pipe(map((params) => params.get('slug'))),
      this.route.queryParamMap,
      this.route.fragment,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([productSlug, queryParams, fragment]) => {
        if (!productSlug) {
          this.errorMessage.set('KhÃ´ng tÃ¬m tháº¥y mÃ£ sáº£n pháº©m.');
          this.isLoading.set(false);
          return;
        }

        const tab = queryParams.get('tab');
        this.activeTab.set(tab === 'review' ? 'review' : 'desc');

        const nextFragment = (fragment || '').trim();
        if (nextFragment === 'product-review-summary') {
          this.pendingDeepLinkFragment = 'product-review-summary';
        } else if (nextFragment === 'product-reviews' || (tab === 'review' && !nextFragment)) {
          this.pendingDeepLinkFragment = 'product-reviews';
        } else {
          this.pendingDeepLinkFragment = 'product-top';
        }

        const previousProductSlug = this.currentProductSlug();
        this.currentProductSlug.set(productSlug);

        if (previousProductSlug !== productSlug || !this.product()) {
          this.loadProduct(productSlug);
          return;
        }

        this.scrollToDeepLink(this.pendingDeepLinkFragment);
      });
  }

  setActiveTab(tab: 'desc' | 'review'): void {
    this.activeTab.set(tab);
  }

  onColorChanged(color: ColorSwatch): void {
    this.selectedColor.set(color);
  }

  onVariantChanged(variant: ProductVariantDocument | null): void {
    this.selectedVariant.set(variant);
  }

  showMoreReviews(): void {
    this.showAllReviews.set(true);
  }

  showLessReviews(): void {
    this.showAllReviews.set(false);
  }

  retry(): void {
    const productSlug = this.currentProductSlug();
    if (productSlug) {
      this.loadProduct(productSlug);
    }
  }

  toggleDescription(): void {
    this.isDescriptionExpanded.update((expanded) => !expanded);
  }

  private scrollToDeepLink(fragment: 'product-top' | 'product-reviews' | 'product-review-summary'): void {
    let retries = 0;
    const maxRetries = 18;

    const alignToSection = (node: HTMLElement) => {
      const scrollTopNow = () => window.scrollTo({ top: 0, behavior: 'auto' });
      if (fragment === 'product-top') {
        scrollTopNow();
        setTimeout(scrollTopNow, 120);
        setTimeout(scrollTopNow, 360);
        return;
      }

      // Multi-pass scroll keeps anchor stable while review media is still rendering.
      const offset = 140;
      const scrollNow = () => {
        node.scrollIntoView({ block: 'start', behavior: 'auto' });
        window.scrollBy({ top: -offset, behavior: 'auto' });
      };

      scrollNow();
      setTimeout(scrollNow, 120);
      setTimeout(scrollNow, 360);
      setTimeout(scrollNow, 720);
    };

    const tryScroll = () => {
      if ((fragment === 'product-reviews' || fragment === 'product-review-summary') && this.activeTab() !== 'review') {
        this.activeTab.set('review');
      }

      const node = (document.getElementById(fragment)
        || (fragment === 'product-review-summary' ? document.getElementById('product-reviews') : null)) as HTMLElement | null;
      if (node) {
        alignToSection(node);
        return;
      }

      if (retries < maxRetries) {
        retries += 1;
        requestAnimationFrame(tryScroll);
      }
    };

    requestAnimationFrame(tryScroll);
  }

  getReviewMediaItems(review: ProductReviewItem): ReviewMediaItem[] {
    const images = Array.isArray(review.images)
      ? review.images.filter(Boolean).map((url) => ({ type: 'image' as const, url }))
      : [];
    const videos = Array.isArray(review.videos)
      ? review.videos.filter(Boolean).map((url) => ({ type: 'video' as const, url }))
      : [];

    return [...images, ...videos];
  }

  getReviewVisibleMedia(review: ProductReviewItem): ReviewMediaItem[] {
    return this.getReviewMediaItems(review).slice(0, this.reviewMediaLimit);
  }

  getReviewHiddenMediaCount(review: ProductReviewItem): number {
    const remain = this.getReviewMediaItems(review).length - this.reviewMediaLimit;
    return remain > 0 ? remain : 0;
  }

  openReviewMediaViewer(review: ProductReviewItem, index: number): void {
    const items = this.getReviewMediaItems(review);
    if (!items.length) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, items.length - 1));
    this.reviewViewerItems.set(items);
    this.reviewViewerIndex.set(safeIndex);
    this.reviewViewerOpen.set(true);
  }

  closeReviewMediaViewer(): void {
    this.reviewViewerOpen.set(false);
    this.reviewViewerItems.set([]);
    this.reviewViewerIndex.set(0);
  }

  reviewViewerPrev(): void {
    const current = this.reviewViewerIndex();
    if (current > 0) {
      this.reviewViewerIndex.set(current - 1);
    }
  }

  reviewViewerNext(): void {
    const current = this.reviewViewerIndex();
    const max = this.reviewViewerItems().length - 1;
    if (current < max) {
      this.reviewViewerIndex.set(current + 1);
    }
  }

  isReviewViewerMediaVideo(): boolean {
    const current = this.reviewViewerItems()[this.reviewViewerIndex()];
    return current?.type === 'video';
  }

  get reviewViewerCurrentUrl(): string {
    const current = this.reviewViewerItems()[this.reviewViewerIndex()];
    return current?.url || '';
  }

  @HostListener('document:keydown', ['$event'])
  onReviewViewerKeyboard(event: KeyboardEvent): void {
    if (!this.reviewViewerOpen()) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.reviewViewerPrev();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.reviewViewerNext();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeReviewMediaViewer();
    }
  }

  private loadProduct(productSlug: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.product.set(null);
    this.selectedColor.set(null);
    this.selectedVariant.set(null);
    this.reviews.set([]);
    this.isReviewsLoading.set(false);
    this.reviewsError.set('');
    this.averageRating.set(0);
    this.reviewCount.set(0);
    this.clearLoadingGuard();
    this.loadingGuard = setTimeout(() => {
      this.isLoading.set(false);
      this.errorMessage.set('Táº£i chi tiáº¿t sáº£n pháº©m quÃ¡ lÃ¢u. Vui lÃ²ng thá»­ láº¡i.');
    }, 12000);

    this.productDataService
      .getProductDetail(productSlug)
      .pipe(
        catchError(() => {
          this.errorMessage.set('KhÃ´ng thá»ƒ táº£i chi tiáº¿t sáº£n pháº©m.');
          return EMPTY;
        }),
        finalize(() => {
          this.clearLoadingGuard();
          this.isLoading.set(false);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((product) => {
        this.product.set(product);
        this.loadReviews(product.id);
        this.scrollToDeepLink(this.pendingDeepLinkFragment);
      });
  }

  private loadReviews(productId: string): void {
    this.isReviewsLoading.set(true);
    this.reviewsError.set('');

    this.productDataService
      .getProductReviews(productId)
      .pipe(
        finalize(() => this.isReviewsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          this.reviews.set(response.items || []);
          this.averageRating.set(response.averageRating || 0);
          this.reviewCount.set(response.totalReviews || 0);
          this.showAllReviews.set(false);
        },
        error: () => {
          this.reviews.set([]);
          this.averageRating.set(0);
          this.reviewCount.set(0);
          this.showAllReviews.set(false);
          this.reviewsError.set('KhÃ´ng thá»ƒ táº£i Ä‘Ã¡nh giÃ¡ sáº£n pháº©m');
        },
      });
  }

  private clearLoadingGuard(): void {
    if (this.loadingGuard !== null) {
      clearTimeout(this.loadingGuard);
      this.loadingGuard = null;
    }
  }

  private normalizeDescriptionMedia(html: string): string {
    const container = document.createElement('div');
    container.innerHTML = String(html || '');

    container.querySelectorAll<HTMLElement>('*').forEach((element) => {
      element.style.maxWidth = '100%';
      element.style.boxSizing = 'border-box';
    });

    container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((element) => {
      element.style.textAlign = 'left';
      element.style.marginLeft = '0';
      element.style.marginRight = '0';
    });

    container.querySelectorAll<HTMLElement>('img, video, iframe').forEach((element) => {
      const rawSrc = element.getAttribute('src') || '';
      if (rawSrc.startsWith('//')) element.setAttribute('src', `https:${rawSrc}`);
      if (rawSrc.startsWith('/assets/upload/')) element.setAttribute('src', `http://localhost:3000${rawSrc}`);
      if (rawSrc.startsWith('/uploads/')) element.setAttribute('src', `http://localhost:3000${rawSrc}`);
      element.style.display = 'block';
      element.style.width = '70%';
      element.style.maxWidth = '70%';
      element.style.height = 'auto';
      element.style.margin = '14px auto';
      if (element.tagName === 'IFRAME' || element.tagName === 'VIDEO') {
        element.style.aspectRatio = '16 / 9';
      }
    });

    return container.innerHTML;
  }

  private removeTrailingVideoBlock(container: HTMLElement): void {
    const removableBlock = this.findTrailingVideoBlock(container);
    if (!removableBlock) {
      return;
    }

    removableBlock.remove();
    this.pruneEmptyAncestors(removableBlock.parentElement, container);
  }

  private cleanupDescriptionLayout(container: HTMLElement): void {
    container.querySelectorAll<HTMLElement>('*').forEach((element) => {
      const tagName = element.tagName.toLowerCase();
      element.style.minHeight = '';

      if (!['img', 'video', 'iframe'].includes(tagName)) {
        element.style.height = '';
        element.style.maxHeight = '';
      }
    });

    const candidates = Array.from(container.querySelectorAll<HTMLElement>('*'));
    candidates.reverse().forEach((element) => {
      if (this.isDisposableEmptyElement(element)) {
        element.remove();
      }
    });
  }

  private groupConsecutiveMediaBlocks(container: HTMLElement): void {
    Array.from(container.children).forEach((child) => {
      if (child instanceof HTMLElement && !child.classList.contains('description-media-grid')) {
        this.groupConsecutiveMediaBlocks(child);
      }
    });

    const nodes = Array.from(container.childNodes);
    const fragment = document.createDocumentFragment();
    let pendingRun: Node[] = [];
    let mediaCount = 0;

    const flushPendingRun = () => {
      if (pendingRun.length === 0) return;

      if (mediaCount >= 2) {
        const grid = document.createElement('div');
        grid.className = 'description-media-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
        grid.style.gap = '16px';
        grid.style.margin = '18px 0';
        grid.style.alignItems = 'start';

        pendingRun.forEach((node) => {
          if (node instanceof HTMLElement) {
            node.style.margin = '0';
            node.style.width = '100%';
            node.style.maxWidth = '100%';
            node.style.display = 'flex';
            node.style.justifyContent = 'center';
            node.style.alignItems = 'flex-start';
          }
          grid.appendChild(node);
        });
        fragment.appendChild(grid);
      } else {
        pendingRun.forEach((node) => fragment.appendChild(node));
      }

      pendingRun = [];
      mediaCount = 0;
    };

    nodes.forEach((node) => {
      const nodeType = this.classifyDescriptionNode(node);

      if (nodeType === 'media') {
        pendingRun.push(node);
        mediaCount += 1;
        return;
      }

      if (nodeType === 'whitespace' && mediaCount > 0) {
        pendingRun.push(node);
        return;
      }

      flushPendingRun();
      fragment.appendChild(node);
    });

    flushPendingRun();
    container.replaceChildren(fragment);
  }

  private classifyDescriptionNode(node: Node): 'media' | 'whitespace' | 'other' {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').trim() ? 'other' : 'whitespace';
    }

    if (!(node instanceof HTMLElement)) {
      return 'other';
    }

    if (node.tagName === 'BR') {
      return 'whitespace';
    }

    return this.isMediaOnlyElement(node) ? 'media' : 'other';
  }

  private isMediaOnlyElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    if (['img', 'video', 'iframe', 'picture'].includes(tagName)) {
      return true;
    }

    const mediaElements = Array.from(element.querySelectorAll('img, video, iframe'));
    if (mediaElements.length !== 1) {
      return false;
    }

    const textContent = (element.textContent || '').replace(/\u00a0/g, ' ').trim();
    if (textContent) {
      return false;
    }

    return Array.from(element.querySelectorAll('*')).every((child) => {
      const childTag = child.tagName.toLowerCase();
      return ['img', 'video', 'iframe', 'source', 'br', 'a', 'picture'].includes(childTag);
    });
  }

  private isTrailingVideoBlock(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'video' || tagName === 'iframe') {
      return true;
    }

    if (!this.isMediaOnlyElement(element)) {
      return false;
    }

    return Boolean(element.querySelector('video, iframe'));
  }

  private findTrailingVideoBlock(container: HTMLElement): HTMLElement | null {
    const lastMeaningfulNode = this.findLastMeaningfulNode(container);
    if (!(lastMeaningfulNode instanceof HTMLElement)) {
      return null;
    }

    let current: HTMLElement | null = lastMeaningfulNode;
    let removable: HTMLElement | null = this.isTrailingVideoBlock(current) ? current : null;

    while (current && current !== container) {
      if (this.isTrailingVideoBlock(current)) {
        removable = current;
      }

      const parent: HTMLElement | null = current.parentElement;
      if (!parent || parent === container || !this.isTrailingVideoBlock(parent)) {
        break;
      }

      current = parent;
    }

    return removable;
  }

  private findLastMeaningfulNode(root: HTMLElement): Node | null {
    const childNodes = Array.from(root.childNodes);

    for (let index = childNodes.length - 1; index >= 0; index -= 1) {
      const node = childNodes[index];
      if (this.classifyDescriptionNode(node) === 'whitespace') {
        continue;
      }

      if (node instanceof HTMLElement) {
        const nested = this.findLastMeaningfulNode(node);
        return nested || node;
      }

      return node;
    }

    return null;
  }

  private pruneEmptyAncestors(element: HTMLElement | null, boundary: HTMLElement): void {
    let current = element;

    while (current && current !== boundary && this.isDisposableEmptyElement(current)) {
      const parent: HTMLElement | null = current.parentElement;
      current.remove();
      current = parent;
    }
  }

  private isDisposableEmptyElement(element: HTMLElement): boolean {
    const childElements = Array.from(element.children) as HTMLElement[];
    if (childElements.some((child) => child.tagName !== 'BR')) {
      return false;
    }

    const textContent = (element.textContent || '').replace(/\u00a0/g, ' ').trim();
    if (textContent) {
      return false;
    }

    return Array.from(element.childNodes).every((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return !(node.textContent || '').replace(/\u00a0/g, ' ').trim();
      }

      return node instanceof HTMLElement && node.tagName === 'BR';
    });
  }
}

