import { Routes } from '@angular/router';
import { PresetListComponent } from './features/preset-list/preset-list.component';
import { PresetEditorComponent } from './features/preset-editor/preset-editor.component';
import { SampleManagerComponent } from './features/sample-manager/sample-manager.component';

import { SequencerPresetListComponent } from './features/sequencer-presets/sequencer-preset-list.component';

export const routes: Routes = [
    { path: '', redirectTo: 'admin/presets', pathMatch: 'full' },
    { path: 'admin/presets', component: PresetListComponent },
    { path: 'admin/presets/new', component: PresetEditorComponent },
    { path: 'admin/presets/edit/:id', component: PresetEditorComponent },
    { path: 'admin/sequencer-presets', component: SequencerPresetListComponent },
    { path: 'admin/samples', component: SampleManagerComponent },
    { path: '**', redirectTo: 'admin/presets' }
];
