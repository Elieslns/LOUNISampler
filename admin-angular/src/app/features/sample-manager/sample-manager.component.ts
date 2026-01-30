import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SampleService, Sample } from '../../services/sample.service';

@Component({
  selector: 'app-sample-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sample-manager.html',
  styleUrls: ['./sample-manager.css']
})
export class SampleManagerComponent implements OnInit {
  samples: Sample[] = [];
  categories = ['Kick', 'Snare', 'HiHat', 'Percussion', 'Bass', 'Melodic', 'FX', 'Voice', 'Other'];
  selectedCategory: string = '';

  // Upload State
  uploadFile: File | null = null;
  uploadName: string = '';
  uploadCategory: string = 'Other';

  // URL Add State
  urlValue: string = '';
  urlName: string = '';
  urlCategory: string = 'Other';

  activeTab: 'upload' | 'url' = 'upload';
  loading = false;
  error = '';

  constructor(
    private sampleService: SampleService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.loadSamples();
  }

  loadSamples() {
    this.loading = true;
    this.error = '';
    this.sampleService.getAll(this.selectedCategory || undefined).subscribe({
      next: (res) => {
        this.samples = res.data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'Failed to load samples';
        this.loading = false;
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.uploadFile = file;
      // Auto-fill name if empty
      if (!this.uploadName) {
        this.uploadName = file.name.replace(/\.[^/.]+$/, "");
      }
    }
  }

  handleUpload() {
    if (!this.uploadFile) return;

    this.sampleService.upload(this.uploadFile, this.uploadCategory, this.uploadName).subscribe({
      next: (res) => {
        this.loadSamples(); // Refresh list
        this.uploadFile = null;
        this.uploadName = '';
        alert('File uploaded successfully!');
        this.cdr.detectChanges();
      },
      error: (err) => alert('Upload failed')
    });
  }

  handleAddUrl() {
    if (!this.urlValue) return;

    this.sampleService.addUrl(this.urlValue, this.urlCategory, this.urlName).subscribe({
      next: (res) => {
        this.loadSamples();
        this.urlValue = '';
        this.urlName = '';
        alert('Sample added from URL!');
        this.cdr.detectChanges();
      },
      error: (err) => alert('Failed to add URL')
    });
  }

  deleteSample(id: string) {
    if (!confirm('Delete this sample?')) return;
    this.sampleService.delete(id).subscribe({
      next: () => {
        this.samples = this.samples.filter(s => s._id !== id);
        this.cdr.detectChanges();
      },
      error: () => alert('Delete failed')
    });
  }
}
