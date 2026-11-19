import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { EmitterSubscription } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  isAlarmRunning,
  startAlarm,
  stopAlarm,
} from '../services/alarmService';
import { hasPin } from '../services/pinStorage';
import {
  getProtectionCountdownState,
  isProtectionServiceRunning,
  startProtectionService,
  stopProtectionService,
} from '../services/protectionService';

import colors from '../theme/colors';
import AppHeader from '../components/AppHeader';
import SectionHeader from '../components/SectionHeader';
import InfoCard from '../components/InfoCard';
import { AppSettings } from '../types/AppSettings';
import {
  MotionDetector,
  MotionDetectionResult,
} from '../services/motionDetection';
import {
  SensorAvailability,
  SensorData,
  startSensorMonitoring,
  stopSensorMonitoring,
  subscribeToSensorData,
} from '../services/sensorService';

type HomeScreenProps = {
  settings: AppSettings;
};

const EMPTY_SENSOR_DATA = {
  x: null as number | null,
  y: null as number | null,
  z: null as number | null,
};

function formatSensorValue(value: number | null): string {
  return value === null ? '--' : value.toFixed(3);
}

function HomeScreen({ settings }: HomeScreenProps) {
  const [protectionEnabled, setProtectionEnabled] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<
    'stopped' | 'start-requested' | 'stop-requested'
  >('stopped');
  const [isServiceBusy, setIsServiceBusy] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [sensorAvailability, setSensorAvailability] =
    useState<SensorAvailability | null>(null);

  const [accelerometerData, setAccelerometerData] = useState(EMPTY_SENSOR_DATA);
  const [gyroscopeData, setGyroscopeData] = useState(EMPTY_SENSOR_DATA);
  const [sensorError, setSensorError] = useState<string | null>(null);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [isAlarmBusy, setIsAlarmBusy] = useState(false);
  const [alarmError, setAlarmError] = useState<string | null>(null);
  const [isPinModalVisible, setIsPinModalVisible] = useState(false);
  const [alarmPin, setAlarmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [countdownStatus, setCountdownStatus] = useState<
    'idle' | 'counting' | 'cancelled' | 'completed'
  >('idle');
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [nativeCountdownActive, setNativeCountdownActive] = useState(false);
  const [nativeCountdownRemaining, setNativeCountdownRemaining] = useState(0);
  const [motionResult, setMotionResult] = useState<MotionDetectionResult>({
    detected: false,
    accelerationChange: 0,
    rotationSpeed: 0,
    reason: null,
  });

  const detectorRef = useRef<MotionDetector | null>(null);
  const countdownTriggeredRef = useRef(false);
  const isMonitoringRef = useRef(false);
  const sensorSubscription = useRef<EmitterSubscription | null>(null);
  const isMounted = useRef(true);
  const alarmWasActiveRef = useRef(false);

  const handleStartForegroundService = async () => {
    if (isServiceBusy || serviceStatus !== 'stopped') {
      return;
    }

    setIsServiceBusy(true);
    setServiceError(null);

    try {
      const pinIsConfigured = await hasPin();

      if (!pinIsConfigured) {
        setServiceError(
          'Set up a security PIN before enabling device protection.',
        );
        return;
      }

      if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );

        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          setServiceError(
            'Notification permission was not granted. Allow notifications for Phone Guard in Android settings, then try again.',
          );
          return;
        }
      }

      await startProtectionService();

      // The native bridge confirms the start request was accepted.
      // The persistent Android notification must still be verified on-device.
      setServiceStatus('start-requested');
      setProtectionEnabled(true);
    } catch (error) {
      setServiceError(
        error instanceof Error
          ? error.message
          : 'Unable to request the foreground service start.',
      );
    } finally {
      setIsServiceBusy(false);
    }
  };

  const handleStopForegroundService = async () => {
    if (isServiceBusy || !protectionEnabled) {
      return;
    }

    setIsServiceBusy(true);
    setServiceError(null);

    try {
      await stopProtectionService();
      setServiceStatus('stop-requested');
      setProtectionEnabled(false);
    } catch (error) {
      setServiceError(
        error instanceof Error
          ? error.message
          : 'Unable to request the foreground service stop.',
      );
    } finally {
      setIsServiceBusy(false);
    }
  };

  const handleProtectionToggle = () => {
    if (isServiceBusy) {
      return;
    }

    if (protectionEnabled) {
      void handleStopForegroundService();
    } else {
      void handleStartForegroundService();
    }
  };

  useEffect(() => {
    detectorRef.current?.setSensitivity(settings.sensitivity);
  }, [settings.sensitivity]);

  useEffect(() => {
    if (countdownStatus !== 'counting') {
      return;
    }

    const interval = setInterval(() => {
      setCountdownRemaining(previous => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownStatus]);

  useEffect(() => {
    let isMountedForServiceStatus = true;
    let isReadingServiceStatus = false;

    const readNativeServiceStatus = async () => {
      if (isReadingServiceStatus) {
        return;
      }

      isReadingServiceStatus = true;

      try {
        const isRunning = await isProtectionServiceRunning();

        if (isMountedForServiceStatus) {
          setProtectionEnabled(isRunning);
          setServiceStatus(isRunning ? 'start-requested' : 'stopped');
        }
      } catch (error) {
        if (isMountedForServiceStatus) {
          console.warn(
            'Unable to read native protection service status:',
            error,
          );
        }
      } finally {
        isReadingServiceStatus = false;
      }
    };

    readNativeServiceStatus();

    const interval = setInterval(readNativeServiceStatus, 1000);

    return () => {
      isMountedForServiceStatus = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMountedForCountdown = true;
    let isReadingCountdown = false;

    const readNativeCountdown = async () => {
      if (isReadingCountdown) {
        return;
      }

      isReadingCountdown = true;

      try {
        const state = await getProtectionCountdownState();

        if (isMountedForCountdown) {
          setNativeCountdownActive(state.isActive);
          setNativeCountdownRemaining(
            state.isActive ? Math.max(0, state.secondsRemaining) : 0,
          );
        }
      } catch (error) {
        if (isMountedForCountdown) {
          console.warn('Unable to read native countdown state:', error);
        }
      } finally {
        isReadingCountdown = false;
      }
    };

    readNativeCountdown();

    const interval = setInterval(readNativeCountdown, 500);

    return () => {
      isMountedForCountdown = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (countdownStatus === 'counting' && countdownRemaining === 0) {
      setCountdownStatus('completed');
    }
  }, [countdownStatus, countdownRemaining]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      isMonitoringRef.current = false;
      sensorSubscription.current?.remove();
      sensorSubscription.current = null;

      stopSensorMonitoring().catch(error => {
        console.warn('Unable to stop sensors during cleanup:', error);
      });
    };
  }, []);

  useEffect(() => {
    let isCheckingAlarm = false;

    const checkNativeAlarm = async () => {
      if (isCheckingAlarm) {
        return;
      }

      isCheckingAlarm = true;

      try {
        const alarmRunning = await isAlarmRunning();

        if (!isMounted.current) {
          return;
        }

        setIsAlarmActive(alarmRunning);

        if (alarmRunning && !alarmWasActiveRef.current) {
          alarmWasActiveRef.current = true;
          setAlarmPin('');
          setPinError(null);
          setIsPinModalVisible(true);
        } else if (!alarmRunning && alarmWasActiveRef.current) {
          alarmWasActiveRef.current = false;
          setAlarmPin('');
          setPinError(null);
          setIsPinModalVisible(false);
        }
      } catch (error) {
        console.warn('Unable to check native alarm status:', error);
      } finally {
        isCheckingAlarm = false;
      }
    };

    checkNativeAlarm();
    const alarmStatusInterval = setInterval(checkNativeAlarm, 1000);

    return () => {
      clearInterval(alarmStatusInterval);
    };
  }, []);

  const handleSensorData = (data: SensorData) => {
    const detector = detectorRef.current;

    if (detector) {
      const result = detector.process(data);

      if (detector.isCalibrated()) {
        setIsCalibrated(true);

        if (
          result.detected &&
          isMonitoringRef.current &&
          !countdownTriggeredRef.current
        ) {
          countdownTriggeredRef.current = true;
          setCountdownRemaining(settings.countdown);
          setCountdownStatus('counting');
        }
      }

      setMotionResult(previous => ({
        detected: result.detected,
        accelerationChange:
          data.sensorType === 'accelerometer'
            ? result.accelerationChange
            : previous.accelerationChange,
        rotationSpeed:
          data.sensorType === 'gyroscope'
            ? result.rotationSpeed
            : previous.rotationSpeed,
        reason: result.detected ? result.reason : null,
      }));
    }

    if (data.sensorType === 'accelerometer') {
      setAccelerometerData({
        x: data.x,
        y: data.y,
        z: data.z,
      });
    } else if (data.sensorType === 'gyroscope') {
      setGyroscopeData({
        x: data.x,
        y: data.y,
        z: data.z,
      });
    }
  };

  const handleStartMonitoring = async () => {
    if (isMonitoring || isStarting) {
      return;
    }

    setIsStarting(true);
    setSensorError(null);
    setIsCalibrated(false);
    countdownTriggeredRef.current = false;
    setCountdownRemaining(0);
    setCountdownStatus('idle');
    setMotionResult({
      detected: false,
      accelerationChange: 0,
      rotationSpeed: 0,
      reason: null,
    });
    detectorRef.current = new MotionDetector(settings.sensitivity);
    isMonitoringRef.current = true;

    try {
      sensorSubscription.current?.remove();

      sensorSubscription.current = subscribeToSensorData(handleSensorData);

      const availability = await startSensorMonitoring();

      if (!isMounted.current) {
        sensorSubscription.current?.remove();
        sensorSubscription.current = null;
        await stopSensorMonitoring().catch(() => undefined);
        return;
      }

      setSensorAvailability(availability);
      setIsMonitoring(true);
    } catch (error) {
      isMonitoringRef.current = false;
      sensorSubscription.current?.remove();
      sensorSubscription.current = null;

      if (isMounted.current) {
        setSensorError(
          error instanceof Error
            ? error.message
            : 'Unable to start sensor monitoring.',
        );
        setIsMonitoring(false);
      }
    } finally {
      if (isMounted.current) {
        setIsStarting(false);
      }
    }
  };

  const handleStopMonitoring = async () => {
    isMonitoringRef.current = false;
    sensorSubscription.current?.remove();
    sensorSubscription.current = null;

    try {
      await stopSensorMonitoring();

      if (isMounted.current) {
        setIsMonitoring(false);
        setAccelerometerData(EMPTY_SENSOR_DATA);
        setGyroscopeData(EMPTY_SENSOR_DATA);
        setIsCalibrated(false);
        countdownTriggeredRef.current = false;
        setCountdownRemaining(0);
        setCountdownStatus('idle');
        setMotionResult({
          detected: false,
          accelerationChange: 0,
          rotationSpeed: 0,
          reason: null,
        });
        detectorRef.current?.reset();
        detectorRef.current = null;
        setSensorError(null);
      }
    } catch (error) {
      if (isMounted.current) {
        setSensorError(
          error instanceof Error
            ? error.message
            : 'Unable to stop sensor monitoring.',
        );
      }
    }
  };

  const handleCancelCountdown = () => {
    setCountdownRemaining(0);
    setCountdownStatus('cancelled');
  };

  const handleStartAlarmTest = async () => {
    if (isAlarmActive || isAlarmBusy) {
      return;
    }

    setAlarmError(null);

    if (!settings.soundEnabled && !settings.vibrationEnabled) {
      setAlarmError(
        'Enable sound or vibration in Settings before testing the alarm.',
      );
      return;
    }

    setIsAlarmBusy(true);

    try {
      const configuredPin = await hasPin();

      if (!configuredPin) {
        setAlarmError(
          'Set up a security PIN in Settings before testing the alarm.',
        );
        return;
      }

      await startAlarm(settings.soundEnabled, settings.vibrationEnabled);
      setIsAlarmActive(true);
    } catch (error) {
      setAlarmError(
        error instanceof Error
          ? error.message
          : 'Unable to start the alarm test.',
      );
    } finally {
      setIsAlarmBusy(false);
    }
  };

  const handleRequestAlarmStop = () => {
    setAlarmPin('');
    setPinError(null);
    setIsPinModalVisible(true);
  };

  const handleConfirmAlarmStop = async () => {
    if (isAlarmBusy) {
      return;
    }

    setIsAlarmBusy(true);
    setPinError(null);

    try {
      await stopAlarm(alarmPin);
      setIsAlarmActive(false);
      setIsPinModalVisible(false);
      setAlarmPin('');
      setAlarmError(null);
    } catch (error) {
      setPinError(
        error instanceof Error
          ? error.message
          : 'Unable to verify PIN or stop alarm.',
      );
    } finally {
      setIsAlarmBusy(false);
    }
  };

  const renderSensorAxis = (label: string, value: number | null) => (
    <View style={styles.sensorAxis}>
      <Text style={styles.sensorAxisLabel}>{label}</Text>
      <Text style={styles.sensorAxisValue}>{formatSensorValue(value)}</Text>
    </View>
  );

  const displayedCountdownIsActive =
    nativeCountdownActive || countdownStatus === 'counting';
  const displayedCountdownRemaining = nativeCountdownActive
    ? nativeCountdownRemaining
    : countdownRemaining;
  const displayedCountdownStatus = nativeCountdownActive
    ? 'counting'
    : countdownStatus;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <AppHeader title="PHONE GUARD" subtitle="PERSONAL SECURITY SYSTEM" />

        {/* WELCOME */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Your security starts here.</Text>
          <Text style={styles.welcomeDescription}>
            Manage your device protection from one place.
          </Text>
        </View>

        {/* PROTECTION CARD */}
        <View style={styles.protectionCard}>
          <View style={styles.protectionCardHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>DEVICE PROTECTION</Text>
              <Text style={styles.protectionTitle}>
                {protectionEnabled
                  ? 'Protection Active'
                  : 'Protection Disabled'}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                protectionEnabled
                  ? styles.statusBadgeEnabled
                  : styles.statusBadgeDisabled,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  protectionEnabled
                    ? styles.statusDotEnabled
                    : styles.statusDotDisabled,
                ]}
              />
              <Text style={styles.statusBadgeText}>
                {protectionEnabled ? 'PROTECTED' : 'STANDBY'}
              </Text>
            </View>
          </View>

          <View style={styles.protectionVisual}>
            <View style={styles.outerRing}>
              <View style={styles.middleRing}>
                <View style={styles.innerRing}>
                  <Pressable
                    onPress={handleProtectionToggle}
                    style={({ pressed }) => [
                      styles.protectionButton,
                      protectionEnabled
                        ? styles.protectionButtonEnabled
                        : styles.protectionButtonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.protectionButtonIcon}>
                      {protectionEnabled ? '✓' : '⌑'}
                    </Text>
                    <Text style={styles.protectionButtonText}>
                      {protectionEnabled ? 'ENABLED' : 'ACTIVATE'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.protectionDescription}>
            {protectionEnabled
              ? 'Your device is being monitored in the background. Movement can trigger the security countdown.'
              : 'Your device is currently not being monitored.'}
          </Text>

          <View style={styles.cardDivider} />

          <View style={styles.protectionToggleRow}>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleTitle}>Device Protection</Text>
              <Text style={styles.toggleSubtitle}>
                {protectionEnabled
                  ? 'Background monitoring is active'
                  : 'Background monitoring is disabled'}
              </Text>
            </View>

            <Switch
              value={protectionEnabled}
              onValueChange={handleProtectionToggle}
              disabled={isServiceBusy}
              trackColor={{
                false: colors.border,
                true: colors.primary,
              }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* MONITORING OVERVIEW */}
        <SectionHeader
          title="Monitoring Overview"
          subtitle="Current security configuration"
        />

        <View style={styles.monitoringGrid}>
          <View style={styles.monitoringCard}>
            <View style={styles.monitoringCardHeader}>
              <Text style={styles.monitoringIcon}>⌁</Text>
              <View
                style={[
                  styles.smallStatusDot,
                  isMonitoring && styles.activeStatusDot,
                ]}
              />
            </View>
            <Text style={styles.monitoringLabel}>MOTION DETECTION</Text>
            <Text style={styles.monitoringValue}>
              {isMonitoring ? 'Connected' : 'Not connected'}
            </Text>
            <Text style={styles.monitoringHint}>
              {isMonitoring ? 'Sensor test running' : 'Start sensor test below'}
            </Text>
          </View>

          <View style={styles.monitoringCard}>
            <View style={styles.monitoringCardHeader}>
              <Text style={styles.monitoringIcon}>◷</Text>
              <View style={styles.smallStatusDot} />
            </View>
            <Text style={styles.monitoringLabel}>ALARM COUNTDOWN</Text>
            <Text style={styles.monitoringValue}>
              {settings.countdown} Seconds
            </Text>
            <Text style={styles.monitoringHint}>Configured duration</Text>
          </View>

          <View style={styles.monitoringCard}>
            <View style={styles.monitoringCardHeader}>
              <Text style={styles.monitoringIcon}>◎</Text>
              <View style={styles.smallStatusDot} />
            </View>
            <Text style={styles.monitoringLabel}>SENSITIVITY</Text>
            <Text style={styles.monitoringValue}>{settings.sensitivity}</Text>
            <Text style={styles.monitoringHint}>Configured sensitivity</Text>
          </View>

          <View style={styles.monitoringCard}>
            <View style={styles.monitoringCardHeader}>
              <Text style={styles.monitoringIcon}>♫</Text>
              <View style={styles.smallStatusDot} />
            </View>
            <Text style={styles.monitoringLabel}>ALARM SYSTEM</Text>
            <Text style={styles.monitoringValue}>
              {[
                settings.soundEnabled ? 'Sound' : null,
                settings.vibrationEnabled ? 'Vibration' : null,
              ]
                .filter(Boolean)
                .join(' + ') || 'Disabled'}
            </Text>
            <Text style={styles.monitoringHint}>Configured alarm output</Text>
          </View>
        </View>

        {/* BACKGROUND SERVICE STATUS */}
        <SectionHeader
          title="Background Service"
          subtitle="Android persistent notification and monitoring"
        />

        <View style={styles.foregroundServiceCard}>
          <View style={styles.foregroundServiceHeader}>
            <View style={styles.foregroundServiceHeaderText}>
              <Text style={styles.foregroundServiceTitle}>
                Background Service
              </Text>
              <Text style={styles.foregroundServiceSubtitle}>
                Notification and service lifecycle
              </Text>
            </View>
            <View
              style={[
                styles.foregroundServiceBadge,
                serviceStatus === 'start-requested'
                  ? styles.foregroundServiceBadgeActive
                  : styles.foregroundServiceBadgeIdle,
              ]}
            >
              <View
                style={[
                  styles.foregroundServiceDot,
                  serviceStatus === 'start-requested'
                    ? styles.foregroundServiceDotActive
                    : styles.foregroundServiceDotIdle,
                ]}
              />
              <Text style={styles.foregroundServiceBadgeText}>
                {serviceStatus === 'start-requested'
                  ? 'RUNNING'
                  : serviceStatus === 'stop-requested'
                  ? 'STOPPING'
                  : 'STOPPED'}
              </Text>
            </View>
          </View>

          <Text style={styles.foregroundServiceDescription}>
            Phone Guard monitors movement using the Android foreground service.
            The persistent notification remains visible while protection is
            enabled.
          </Text>

          <Pressable
            onPress={
              serviceStatus === 'start-requested'
                ? handleStopForegroundService
                : handleStartForegroundService
            }
            disabled={isServiceBusy}
            style={({ pressed }) => [
              styles.foregroundServiceButton,
              serviceStatus === 'start-requested'
                ? styles.foregroundServiceStopButton
                : styles.foregroundServiceStartButton,
              (pressed || isServiceBusy) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.foregroundServiceButtonText}>
              {isServiceBusy
                ? 'PLEASE WAIT...'
                : serviceStatus === 'start-requested'
                ? 'STOP FOREGROUND SERVICE'
                : 'START FOREGROUND SERVICE'}
            </Text>
          </Pressable>

          {serviceError !== null && (
            <View style={styles.sensorErrorBox}>
              <Text style={styles.sensorErrorText}>{serviceError}</Text>
            </View>
          )}

          <Text style={styles.foregroundServiceFootnote}>
            Test only: this service currently displays a persistent
            notification. The native service also monitors movement, runs the
            configured countdown, and starts the alarm when the countdown
            finishes. Status shows the last request sent to Android, not
            independent confirmation that the service is running.
          </Text>
        </View>

        {/* SENSOR DIAGNOSTICS */}
        <SectionHeader
          title="Sensor Diagnostics"
          subtitle="Live Android hardware sensor readings"
        />

        <View style={styles.sensorCard}>
          <View style={styles.sensorCardHeader}>
            <View>
              <Text style={styles.sensorCardTitle}>Hardware Monitoring</Text>
              <Text style={styles.sensorCardSubtitle}>
                Accelerometer and gyroscope
              </Text>
            </View>

            <View
              style={[
                styles.sensorStatusBadge,
                isMonitoring
                  ? styles.sensorStatusActive
                  : styles.sensorStatusInactive,
              ]}
            >
              <View
                style={[
                  styles.sensorStatusDot,
                  isMonitoring
                    ? styles.activeStatusDot
                    : styles.inactiveStatusDot,
                ]}
              />
              <Text
                style={[
                  styles.sensorStatusText,
                  isMonitoring
                    ? styles.sensorStatusTextActive
                    : styles.sensorStatusTextInactive,
                ]}
              >
                {isMonitoring ? 'RUNNING' : 'STOPPED'}
              </Text>
            </View>
          </View>

          <Text style={styles.sensorDescription}>
            Start the test and gently move or rotate your phone to observe how
            the sensor values change.
          </Text>

          <Pressable
            onPress={
              isMonitoring ? handleStopMonitoring : handleStartMonitoring
            }
            disabled={isStarting}
            style={({ pressed }) => [
              styles.sensorButton,
              isMonitoring ? styles.sensorButtonStop : styles.sensorButtonStart,
              (pressed || isStarting) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.sensorButtonText}>
              {isStarting
                ? 'STARTING...'
                : isMonitoring
                ? 'STOP SENSOR TEST'
                : 'START SENSOR TEST'}
            </Text>
          </Pressable>

          {sensorError !== null && (
            <View style={styles.sensorErrorBox}>
              <Text style={styles.sensorErrorText}>{sensorError}</Text>
            </View>
          )}

          {sensorAvailability !== null && (
            <View style={styles.availabilityContainer}>
              <View style={styles.availabilityRow}>
                <Text style={styles.availabilityLabel}>Accelerometer</Text>
                <Text
                  style={[
                    styles.availabilityValue,
                    sensorAvailability.accelerometerAvailable
                      ? styles.availableText
                      : styles.unavailableText,
                  ]}
                >
                  {sensorAvailability.accelerometerAvailable
                    ? 'Available'
                    : 'Unavailable'}
                </Text>
              </View>

              <View style={styles.availabilityRow}>
                <Text style={styles.availabilityLabel}>Gyroscope</Text>
                <Text
                  style={[
                    styles.availabilityValue,
                    sensorAvailability.gyroscopeAvailable
                      ? styles.availableText
                      : styles.unavailableText,
                  ]}
                >
                  {sensorAvailability.gyroscopeAvailable
                    ? 'Available'
                    : 'Unavailable'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.sensorDivider} />

          <Text style={styles.sensorSectionTitle}>ACCELEROMETER</Text>
          <Text style={styles.sensorUnit}>Unit: m/s²</Text>

          <View style={styles.sensorAxisContainer}>
            {renderSensorAxis('X AXIS', accelerometerData.x)}
            {renderSensorAxis('Y AXIS', accelerometerData.y)}
            {renderSensorAxis('Z AXIS', accelerometerData.z)}
          </View>

          <View style={styles.sensorDivider} />

          <Text style={styles.sensorSectionTitle}>GYROSCOPE</Text>
          <Text style={styles.sensorUnit}>Unit: rad/s</Text>

          <View style={styles.sensorAxisContainer}>
            {renderSensorAxis('X AXIS', gyroscopeData.x)}
            {renderSensorAxis('Y AXIS', gyroscopeData.y)}
            {renderSensorAxis('Z AXIS', gyroscopeData.z)}
          </View>

          <Text style={styles.sensorFootnote}>
            Values update directly from the Android hardware sensors. This
            diagnostic test does not activate device protection.
          </Text>
        </View>

        {/* MOTION DETECTION TEST */}
        <SectionHeader
          title="Motion Detection Test"
          subtitle="Experimental movement analysis"
        />

        <View style={styles.motionCard}>
          <View style={styles.motionCardHeader}>
            <View>
              <Text style={styles.motionCardTitle}>Detection Engine</Text>
              <Text style={styles.motionCardSubtitle}>
                Sensitivity: {settings.sensitivity}
              </Text>
            </View>
            <View
              style={[
                styles.motionStatusBadge,
                !isMonitoring
                  ? styles.motionStatusInactive
                  : isCalibrated
                  ? motionResult.detected
                    ? styles.motionStatusDetected
                    : styles.motionStatusReady
                  : styles.motionStatusCalibrating,
              ]}
            >
              <Text style={styles.motionStatusText}>
                {!isMonitoring
                  ? 'IDLE'
                  : !isCalibrated
                  ? 'CALIBRATING'
                  : motionResult.detected
                  ? 'MOVEMENT'
                  : 'READY'}
              </Text>
            </View>
          </View>

          <Text style={styles.motionDescription}>
            Start the sensor test above and keep your phone still on a flat
            surface for approximately 2 seconds. Then move or rotate it gently
            to test the detection thresholds.
          </Text>

          <View style={styles.motionMetricGrid}>
            <View style={styles.motionMetric}>
              <Text style={styles.motionMetricLabel}>ACCELERATION CHANGE</Text>
              <Text style={styles.motionMetricValue}>
                {motionResult.accelerationChange.toFixed(3)}
              </Text>
              <Text style={styles.motionMetricUnit}>m/s²</Text>
            </View>
            <View style={styles.motionMetric}>
              <Text style={styles.motionMetricLabel}>ROTATION SPEED</Text>
              <Text style={styles.motionMetricValue}>
                {motionResult.rotationSpeed.toFixed(3)}
              </Text>
              <Text style={styles.motionMetricUnit}>rad/s</Text>
            </View>
          </View>

          <View
            style={[
              styles.motionResultBox,
              motionResult.detected && isCalibrated
                ? styles.motionResultDetected
                : styles.motionResultNormal,
            ]}
          >
            <Text style={styles.motionResultTitle}>
              {!isMonitoring
                ? 'Sensor test is stopped'
                : !isCalibrated
                ? 'Keep your phone still'
                : motionResult.detected
                ? 'Movement threshold crossed'
                : 'No significant movement detected'}
            </Text>
            <Text style={styles.motionResultDescription}>
              {!isMonitoring
                ? 'Start the sensor test to begin calibration.'
                : !isCalibrated
                ? 'Establishing a resting baseline from the accelerometer.'
                : motionResult.detected
                ? motionResult.reason ?? 'Sensor movement detected.'
                : 'The latest sensor readings are below the configured thresholds.'}
            </Text>
          </View>

          <Text style={styles.motionFootnote}>
            Experimental test only. This detector does not activate protection,
            start a countdown, or trigger an alarm.
          </Text>
        </View>

        {/* COUNTDOWN TEST */}
        <SectionHeader
          title="Security Countdown"
          subtitle="Movement-triggered countdown prototype"
        />

        <View style={styles.countdownCard}>
          <View style={styles.countdownHeader}>
            <View>
              <Text style={styles.countdownTitle}>Movement Response</Text>
              <Text style={styles.countdownSubtitle}>
                Configured delay: {settings.countdown} seconds
              </Text>
            </View>
            <View
              style={[
                styles.countdownBadge,
                displayedCountdownStatus === 'counting'
                  ? styles.countdownBadgeActive
                  : displayedCountdownStatus === 'completed'
                  ? styles.countdownBadgeComplete
                  : styles.countdownBadgeIdle,
              ]}
            >
              <Text style={styles.countdownBadgeText}>
                {displayedCountdownStatus === 'counting'
                  ? 'COUNTING'
                  : displayedCountdownStatus === 'cancelled'
                  ? 'CANCELLED'
                  : displayedCountdownStatus === 'completed'
                  ? 'COMPLETE'
                  : 'STANDBY'}
              </Text>
            </View>
          </View>

          <View style={styles.countdownDisplay}>
            <Text style={styles.countdownNumber}>
              {displayedCountdownIsActive ? displayedCountdownRemaining : '--'}
            </Text>
            <Text style={styles.countdownUnit}>SECONDS</Text>
          </View>

          <Text style={styles.countdownDescription}>
            {nativeCountdownActive
              ? 'Movement was detected by the foreground protection service. The native countdown is running.'
              : countdownStatus === 'counting'
              ? 'Movement was detected during the sensor test. The diagnostic countdown is running.'
              : countdownStatus === 'cancelled'
              ? 'The diagnostic countdown was cancelled. Stop and restart the sensor test to re-arm it.'
              : countdownStatus === 'completed'
              ? 'The diagnostic countdown finished. The native protection service countdown is displayed here whenever it starts.'
              : isMonitoring && isCalibrated
              ? 'Waiting for movement. Move the phone to start the diagnostic countdown.'
              : isMonitoring
              ? 'Keep the phone still until calibration is complete.'
              : 'Start the foreground protection service to monitor its countdown here, or start the sensor test for a diagnostic countdown.'}
          </Text>

          {countdownStatus === 'counting' && (
            <Pressable
              onPress={handleCancelCountdown}
              style={({ pressed }) => [
                styles.countdownCancelButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.countdownCancelText}>CANCEL COUNTDOWN</Text>
            </Pressable>
          )}

          <Text style={styles.countdownFootnote}>
            This is a foreground diagnostic countdown only. The native
            background service runs its own countdown and starts the alarm
            independently of this screen.
          </Text>
        </View>

        {/* ALARM OUTPUT TEST */}
        <SectionHeader
          title="Alarm Output Test"
          subtitle="Native Android sound and vibration"
        />

        <View style={styles.alarmTestCard}>
          <View style={styles.alarmTestHeader}>
            <View>
              <Text style={styles.alarmTestTitle}>Alarm Hardware</Text>
              <Text style={styles.alarmTestSubtitle}>
                {isAlarmActive
                  ? 'Alarm output is active'
                  : 'Ready for a manual test'}
              </Text>
            </View>
            <View
              style={[
                styles.alarmTestBadge,
                isAlarmActive
                  ? styles.alarmTestBadgeActive
                  : styles.alarmTestBadgeIdle,
              ]}
            >
              <Text style={styles.alarmTestBadgeText}>
                {isAlarmActive ? 'ACTIVE' : 'STANDBY'}
              </Text>
            </View>
          </View>

          <Text style={styles.alarmTestDescription}>
            This test uses the sound and vibration options currently selected in
            Settings. A configured PIN is required to stop the test.
          </Text>

          <View style={styles.alarmOutputList}>
            <Text style={styles.alarmOutputItem}>
              Sound: {settings.soundEnabled ? 'Enabled' : 'Disabled'}
            </Text>
            <Text style={styles.alarmOutputItem}>
              Vibration: {settings.vibrationEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>

          <Pressable
            onPress={
              isAlarmActive ? handleRequestAlarmStop : handleStartAlarmTest
            }
            disabled={isAlarmBusy}
            style={({ pressed }) => [
              styles.alarmTestButton,
              isAlarmActive
                ? styles.alarmTestStopButton
                : styles.alarmTestStartButton,
              (pressed || isAlarmBusy) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.alarmTestButtonText}>
              {isAlarmBusy
                ? 'PLEASE WAIT...'
                : isAlarmActive
                ? 'STOP ALARM (PIN REQUIRED)'
                : 'START ALARM TEST'}
            </Text>
          </Pressable>

          {alarmError !== null && (
            <View style={styles.sensorErrorBox}>
              <Text style={styles.sensorErrorText}>{alarmError}</Text>
            </View>
          )}

          <Text style={styles.alarmTestFootnote}>
            Manual test and background security alarms use native Android
            output. The native Android layer verifies the PIN before stopping an
            active alarm.
          </Text>
        </View>

        <Modal
          visible={isPinModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!isAlarmActive) {
              setIsPinModalVisible(false);
            }
          }}
        >
          <View style={styles.pinModalBackdrop}>
            <View style={styles.pinModalCard}>
              <Text style={styles.pinModalTitle}>Verify Security PIN</Text>
              <Text style={styles.pinModalDescription}>
                Enter your Phone Guard PIN to stop the alarm.
              </Text>
              <TextInput
                value={alarmPin}
                onChangeText={value => {
                  setAlarmPin(value.replace(/\D/g, '').slice(0, 6));
                  setPinError(null);
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="Enter PIN"
                placeholderTextColor={colors.textMuted}
                style={styles.pinModalInput}
                autoFocus
              />
              {pinError !== null && (
                <Text style={styles.pinModalError}>{pinError}</Text>
              )}
              <Pressable
                onPress={handleConfirmAlarmStop}
                disabled={isAlarmBusy || alarmPin.length < 4}
                style={({ pressed }) => [
                  styles.pinModalConfirmButton,
                  (pressed || isAlarmBusy || alarmPin.length < 4) &&
                    styles.buttonPressed,
                ]}
              >
                <Text style={styles.pinModalConfirmText}>
                  {isAlarmBusy ? 'VERIFYING...' : 'VERIFY AND STOP'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* SECURITY INFORMATION */}
        <InfoCard
          title="Security Information"
          description="Native background monitoring detects movement, runs the configured countdown, and starts the alarm. A configured PIN is required to stop it."
          icon="ⓘ"
        />

        <Text style={styles.footerText}>
          PHONE GUARD • PERSONAL DEVICE SECURITY
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 25,
  },

  welcomeSection: {
    marginBottom: 24,
  },
  welcomeTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  welcomeDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },

  protectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 30,
  },
  protectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionEyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  protectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    marginTop: 7,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  statusBadgeEnabled: {
    backgroundColor: '#172E36',
  },
  statusBadgeDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusDotEnabled: {
    backgroundColor: colors.success,
  },
  statusDotDisabled: {
    backgroundColor: colors.warning,
  },
  statusBadgeText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  protectionVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 28,
  },
  outerRing: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: '#263D5C',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101D30',
  },
  middleRing: {
    width: 158,
    height: 158,
    borderRadius: 79,
    borderWidth: 1,
    borderColor: '#315078',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerRing: {
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#142746',
  },
  protectionButton: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  protectionButtonEnabled: {
    backgroundColor: '#153C35',
    borderColor: colors.success,
  },
  protectionButtonDisabled: {
    backgroundColor: '#18345A',
    borderColor: colors.primary,
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  protectionButtonIcon: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '600',
  },
  protectionButtonText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 5,
  },
  protectionDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  protectionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  toggleSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },

  monitoringGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 30,
  },
  monitoringCard: {
    width: '48.2%',
    minHeight: 145,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 15,
  },
  monitoringCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  monitoringIcon: {
    color: colors.primaryLight,
    fontSize: 24,
    fontWeight: '600',
  },
  smallStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  activeStatusDot: {
    backgroundColor: colors.success,
  },
  monitoringLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  monitoringValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  monitoringHint: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 6,
  },

  foregroundServiceCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 22,
  },
  foregroundServiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  foregroundServiceHeaderText: {
    flex: 1,
  },
  foregroundServiceTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  foregroundServiceSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  foregroundServiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 20,
  },
  foregroundServiceBadgeActive: {
    backgroundColor: '#153C35',
  },
  foregroundServiceBadgeIdle: {
    backgroundColor: colors.surfaceLight,
  },
  foregroundServiceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  foregroundServiceDotActive: {
    backgroundColor: colors.success,
  },
  foregroundServiceDotIdle: {
    backgroundColor: colors.textMuted,
  },
  foregroundServiceBadgeText: {
    color: colors.textSecondary,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  foregroundServiceDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 15,
    marginBottom: 16,
  },
  foregroundServiceButton: {
    minHeight: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foregroundServiceStartButton: {
    backgroundColor: colors.primary,
  },
  foregroundServiceStopButton: {
    backgroundColor: '#7F1D1D',
  },
  foregroundServiceButtonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  foregroundServiceFootnote: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 15,
    marginTop: 14,
  },

  sensorCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 22,
  },
  sensorCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sensorCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sensorCardSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  sensorStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 20,
  },
  sensorStatusActive: {
    backgroundColor: '#153C35',
  },
  sensorStatusInactive: {
    backgroundColor: colors.surfaceLight,
  },
  sensorStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  inactiveStatusDot: {
    backgroundColor: colors.textMuted,
  },
  sensorStatusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  sensorStatusTextActive: {
    color: colors.success,
  },
  sensorStatusTextInactive: {
    color: colors.textMuted,
  },
  sensorDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 15,
    marginBottom: 16,
  },
  sensorButton: {
    minHeight: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sensorButtonStart: {
    backgroundColor: colors.primary,
  },
  sensorButtonStop: {
    backgroundColor: '#7F1D1D',
  },
  sensorButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sensorErrorBox: {
    backgroundColor: '#3B1D27',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  sensorErrorText: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 17,
  },
  availabilityContainer: {
    marginTop: 17,
    gap: 11,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  availabilityValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  availableText: {
    color: colors.success,
  },
  unavailableText: {
    color: colors.danger,
  },
  sensorDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 18,
  },
  sensorSectionTitle: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sensorUnit: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  sensorAxisContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 13,
  },
  sensorAxis: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  sensorAxisLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  sensorAxisValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 7,
    fontVariant: ['tabular-nums'],
  },
  sensorFootnote: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 17,
  },

  motionCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 22,
  },
  motionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  motionCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  motionCardSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  motionStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },
  motionStatusInactive: {
    backgroundColor: colors.surfaceLight,
  },
  motionStatusCalibrating: {
    backgroundColor: '#3B2E18',
  },
  motionStatusReady: {
    backgroundColor: '#153C35',
  },
  motionStatusDetected: {
    backgroundColor: '#4A2025',
  },
  motionStatusText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  motionDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 15,
    marginBottom: 16,
  },
  motionMetricGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  motionMetric: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    padding: 13,
  },
  motionMetricLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  motionMetricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 9,
    fontVariant: ['tabular-nums'],
  },
  motionMetricUnit: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 3,
  },
  motionResultBox: {
    borderRadius: 12,
    padding: 13,
    marginTop: 14,
  },
  motionResultNormal: {
    backgroundColor: colors.surfaceLight,
  },
  motionResultDetected: {
    backgroundColor: '#3B1D27',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  motionResultTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  motionResultDescription: {
    color: colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 5,
  },
  motionFootnote: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 14,
  },

  countdownCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 22,
  },
  countdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  countdownSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  countdownBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  countdownBadgeActive: {
    backgroundColor: '#42212A',
  },
  countdownBadgeComplete: {
    backgroundColor: '#3B2F16',
  },
  countdownBadgeIdle: {
    backgroundColor: colors.surfaceLight,
  },
  countdownBadgeText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  countdownDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
  },
  countdownNumber: {
    color: colors.text,
    fontSize: 54,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countdownUnit: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  countdownDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
  },
  countdownCancelButton: {
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  countdownCancelText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  countdownFootnote: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 15,
    marginTop: 15,
  },

  alarmTestCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 22,
  },
  alarmTestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alarmTestTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  alarmTestSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  alarmTestBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  alarmTestBadgeActive: {
    backgroundColor: '#42212A',
  },
  alarmTestBadgeIdle: {
    backgroundColor: colors.surfaceLight,
  },
  alarmTestBadgeText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  alarmTestDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 15,
  },
  alarmOutputList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 16,
  },
  alarmOutputItem: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  alarmTestButton: {
    minHeight: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alarmTestStartButton: {
    backgroundColor: colors.primary,
  },
  alarmTestStopButton: {
    backgroundColor: '#7F1D1D',
  },
  alarmTestButtonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  alarmTestFootnote: {
    color: colors.textMuted,
    fontSize: 9,
    lineHeight: 15,
    marginTop: 14,
  },
  pinModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pinModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
  },
  pinModalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  pinModalDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 9,
  },
  pinModalInput: {
    color: colors.text,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    minHeight: 50,
    paddingHorizontal: 15,
    marginTop: 20,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinModalError: {
    color: '#FCA5A5',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
  pinModalConfirmButton: {
    minHeight: 46,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  pinModalConfirmText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  pinModalCancelButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
  },
  pinModalCancelText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  footerText: {
    color: colors.textMuted,
    fontSize: 8,
    textAlign: 'center',
    letterSpacing: 1.2,
    marginTop: 5,
  },
});

export default HomeScreen;
