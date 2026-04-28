/// <reference types="vite/client" />

import type {
  AppStatus,
  BootstrapState,
  DictationRequest,
  FocusInfo,
  HotkeyEvent,
  ImageGenerationResult,
  OpenRouterModelInfo,
  UpdateSettingsInput,
} from '../shared/types';

declare global {
  interface Window {
    openWhisp: {
      bootstrap: () => Promise<BootstrapState>;
      updateSettings: (updates: UpdateSettingsInput) => Promise<BootstrapState>;
      chooseStorage: () => Promise<BootstrapState>;
      requestMicrophoneAccess: () => Promise<BootstrapState>;
      requestSystemAccess: () => Promise<BootstrapState>;
      prepareSpeechModel: () => Promise<BootstrapState>;
      refreshOllama: () => Promise<BootstrapState>;
      pullRecommendedModel: () => Promise<BootstrapState>;
      captureFocusTarget: () => Promise<FocusInfo>;
      processAudio: (request: DictationRequest) => Promise<{
        rawText: string;
        finalText: string;
        pasted: boolean;
        image?: ImageGenerationResult;
      }>;
      listImageModels: (apiKey: string) => Promise<OpenRouterModelInfo[]>;
      verifyImageApiKey: (apiKey: string) => Promise<boolean>;
      listOpenRouterTextModels: () => Promise<OpenRouterModelInfo[]>;
      pushStatus: (status: AppStatus) => void;
      showMainWindow: () => Promise<void>;
      hideMainWindow: () => Promise<void>;
      openExternal: (targetUrl: string) => Promise<void>;
      revealStorage: () => Promise<void>;
      onStatus: (listener: (status: AppStatus) => void) => () => void;
      onHotkey: (listener: (event: HotkeyEvent) => void) => () => void;
    };
  }
}

export {};
