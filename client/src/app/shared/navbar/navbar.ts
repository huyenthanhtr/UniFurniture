import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { ProductDataService, TaxonomyItem } from '../../services/product-data.service';
import { UiStateService } from '../ui-state.service';

interface RootCategoryItem {
  label: string;
  slug: string;
}

interface NavSubItem {
  id: string;
  label: string;
  type: 'category' | 'collection';
}

interface NavGroupItem {
  root: RootCategoryItem;
  children: NavSubItem[];
}

const ROOM_ORDER = ['phong-ngu', 'phong-khach', 'phong-an', 'phong-lam-viec'];

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
  private readonly router = inject(Router);
  readonly ui = inject(UiStateService);
  private closeMenuTimer: ReturnType<typeof setTimeout> | null = null;

  readonly productGroups = signal<NavGroupItem[]>([]);
  readonly activeGroupSlug = signal('');
  readonly isProductsMenuOpen = signal(false);
  readonly isProductsExpanded = signal(false);
  readonly expandedGroupSlugs = signal<Set<string>>(new Set());
  readonly isHidden = signal(false);
  private lastScrollY = 0;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const currentScroll = window.scrollY || document.documentElement.scrollTop;
    if (currentScroll > this.lastScrollY && currentScroll > 110) {
      this.isHidden.set(true);
    } else {
      this.isHidden.set(false);
    }
    this.lastScrollY = currentScroll;
  }

  readonly activeGroup = computed(() => {
    const activeSlug = this.activeGroupSlug();
    return this.productGroups().find((group) => group.root.slug === activeSlug) || null;
  });

  readonly activeSubItems = computed(() => this.activeGroup()?.children || []);

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

    if (group.root.slug === 'bo-suu-tap') {
      return params;
    }

    const categoryIds = group.children.filter((item) => item.type === 'category').map((item) => item.id);
    if (categoryIds.length > 0) {
      params['categories'] = categoryIds.join(',');
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
      params['categories'] = item.id;
    }

    return params;
  }

  navigateToProductGroup(event: MouseEvent, group: NavGroupItem): void {
    event.preventDefault();
    void this.router.navigate(['/products'], {
      queryParams: {
        ...this.rootQueryParams(group),
        navScroll: String(Date.now()),
      },
    });
  }

  navigateToProductSubItem(event: MouseEvent, item: NavSubItem): void {
    event.preventDefault();
    void this.router.navigate(['/products'], {
      queryParams: {
        ...this.submenuQueryParams(item),
        navScroll: String(Date.now()),
      },
    });
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

  onMobileNavClick(): void {
    this.ui.closeMobileMenu();
    this.isProductsExpanded.set(false);
    this.expandedGroupSlugs.set(new Set());
  }

  toggleProductsExpanded(event: Event): void {
    if (window.innerWidth > 768) return;
    event.preventDefault();
    event.stopPropagation();
    this.isProductsExpanded.update((v) => !v);
  }

  toggleGroupExpansion(event: Event, slug: string): void {
    if (window.innerWidth > 768) return;
    event.preventDefault();
    event.stopPropagation();
    this.expandedGroupSlugs.update((current) => {
      const next = new Set(current);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
    
    this.setActiveGroup(slug);
  }

  private loadProductGroups(): void {
    forkJoin({
      categories: this.productDataService.getCategories().pipe(catchError(() => of([] as TaxonomyItem[]))),
      collections: this.productDataService.getCollections().pipe(catchError(() => of([] as TaxonomyItem[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, collections }) => {
        const groupsMap = new Map<string, NavGroupItem>();

        const collectionChildren: NavSubItem[] = collections
          .map((collection) => ({
            id: collection.id,
            label: collection.name,
            type: 'collection' as const,
          }))
          .sort((left, right) => left.label.localeCompare(right.label, 'vi'));

        groupsMap.set('bo-suu-tap', {
          root: { slug: 'bo-suu-tap', label: 'Bộ sưu tập' },
          children: collectionChildren,
        });

        for (const category of categories) {
          const roomSlug = this.normalizeRoomToGroupSlug(category.room);
          if (!roomSlug) {
            continue;
          }

          if (!groupsMap.has(roomSlug)) {
            groupsMap.set(roomSlug, {
              root: {
                slug: roomSlug,
                label: this.getRoomLabelBySlug(roomSlug),
              },
              children: [],
            });
          }

          groupsMap.get(roomSlug)?.children.push({
            id: category.id,
            label: category.name,
            type: 'category',
          });
        }

        const roomGroups = Array.from(groupsMap.values())
          .filter((group) => group.root.slug !== 'bo-suu-tap')
          .map((group) => ({
            ...group,
            children: group.children.sort((left, right) => left.label.localeCompare(right.label, 'vi')),
          }))
          .sort((left, right) => this.compareRoomOrder(left.root.slug, right.root.slug));

        const collectionGroup = groupsMap.get('bo-suu-tap');
        const groups = collectionGroup ? [collectionGroup, ...roomGroups] : roomGroups;

        this.productGroups.set(groups);
      });
  }

  private normalizeRoomToGroupSlug(room?: string): string {
    if (!room) {
      return '';
    }

    const normalized = room
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized === 'phong ngu') return 'phong-ngu';
    if (normalized === 'phong khach') return 'phong-khach';
    if (normalized === 'phong an') return 'phong-an';
    if (normalized === 'phong lam viec') return 'phong-lam-viec';
    return '';
  }

  private getRoomLabelBySlug(slug: string): string {
    if (slug === 'phong-ngu') return 'Phòng ngủ';
    if (slug === 'phong-khach') return 'Phòng khách';
    if (slug === 'phong-an') return 'Phòng ăn';
    if (slug === 'phong-lam-viec') return 'Phòng làm việc';
    return slug;
  }

  private compareRoomOrder(leftSlug: string, rightSlug: string): number {
    const leftIndex = ROOM_ORDER.indexOf(leftSlug);
    const rightIndex = ROOM_ORDER.indexOf(rightSlug);
    const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return normalizedLeft - normalizedRight;
  }
}
