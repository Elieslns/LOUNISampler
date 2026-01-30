import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PresetService } from '../../services/preset.service';
import { Preset } from '../../models/preset';

@Component({
  selector: 'app-preset-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './preset-list.html',
  styleUrls: ['./preset-list.css']
})
export class PresetListComponent implements OnInit {
  presets: Preset[] = [];
  loading = false;
  error = '';

  constructor(
    private presetService: PresetService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadPresets();
  }

  loadPresets(): void {
    this.loading = true;
    this.error = '';
    this.presetService.getAll().subscribe({
      next: (response) => {
        this.presets = response.data;
        this.loading = false;
        this.cdr.detectChanges(); // Force update
      },
      error: (err) => {
        this.error = 'Failed to load presets';
        this.loading = false;
        console.error(err);
        this.cdr.detectChanges(); // Force update
      }
    });
  }

  deletePreset(id: string): void {
    if (!confirm('Are you sure you want to delete this preset?')) return;

    this.presetService.delete(id).subscribe({
      next: () => {
        this.presets = this.presets.filter(p => p._id !== id);
        this.cdr.detectChanges(); // Force update
      },
      error: (err) => {
        alert('Failed to delete preset');
        console.error(err);
      }
    });
  }
}
