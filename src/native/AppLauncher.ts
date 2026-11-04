import { Capacitor, registerPlugin } from '@capacitor/core';

export interface InstalledApp {
  packageName: string;
  label: string;
  /** icône PNG base64 (sans préfixe data:) */
  icon?: string;
  category?: 'music' | 'navigation' | 'other';
}

/** Pont vers le plugin Kotlin AppLauncherPlugin.kt (fonctions Android standard uniquement). */
interface AppLauncherNative {
  listApps(): Promise<{ apps: InstalledApp[] }>;
  launch(opts: { packageName: string }): Promise<void>;
  openCategory(opts: { category: 'music' | 'maps' }): Promise<{ launched: boolean }>;
  openSettings(opts: { panel: 'bluetooth' | 'sound' }): Promise<void>;
  mediaKey(opts: { key: 'play_pause' | 'next' | 'previous' }): Promise<void>;
  getVolume(): Promise<{ value: number; max: number }>;
  setVolume(opts: { value: number }): Promise<void>;
}

const Native = registerPlugin<AppLauncherNative>('AppLauncher');
export const nativeAvailable = () => Capacitor.getPlatform() === 'android';
export const NATIVE_ONLY = 'Disponible dans l’application Android (APK). Sur PC, cette fonction ne peut pas accéder au système.';

export const AppLauncher = {
  listApps: async () => (nativeAvailable() ? (await Native.listApps()).apps : []),
  launch: (packageName: string) => Native.launch({ packageName }),
  openCategory: async (category: 'music' | 'maps') => (await Native.openCategory({ category })).launched,
  openSettings: (panel: 'bluetooth' | 'sound') => Native.openSettings({ panel }),
  mediaKey: (key: 'play_pause' | 'next' | 'previous') => Native.mediaKey({ key }),
  getVolume: () => Native.getVolume(),
  setVolume: (value: number) => Native.setVolume({ value }),
};
