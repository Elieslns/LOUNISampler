import { TestBed } from '@angular/core/testing';

import { Freesound } from './freesound';

describe('Freesound', () => {
  let service: Freesound;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Freesound);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
