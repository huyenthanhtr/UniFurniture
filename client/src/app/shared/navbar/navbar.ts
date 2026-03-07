import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
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
