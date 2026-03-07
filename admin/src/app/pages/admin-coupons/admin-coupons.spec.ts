import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminCoupons } from './admin-coupons';

describe('AdminCoupons', () => {
  let component: AdminCoupons;
  let fixture: ComponentFixture<AdminCoupons>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCoupons]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminCoupons);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
