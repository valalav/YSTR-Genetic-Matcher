import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { STRProfile } from '@/utils/constants';

interface ImportedProfilesState {
  profiles: STRProfile[];
  stats: {
    totalImported: number;
    newProfiles: number;
    overriddenProfiles: number;
    skippedProfiles: number;
  } | null;
}

const initialState: ImportedProfilesState = {
  profiles: [],
  stats: null,
};

const importedProfilesSlice = createSlice({
  name: 'importedProfiles',
  initialState,
  reducers: {
    importProfiles: (
      state,
      action: PayloadAction<{
        profiles: STRProfile[];
        stats: ImportedProfilesState['stats'];
      }>
    ) => {
      state.profiles = action.payload.profiles;
      state.stats = action.payload.stats;
    },
    clearImportedProfiles: (state) => {
      state.profiles = [];
      state.stats = null;
    },
    removeImportedProfile: (state, action: PayloadAction<string>) => {
      state.profiles = state.profiles.filter(
        (p) => p.kitNumber !== action.payload
      );
    },
  },
});

export const { importProfiles, clearImportedProfiles, removeImportedProfile } =
  importedProfilesSlice.actions;

export default importedProfilesSlice.reducer;
