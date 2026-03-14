import { TestBed } from '@angular/core/testing';

import { AdminCategories } from './admin-categories';

describe('AdminCategories', () => {
  let service: AdminCategories;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminCategories);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
