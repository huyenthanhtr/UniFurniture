import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import { ProductDataService, TaxonomyItem } from '../../services/product-data.service';

interface RootCategoryItem {
  label: string;
  slug: string;
  categorySlugs: string[];
}

interface NavSubItem {
  id: string;
  label: string;
  type: 'collection' | 'category';
}

interface NavGroupItem {
  root: RootCategoryItem;
  children: NavSubItem[];
}

const ROOT_CATEGORIES: RootCategoryItem[] = [
  { label: 'B\u1ed9 S\u01b0u T\u1eadp', slug: 'bo-suu-tap', categorySlugs: [] },
  {
    label: 'Ph\u00f2ng Ng\u1ee7',
    slug: 'phong-ngu',
    categorySlugs: ['combo-phong-ngu', 'tu-quan-ao', 'giuong-ngu', 'tu-dau-giuong', 'ban-trang-diem'],
  },
  {
    label: 'Ph\u00f2ng Kh\u00e1ch',
    slug: 'phong-khach',
    categorySlugs: ['ghe-sofa', 'ban-sofa-ban-cafe-ban-tra', 'tu-ke-tivi', 'tu-giay-tu-trang-tri', 'tu-ke'],
  },
  { label: 'Ph\u00f2ng \u0102n', slug: 'phong-an', categorySlugs: ['ban-an', 'ghe-an', 'bo-ban-an'] },
  { label: 'Ph\u00f2ng L\u00e0m Vi\u1ec7c', slug: 'phong-lam-viec', categorySlugs: ['ban-lam-viec', 'ghe-van-phong'] },
  { label: 'T\u1ee7 B\u1ebfp', slug: 'tu-bep', categorySlugs: ['tu-ke'] },
  { label: 'N\u1ec7m', slug: 'nem', categorySlugs: ['combo-phong-ngu', 'giuong-ngu'] },
];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  private readonly productDataService = inject(ProductDataService);
  private readonly destroyRef = inject(DestroyRef);
  private closeMenuTimer: ReturnType<typeof setTimeout> | null = null;

  readonly productGroups = signal<NavGroupItem[]>([]);
  readonly activeGroupSlug = signal('');
  readonly isProductsMenuOpen = signal(false);
  readonly activeGroup = computed(() => {
    const activeSlug = this.activeGroupSlug();
    return this.productGroups().find((group) => group.root.slug === activeSlug) || null;
  });

  readonly activeSubItems = computed(() => {
    return this.activeGroup()?.children || [];
  });

  ngOnInit(): void {
    this.loadProductGroups();
  }

  trackByGroup(_: number, item: NavGroupItem): string {
    return item.root.slug;
  }

  trackBySubItem(_: number, item: NavSubItem): string {
    return `${item.type}-${item.id}`;
  }

  rootQueryParams(group: NavGroupItem): Record<string, string> {
    const params: Record<string, string> = {
      group: group.root.slug,
      groupLabel: group.root.label,
    };

    const categoryIds = group.children.filter((item) => item.type === 'category').map((item) => item.id);
    if (categoryIds.length > 0) {
      params['category'] = categoryIds.join(',');
    }

    return params;
  }

  submenuQueryParams(item: NavSubItem): Record<string, string> {
    const params: Record<string, string> = {};
    const activeGroup = this.activeGroup();
    if (activeGroup) {
      params['group'] = activeGroup.root.slug;
      params['groupLabel'] = activeGroup.root.label;
    }

    if (item.type === 'collection') {
      params['collection'] = item.id;
    } else {
      params['category'] = item.id;
    }

    return params;
  }

  openProductsMenu(): void {
    this.cancelCloseProductsMenu();
    this.isProductsMenuOpen.set(true);
  }

  scheduleCloseProductsMenu(): void {
    this.cancelCloseProductsMenu();
    this.closeMenuTimer = setTimeout(() => {
      this.isProductsMenuOpen.set(false);
      this.activeGroupSlug.set('');
    }, 180);
  }

  cancelCloseProductsMenu(): void {
    if (this.closeMenuTimer !== null) {
      clearTimeout(this.closeMenuTimer);
      this.closeMenuTimer = null;
    }
  }

  setActiveGroup(slug: string): void {
    this.activeGroupSlug.set(slug);
  }

  private loadProductGroups(): void {
    forkJoin({
      categories: this.productDataService.getCategories().pipe(catchError(() => of([] as TaxonomyItem[]))),
      collections: this.productDataService.getCollections().pipe(catchError(() => of([] as TaxonomyItem[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, collections }) => {
        const categoryBySlug = new Map(categories.map((item) => [item.slug, item]));

        const groups: NavGroupItem[] = ROOT_CATEGORIES.map((root) => {
          if (root.slug === 'bo-suu-tap') {
            const children: NavSubItem[] = collections
              .map((collection) => ({
                id: collection.id,
                label: collection.name,
                type: 'collection' as const,
              }))
              .sort((left, right) => left.label.localeCompare(right.label, 'vi'));
            return { root, children };
          }

          const children: NavSubItem[] = root.categorySlugs
            .map((slug) => categoryBySlug.get(slug))
            .filter((item): item is TaxonomyItem => Boolean(item))
            .map((category) => ({
              id: category.id,
              label: category.name,
              type: 'category' as const,
            }));

          return { root, children };
        });

        this.productGroups.set(groups);
      });
  }
}
