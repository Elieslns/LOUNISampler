import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SampleManager } from './sample-manager';

describe('SampleManager', () => {
  let component: SampleManager;
  let fixture: ComponentFixture<SampleManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SampleManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SampleManager);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
