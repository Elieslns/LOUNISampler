import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SequencerPresetService, SequencerPreset } from '../../services/sequencer-preset.service';

@Component({
    selector: 'app-sequencer-preset-list',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './sequencer-preset-list.component.html',
    styleUrls: []
})
export class SequencerPresetListComponent implements OnInit {
    presets: SequencerPreset[] = [];
    loading = false;
    error = '';

    constructor(
        private presetService: SequencerPresetService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadPresets();
    }

    loadPresets(): void {
        this.loading = true;
        this.error = '';
        this.presetService.getPresets().subscribe({
            next: (res) => {
                this.presets = res.data;
                this.loading = false;
                this.cdr.detectChanges(); // Force update
            },
            error: (err) => {
                this.error = 'Failed to load presets (Check API)';
                this.loading = false;
                console.error(err);
                this.cdr.detectChanges(); // Force update
            }
        });
    }

    deletePreset(id: string): void {
        if (!confirm('Are you sure you want to delete this preset?')) return;

        this.presetService.deletePreset(id).subscribe({
            next: () => {
                this.presets = this.presets.filter(p => p._id !== id);
                this.cdr.detectChanges(); // Update UI immediately
            },
            error: (err) => {
                console.error(err);
                alert('Failed to delete preset');
            }
        });
    }
}
