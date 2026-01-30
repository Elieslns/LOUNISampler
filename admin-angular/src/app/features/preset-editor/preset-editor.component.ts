import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { PresetService } from '../../services/preset.service';
import { Sample } from '../../services/sample.service';
import { SamplePickerComponent } from './components/sample-picker.component';

interface PadConfig {
  padIndex: number;
  file?: File;         // For new uploads
  sample?: Sample;     // For linked library samples
  label: string;
  isExisting?: boolean; // True if it's from the loaded preset and unchanged
  originalPath?: string; // To keep track of existing samples
  originalUrl?: string;  // To keep track of external URLs
  originalFilename?: string;
}

@Component({
  selector: 'app-preset-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SamplePickerComponent],
  templateUrl: './preset-editor.html',
  styleUrls: ['./preset-editor.css']
})
export class PresetEditorComponent implements OnInit {
  form: FormGroup;
  pads: PadConfig[] = [];
  submitting = false;
  isEditMode = false;
  presetId: string | null = null;

  // Picker State
  showPicker = false;
  activePickerPadIndex: number | null = null;

  constructor(
    private fb: FormBuilder,
    private presetService: PresetService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      category: ['Drums', Validators.required],
      bpm: [120, [Validators.required, Validators.min(60), Validators.max(240)]]
    });

    // Initialize 16 pads
    for (let i = 0; i < 16; i++) {
      this.pads.push({ padIndex: i, label: `Pad ${i}` });
    }
  }

  ngOnInit() {
    this.presetId = this.route.snapshot.paramMap.get('id');
    if (this.presetId) {
      this.isEditMode = true;
      this.loadPreset(this.presetId);
    }
  }

  loadPreset(id: string) {
    this.presetService.getOne(id).subscribe({
      next: (res) => {
        const p = res.data;
        this.form.patchValue({
          name: p.name,
          category: p.category,
          bpm: p.bpm
        });

        // Map existing samples to pads
        if (p.samples) {
          p.samples.forEach((s: any) => {
            if (s.padIndex >= 0 && s.padIndex < 16) {
              this.pads[s.padIndex] = {
                padIndex: s.padIndex,
                label: s.label,
                isExisting: true,
                originalPath: s.path,
                originalFilename: s.filename,
                originalUrl: s.url
              };
            }
          });
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        alert('Failed to load preset');
        this.router.navigate(['/admin/presets']);
      }
    });
  }

  // --- Sample Picker Logic ---
  openPicker(padIndex: number) {
    this.activePickerPadIndex = padIndex;
    this.showPicker = true;
  }

  onSamplePicked(sample: Sample) {
    if (this.activePickerPadIndex !== null) {
      this.pads[this.activePickerPadIndex] = {
        padIndex: this.activePickerPadIndex,
        sample: sample,  // Link to library sample
        label: sample.name,
        file: undefined, // Clear any file upload
        isExisting: false
      };
    }
    this.showPicker = false;
    this.activePickerPadIndex = null;
  }

  // --- File Upload Logic ---
  onFileSelected(event: Event, padIndex: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.pads[padIndex] = {
        padIndex: padIndex,
        file: file,
        label: file.name.replace(/\.[^/.]+$/, ""),
        sample: undefined,
        isExisting: false
      };
    }
  }

  clearPad(padIndex: number) {
    this.pads[padIndex] = { padIndex: padIndex, label: `Pad ${padIndex}` };
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.submitting = true;

    const formData = new FormData();
    const metadata = {
      name: this.form.value.name,
      category: this.form.value.category,
      bpm: this.form.value.bpm,
      samples: [] as any[]
    };

    // Process pads
    this.pads.forEach(pad => {
      const sampleMeta: any = {
        padIndex: pad.padIndex,
        label: pad.label
      };

      // Case A: New File Upload
      if (pad.file) {
        formData.append('samples', pad.file, pad.file.name);
        sampleMeta.originalFilename = pad.file.name;
      }
      // Case B: Linked Library Sample
      else if (pad.sample && pad.sample._id) {
        sampleMeta.sampleId = pad.sample._id;
      }
      // Case C: Existing Sample (Edit Mode)
      else if (pad.isExisting) {
        sampleMeta.filename = pad.originalFilename;
        sampleMeta.path = pad.originalPath;
        sampleMeta.url = pad.originalUrl;
      }
      // Case D: Empty Pad (don't add to metadata or add as empty if needed?)
      // backend loop iterates over metadata.samples, so we only push if there's content
      if (pad.file || pad.sample || pad.isExisting) {
        metadata.samples.push(sampleMeta);
      }
    });

    formData.append('metadata', JSON.stringify(metadata));

    const request$ = this.isEditMode
      ? this.presetService.update(this.presetId!, formData as any) // Cast to any because service needs update for FormData support
      : this.presetService.create(formData);

    request$.subscribe({
      next: () => {
        this.router.navigate(['/admin/presets']);
      },
      error: (err) => {
        console.error(err);
        alert('Failed to save preset');
        this.submitting = false;
      }
    });
  }
}
