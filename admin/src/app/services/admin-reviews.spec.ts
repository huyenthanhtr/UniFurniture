import { TestBed } from '@angular/core/testing';

import { AdminReviews } from './admin-reviews';

describe('AdminReviews', () => {
  let service: AdminReviews;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminReviews);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
