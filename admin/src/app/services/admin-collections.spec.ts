import { TestBed } from '@angular/core/testing';

import { AdminCollections } from './admin-collections';

describe('AdminCollections', () => {
  let service: AdminCollections;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminCollections);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
