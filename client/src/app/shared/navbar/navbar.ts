import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

const BASE_URL = 'http://localhost:3000/api';

interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface Collection {
  _id: string;
  name: string;
  slug: string;
}

interface MenuGroup {
  label: string;
  slugs: string[];       // slugs of child categories belonging to this group
  childCategories?: Category[];
  allCategoryIds?: string[];  // IDs of all children, used when clicking parent
}

// Fixed menu structure (parent groups → child category slugs)
const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Phòng Ngủ',
    slugs: ['combo-phong-ngu', 'tu-quan-ao', 'giuong-ngu', 'tu-dau-giuong', 'ban-trang-diem'],
  },
  {
    label: 'Phòng Khách',
    slugs: ['ghe-sofa', 'ban-sofa-ban-cafe-ban-tra', 'tu-ke-tivi', 'tu-giay-tu-trang-tri'],
  },
  {
    label: 'Phòng Ăn',
    slugs: ['ban-an', 'ghe-an', 'bo-ban-an'],
  },
  {
    label: 'Phòng Làm Việc',
    slugs: ['ban-lam-viec', 'ghe-van-phong', 'tu-ke'],
  },
  {
    label: 'Tủ Bếp',
    slugs: ['tu-bep'],
  },
  {
    label: 'Nệm',
    slugs: ['nem'],
  },
];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  menuOpen = false;
  activeGroupIndex = -1;

  collections: Collection[] = [];
  menuGroups: MenuGroup[] = [];

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit() {
    forkJoin([
      this.http.get<any>(`${BASE_URL}/categories?limit=100`).pipe(
        map(r => (r.items || []) as Category[]),
        catchError(() => of([] as Category[]))
      ),
      this.http.get<any>(`${BASE_URL}/collections?limit=100`).pipe(
        map(r => (r.items || []) as Collection[]),
        catchError(() => of([] as Collection[]))
      ),
    ]).subscribe(([categories, collections]) => {
      this.collections = collections;
      // Map categories into fixed groups
      this.menuGroups = MENU_GROUPS.map(group => {
        const children = group.slugs
          .map(slug => categories.find(c => c.slug === slug))
          .filter((c): c is Category => !!c);
        return {
          ...group,
          childCategories: children,
          allCategoryIds: children.map(c => c._id),
        };
      });
    });
  }

  openMenu() {
    this.menuOpen = true;
  }

  setActiveGroup(i: number) {
    this.activeGroupIndex = i;
  }

  closeMenu() {
    this.menuOpen = false;
    this.activeGroupIndex = -1;
  }

  navigateToGroup(group: MenuGroup) {
    const ids = group.allCategoryIds?.join(',') || '';
    this.router.navigate(['/danh-muc'], { queryParams: { categories: ids, title: group.label } });
    this.closeMenu();
  }

  navigateToCategory(cat: Category) {
    this.router.navigate(['/danh-muc'], { queryParams: { slug: cat.slug, title: cat.name } });
    this.closeMenu();
  }

  navigateToCollection(col: Collection) {
    this.router.navigate(['/danh-muc'], { queryParams: { collection: col._id, title: col.name } });
    this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.has-megamenu')) {
      this.closeMenu();
    }
  }
}
