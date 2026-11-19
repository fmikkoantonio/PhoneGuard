import {
  NativeEventEmitter,
  NativeModules,
  EmitterSubscription,
} from 'react-native';

export type SensorType = 'accelerometer' | 'gyroscope';

export type SensorData = {
  sensorType: SensorType;
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

export type SensorAvailability = {
  accelerometerAvailable: boolean;
  gyroscopeAvailable: boolean;
};

type PhoneGuardSensorModule = {
  startSensors: () => Promise<SensorAvailability>;
  stopSensors: () => Promise<boolean>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

const SENSOR_EVENT = 'PhoneGuardSensorData';

const nativeSensorModule = NativeModules.PhoneGuardSensor as
  | PhoneGuardSensorModule
  | undefined;

if (!nativeSensorModule) {
  console.warn(
    'PhoneGuardSensor native module is unavailable. ' +
      'Make sure the Android app has been rebuilt.',
  );
}

const sensorEmitter = nativeSensorModule
  ? new NativeEventEmitter(nativeSensorModule)
  : null;

export async function startSensorMonitoring(): Promise<SensorAvailability> {
  if (!nativeSensorModule) {
    throw new Error('Phone Guard sensor module is unavailable.');
  }

  return nativeSensorModule.startSensors();
}

export async function stopSensorMonitoring(): Promise<boolean> {
  if (!nativeSensorModule) {
    throw new Error('Phone Guard sensor module is unavailable.');
  }

  return nativeSensorModule.stopSensors();
}

export function subscribeToSensorData(
  callback: (data: SensorData) => void,
): EmitterSubscription {
  if (!sensorEmitter) {
    throw new Error('Phone Guard sensor event emitter is unavailable.');
  }

  return sensorEmitter.addListener(
    SENSOR_EVENT,
    (...args: readonly Object[]) => {
      const payload = args[0];

      if (payload && typeof payload === 'object') {
        callback(payload as SensorData);
      }
    },
  );
}
