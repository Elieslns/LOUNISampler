import { TestBed } from '@angular/core/testing';

import { Preset } from './preset';

describe('Preset', () => {
  let service: Preset;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Preset);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
