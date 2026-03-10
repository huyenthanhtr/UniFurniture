import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductRecommendations } from './product-recommendations';

describe('ProductRecommendations', () => {
  let component: ProductRecommendations;
  let fixture: ComponentFixture<ProductRecommendations>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductRecommendations]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductRecommendations);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
