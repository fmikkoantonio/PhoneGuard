import type { MotionSensitivity } from '../types/AppSettings';

import type { SensorData } from './sensorService';

export type MotionDetectionResult = {
  detected: boolean;
  accelerationChange: number;
  rotationSpeed: number;
  reason: string | null;
};

type CalibrationSample = {
  x: number;
  y: number;
  z: number;
};

const CALIBRATION_DURATION_MS = 2000;

const SENSITIVITY_THRESHOLDS: Record<
  MotionSensitivity,
  { acceleration: number; rotation: number }
> = {
  Low: {
    acceleration: 3.0,
    rotation: 1.5,
  },
  Medium: {
    acceleration: 2.0,
    rotation: 0.9,
  },
  High: {
    acceleration: 1.2,
    rotation: 0.5,
  },
};

export class MotionDetector {
  private calibrationSamples: CalibrationSample[] = [];
  private baseline: CalibrationSample | null = null;
  private calibrationStartedAt: number | null = null;

  constructor(private sensitivity: MotionSensitivity = 'Medium') {}

  setSensitivity(sensitivity: MotionSensitivity): void {
    this.sensitivity = sensitivity;
  }

  reset(): void {
    this.calibrationSamples = [];
    this.baseline = null;
    this.calibrationStartedAt = null;
  }

  isCalibrated(): boolean {
    return this.baseline !== null;
  }

  getCalibrationProgress(): number {
    if (this.baseline) {
      return 100;
    }

    if (this.calibrationStartedAt === null) {
      return 0;
    }

    return Math.min(100, (this.calibrationSamples.length / 20) * 100);
  }

  process(data: SensorData): MotionDetectionResult {
    if (!this.baseline) {
      this.collectCalibrationSample(data);

      return {
        detected: false,
        accelerationChange: 0,
        rotationSpeed: 0,
        reason: null,
      };
    }

    if (data.sensorType === 'accelerometer') {
      const accelerationChange = Math.sqrt(
        Math.pow(data.x - this.baseline.x, 2) +
          Math.pow(data.y - this.baseline.y, 2) +
          Math.pow(data.z - this.baseline.z, 2),
      );

      return this.evaluateMotion(accelerationChange, 0);
    }

    if (data.sensorType === 'gyroscope') {
      const rotationSpeed = Math.sqrt(
        data.x * data.x + data.y * data.y + data.z * data.z,
      );

      return this.evaluateMotion(0, rotationSpeed);
    }

    return {
      detected: false,
      accelerationChange: 0,
      rotationSpeed: 0,
      reason: null,
    };
  }

  private collectCalibrationSample(data: SensorData): void {
    if (data.sensorType !== 'accelerometer') {
      return;
    }

    const now = Date.now();

    if (this.calibrationStartedAt === null) {
      this.calibrationStartedAt = now;
    }

    if (now - this.calibrationStartedAt > CALIBRATION_DURATION_MS) {
      if (this.calibrationSamples.length < 10) {
        this.reset();
        return;
      }

      this.calculateBaseline();
      return;
    }

    this.calibrationSamples.push({
      x: data.x,
      y: data.y,
      z: data.z,
    });
  }

  private calculateBaseline(): void {
    const count = this.calibrationSamples.length;

    if (count === 0) {
      return;
    }

    const total = this.calibrationSamples.reduce(
      (result, sample) => ({
        x: result.x + sample.x,
        y: result.y + sample.y,
        z: result.z + sample.z,
      }),
      { x: 0, y: 0, z: 0 },
    );

    this.baseline = {
      x: total.x / count,
      y: total.y / count,
      z: total.z / count,
    };
  }

  private evaluateMotion(
    accelerationChange: number,
    rotationSpeed: number,
  ): MotionDetectionResult {
    const thresholds = SENSITIVITY_THRESHOLDS[this.sensitivity];

    const accelerationDetected = accelerationChange >= thresholds.acceleration;

    const rotationDetected = rotationSpeed >= thresholds.rotation;

    let reason: string | null = null;

    if (accelerationDetected && rotationDetected) {
      reason = 'Acceleration and rotation detected';
    } else if (accelerationDetected) {
      reason = 'Significant acceleration detected';
    } else if (rotationDetected) {
      reason = 'Significant rotation detected';
    }

    return {
      detected: accelerationDetected || rotationDetected,
      accelerationChange,
      rotationSpeed,
      reason,
    };
  }
}
