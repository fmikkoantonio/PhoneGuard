import { NativeModules } from 'react-native';
import type { MotionSensitivity } from '../types/AppSettings';

export type NativeCountdownState = {
  isActive: boolean;
  secondsRemaining: number;
};

type PhoneGuardProtectionModule = {
  startProtection: () => Promise<boolean>;
  stopProtection: () => Promise<boolean>;
  updateSensitivity: (sensitivity: string) => Promise<boolean>;
  updateCountdownDuration: (seconds: number) => Promise<boolean>;
  updateAlarmSettings: (
    soundEnabled: boolean,
    vibrationEnabled: boolean,
  ) => Promise<boolean>;
  getCountdownState: () => Promise<NativeCountdownState>;
  isProtectionRunning: () => Promise<boolean>;
};

const nativeProtectionModule = NativeModules.PhoneGuardProtection as
  | PhoneGuardProtectionModule
  | undefined;

function getProtectionModule(): PhoneGuardProtectionModule {
  if (!nativeProtectionModule) {
    throw new Error(
      'Phone Guard protection service is unavailable. Rebuild the Android app.',
    );
  }
  return nativeProtectionModule;
}

export async function startProtectionService(): Promise<boolean> {
  return getProtectionModule().startProtection();
}

export async function stopProtectionService(): Promise<boolean> {
  return getProtectionModule().stopProtection();
}

export async function updateProtectionSensitivity(
  sensitivity: MotionSensitivity,
): Promise<boolean> {
  return getProtectionModule().updateSensitivity(sensitivity);
}

export async function updateProtectionCountdown(
  seconds: number,
): Promise<boolean> {
  return getProtectionModule().updateCountdownDuration(seconds);
}

export async function updateProtectionAlarmSettings(
  soundEnabled: boolean,
  vibrationEnabled: boolean,
): Promise<boolean> {
  return getProtectionModule().updateAlarmSettings(
    soundEnabled,
    vibrationEnabled,
  );
}

export async function getProtectionCountdownState(): Promise<NativeCountdownState> {
  return getProtectionModule().getCountdownState();
}

export async function isProtectionServiceRunning(): Promise<boolean> {
  return getProtectionModule().isProtectionRunning();
}
