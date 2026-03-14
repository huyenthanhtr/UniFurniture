import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCategoryList } from './admin-category-list';

describe('AdminCategoryList', () => {
  let component: AdminCategoryList;
  let fixture: ComponentFixture<AdminCategoryList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCategoryList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminCategoryList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
