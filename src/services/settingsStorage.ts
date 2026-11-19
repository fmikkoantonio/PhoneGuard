import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AppSettings,
  DEFAULT_SETTINGS,
  MotionSensitivity,
} from '../types/AppSettings';

const SETTINGS_STORAGE_KEY = '@phone_guard/settings';

const isMotionSensitivity = (value: unknown): value is MotionSensitivity => {
  return value === 'Low' || value === 'Medium' || value === 'High';
};

export async function loadSettings(): Promise<AppSettings> {
  try {
    const storedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!storedSettings) {
      return DEFAULT_SETTINGS;
    }

    const parsed: unknown = JSON.parse(storedSettings);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return DEFAULT_SETTINGS;
    }

    const saved = parsed as Record<string, unknown>;

    return {
      countdown:
        typeof saved.countdown === 'number' &&
        [3, 5, 10].includes(saved.countdown)
          ? saved.countdown
          : DEFAULT_SETTINGS.countdown,

      sensitivity: isMotionSensitivity(saved.sensitivity)
        ? saved.sensitivity
        : DEFAULT_SETTINGS.sensitivity,

      soundEnabled:
        typeof saved.soundEnabled === 'boolean'
          ? saved.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled,

      vibrationEnabled:
        typeof saved.vibrationEnabled === 'boolean'
          ? saved.vibrationEnabled
          : DEFAULT_SETTINGS.vibrationEnabled,
    };
  } catch (error) {
    console.error('Failed to load Phone Guard settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save Phone Guard settings:', error);
  }
}
