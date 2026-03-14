import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCollections } from './admin-collections';

describe('AdminCollections', () => {
  let component: AdminCollections;
  let fixture: ComponentFixture<AdminCollections>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCollections]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminCollections);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
