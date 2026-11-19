import { NativeModules } from 'react-native';

type PhoneGuardAlarmModule = {
  startAlarm: (
    soundEnabled: boolean,
    vibrationEnabled: boolean,
  ) => Promise<boolean>;
  stopAlarm: (pin: string) => Promise<boolean>;
  isAlarmRunning: () => Promise<boolean>;
};

const nativeAlarmModule = NativeModules.PhoneGuardAlarm as
  | PhoneGuardAlarmModule
  | undefined;

function getAlarmModule(): PhoneGuardAlarmModule {
  if (!nativeAlarmModule) {
    throw new Error(
      'Phone Guard alarm module is unavailable. Rebuild the Android app.',
    );
  }

  return nativeAlarmModule;
}

export async function startAlarm(
  soundEnabled: boolean,
  vibrationEnabled: boolean,
): Promise<boolean> {
  if (!soundEnabled && !vibrationEnabled) {
    throw new Error(
      'Enable sound or vibration in Settings before starting the alarm.',
    );
  }

  return getAlarmModule().startAlarm(soundEnabled, vibrationEnabled);
}

export async function stopAlarm(pin: string): Promise<boolean> {
  return getAlarmModule().stopAlarm(pin);
}

export async function isAlarmRunning(): Promise<boolean> {
  return getAlarmModule().isAlarmRunning();
}
