import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PresetEditor } from './preset-editor';

describe('PresetEditor', () => {
  let component: PresetEditor;
  let fixture: ComponentFixture<PresetEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PresetEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PresetEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
