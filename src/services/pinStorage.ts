import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';

const PIN_SERVICE = 'com.phoneguard.security.pin';

type PhoneGuardPinModule = {
  savePin: (pin: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  hasPin: () => Promise<boolean>;
  removePin: () => Promise<boolean>;
};

const nativePinModule = NativeModules.PhoneGuardPin as
  | PhoneGuardPinModule
  | undefined;

function getNativePinModule(): PhoneGuardPinModule {
  if (!nativePinModule) {
    throw new Error(
      'Native PIN security module is unavailable. Rebuild the Android app.',
    );
  }

  return nativePinModule;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}(\d{2})?$/.test(pin);
}

async function migrateLegacyPin(): Promise<boolean> {
  const nativePin = getNativePinModule();

  if (await nativePin.hasPin()) {
    return true;
  }

  const credentials = await Keychain.getGenericPassword({
    service: PIN_SERVICE,
  });

  if (credentials === false || !isValidPin(credentials.password)) {
    return false;
  }

  await nativePin.savePin(credentials.password);

  await Keychain.resetGenericPassword({
    service: PIN_SERVICE,
  });

  return true;
}

export async function savePin(pin: string): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error('PIN must contain exactly 4 or 6 digits.');
  }

  await getNativePinModule().savePin(pin);

  await Keychain.resetGenericPassword({
    service: PIN_SERVICE,
  });
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (!isValidPin(pin)) {
    return false;
  }

  const nativePin = getNativePinModule();

  if (await nativePin.hasPin()) {
    return nativePin.verifyPin(pin);
  }

  const credentials = await Keychain.getGenericPassword({
    service: PIN_SERVICE,
  });

  if (credentials === false || credentials.password !== pin) {
    return false;
  }

  await nativePin.savePin(pin);

  await Keychain.resetGenericPassword({
    service: PIN_SERVICE,
  });

  return true;
}

export async function hasPin(): Promise<boolean> {
  return migrateLegacyPin();
}

export async function removePin(): Promise<void> {
  await getNativePinModule().removePin();

  await Keychain.resetGenericPassword({
    service: PIN_SERVICE,
  });
}
