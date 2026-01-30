import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SampleService, Sample } from '../../../services/sample.service';

@Component({
    selector: 'app-sample-picker',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
        <div class="glass-panel w-full max-w-4xl max-h-[85vh] flex flex-col m-4 shadow-2xl border border-brand-primary/20">
            <!-- Header -->
            <div class="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                <h2 class="text-xl font-bold text-white flex items-center gap-2">
                    <span>📚</span> Sample Library
                </h2>
                <button (click)="cancel.emit()" class="text-gray-400 hover:text-white transition-colors">
                    ✕
                </button>
            </div>

            <!-- Toolbar -->
            <div class="p-4 flex gap-4 bg-white/5 border-b border-white/5">
                <div class="relative flex-1">
                    <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
                    <input type="text" [(ngModel)]="searchTerm" placeholder="Search samples..." 
                           class="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-600 focus:border-brand-primary focus:outline-none">
                </div>
                <select [(ngModel)]="category" (change)="loadSamples()"
                        class="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-brand-primary focus:outline-none">
                    <option value="">All Categories</option>
                    <option *ngFor="let cat of categories" [value]="cat">{{ cat }}</option>
                </select>
            </div>

            <!-- List -->
            <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div *ngIf="loading" class="flex justify-center py-10">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                </div>

                <div *ngIf="!loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div *ngFor="let sample of filteredSamples()" 
                         (click)="select(sample)"
                         class="group p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-brand-primary/10 hover:border-brand-primary/40 cursor-pointer transition-all flex items-center justify-between">
                        
                        <div class="flex items-center gap-3 overflow-hidden">
                            <div class="w-8 h-8 rounded bg-black/40 flex items-center justify-center text-xs border border-white/5 group-hover:border-brand-primary/30 text-gray-400 group-hover:text-brand-primary">
                                🎵
                            </div>
                            <div class="min-w-0">
                                <div class="text-sm font-bold text-gray-200 group-hover:text-white truncate">{{ sample.name }}</div>
                                <div class="text-xs text-gray-500 group-hover:text-brand-cyan">{{ sample.category }}</div>
                            </div>
                        </div>

                        <!-- Mini Play Preview -->
                        <button (click)="$event.stopPropagation(); playPreview(sample)" class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/20 flex items-center justify-center text-xs transition-colors">
                             ▶
                        </button>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="p-4 border-t border-white/10 bg-black/20 text-right">
                <button (click)="cancel.emit()" class="px-4 py-2 text-gray-400 hover:text-white mr-2">Cancel</button>
            </div>
        </div>
    </div>
  `,
    styles: [`
    .glass-panel {
        background: rgba(17, 24, 39, 0.7);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
    }
  `]
})
export class SamplePickerComponent implements OnInit {
    @Output() selectSample = new EventEmitter<Sample>();
    @Output() cancel = new EventEmitter<void>();

    samples: Sample[] = [];
    categories = ['Kick', 'Snare', 'HiHat', 'Percussion', 'Bass', 'Melodic', 'FX', 'Voice', 'Other'];
    category = '';
    searchTerm = '';
    loading = false;

    audioPlayer = new Audio();

    constructor(
        private sampleService: SampleService
    ) { }

    ngOnInit() {
        this.loadSamples();
    }

    loadSamples() {
        this.loading = true;
        console.log('📚 SamplePicker: Loading samples...');

        this.sampleService.getAll(this.category || undefined).subscribe({
            next: (res) => {
                console.log(`📚 SamplePicker: Loaded ${res.count} samples`);
                this.samples = res.data;
                this.loading = false;
            },
            error: (err) => {
                console.error('📚 SamplePicker: Error loading samples', err);
                this.loading = false;
            }
        });
    }

    filteredSamples() {
        if (!this.searchTerm) return this.samples;
        return this.samples.filter(s => s.name.toLowerCase().includes(this.searchTerm.toLowerCase()));
    }

    select(sample: Sample) {
        this.selectSample.emit(sample);
    }

    playPreview(sample: Sample) {
        this.audioPlayer.src = sample.url || `/api${sample.path}`;
        this.audioPlayer.play().catch(e => console.error(e));
    }
}
