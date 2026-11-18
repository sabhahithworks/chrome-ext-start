import { create } from 'zustand';

export type ScreenId = 'home' | 'page' | 'ai' | 'settings';

interface UiState {
  activeScreen: ScreenId;
  setActiveScreen: (id: ScreenId) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeScreen: 'home',
  setActiveScreen: (id) => {
    set({ activeScreen: id });
  },
}));
