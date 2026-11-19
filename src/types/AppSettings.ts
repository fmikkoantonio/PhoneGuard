export type MotionSensitivity = 'Low' | 'Medium' | 'High';

export type AppSettings = {
  countdown: number;
  sensitivity: MotionSensitivity;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  countdown: 3,
  sensitivity: 'Medium',
  soundEnabled: true,
  vibrationEnabled: true,
};
