import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import SectionHeader from '../components/SectionHeader';
import InfoCard from '../components/InfoCard';
import SettingsCard from '../components/SettingsCard';
import SettingRow from '../components/SettingRow';
import OptionSelector from '../components/OptionSelector';

import colors from '../theme/colors';

import { AppSettings, MotionSensitivity } from '../types/AppSettings';

import { hasPin } from '../services/pinStorage';

type PinStatus = 'loading' | 'configured' | 'notConfigured' | 'error';

type SettingsScreenProps = {
  settings: AppSettings;
  onCountdownChange: (value: number) => void;
  onSensitivityChange: (value: MotionSensitivity) => void;
  onSoundChange: (value: boolean) => void;
  onVibrationChange: (value: boolean) => void;
  onConfigurePin: () => void;
};

function SettingsScreen({
  settings,
  onCountdownChange,
  onSensitivityChange,
  onSoundChange,
  onVibrationChange,
  onConfigurePin,
}: SettingsScreenProps) {
  const [pinStatus, setPinStatus] = useState<PinStatus>('loading');

  const countdownOptions = [3, 5, 10];

  const sensitivityOptions: MotionSensitivity[] = ['Low', 'Medium', 'High'];

  useEffect(() => {
    let isMounted = true;

    const checkPinStatus = async () => {
      try {
        const configured = await hasPin();

        if (isMounted) {
          setPinStatus(configured ? 'configured' : 'notConfigured');
        }
      } catch (error) {
        console.error('Failed to check PIN status:', error);

        if (isMounted) {
          setPinStatus('error');
        }
      }
    };

    checkPinStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const getPinStatusText = () => {
    switch (pinStatus) {
      case 'configured':
        return 'PIN Configured';

      case 'notConfigured':
        return 'PIN Not Set';

      case 'error':
        return 'Unable to Check PIN';

      default:
        return 'Checking PIN Status...';
    }
  };

  const getPinStatusColor = () => {
    switch (pinStatus) {
      case 'configured':
        return colors.success;

      case 'notConfigured':
        return colors.warning;

      case 'error':
        return colors.danger;

      default:
        return colors.textMuted;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <AppHeader
          title="Settings"
          subtitle="Configure your security preferences"
        />

        {/* PROTECTION SETTINGS */}
        <SectionHeader
          title="Protection Settings"
          subtitle="Customize how Phone Guard responds to movement."
        />

        <SettingsCard>
          <OptionSelector
            label="ALARM COUNTDOWN"
            description="Time before the alarm activates after movement is detected."
            options={countdownOptions.map(option => `${option}s`)}
            value={`${settings.countdown}s`}
            onChange={value =>
              onCountdownChange(Number(value.replace('s', '')))
            }
          />

          <View style={styles.separator} />

          <OptionSelector
            label="MOTION SENSITIVITY"
            description="Adjust how sensitive movement detection should be."
            options={sensitivityOptions}
            value={settings.sensitivity}
            onChange={onSensitivityChange}
          />
        </SettingsCard>

        {/* ALARM SETTINGS */}
        <SectionHeader
          title="Alarm Settings"
          subtitle="Choose how the alarm should respond."
        />

        <SettingsCard>
          <SettingRow
            title="Sound Alarm"
            description="Play an audible alarm when unauthorized movement is detected."
            value={settings.soundEnabled}
            onValueChange={onSoundChange}
          />

          <View style={styles.separator} />

          <SettingRow
            title="Vibration"
            description="Enable continuous vibration during an alarm."
            value={settings.vibrationEnabled}
            onValueChange={onVibrationChange}
          />
        </SettingsCard>

        {/* SECURITY SETTINGS */}
        <SectionHeader
          title="Security"
          subtitle="Manage your device protection credentials."
        />

        <SettingsCard>
          <View style={styles.securityHeader}>
            <View style={styles.securityIconContainer}>
              <Text style={styles.securityIcon}>🔐</Text>
            </View>

            <View style={styles.securityTextContainer}>
              <Text style={styles.securityTitle}>Security PIN</Text>

              <Text style={styles.securityDescription}>
                Set a PIN required to deactivate the alarm.
              </Text>
            </View>
          </View>

          {/* PIN STATUS */}
          <View style={styles.pinStatusContainer}>
            <View
              style={[
                styles.statusIndicator,
                { backgroundColor: getPinStatusColor() },
              ]}
            />

            <Text
              style={[styles.pinStatusText, { color: getPinStatusColor() }]}
            >
              {getPinStatusText()}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.pinButton,
              pressed && styles.pressedButton,
            ]}
            onPress={onConfigurePin}
            disabled={pinStatus === 'loading' || pinStatus === 'error'}
          >
            <Text style={styles.pinButtonText}>
              {pinStatus === 'configured' ? 'Manage PIN' : 'Configure PIN'}
            </Text>

            <Text style={styles.pinButtonArrow}>→</Text>
          </Pressable>

          <Text style={styles.securityFooter}>
            Your PIN is stored using native secure credential storage.
          </Text>
        </SettingsCard>

        {/* APP INFORMATION */}
        <SectionHeader
          title="Application"
          subtitle="Phone Guard application information."
        />

        <SettingsCard>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Application</Text>

            <Text style={styles.infoValue}>Phone Guard</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>

            <Text style={styles.infoValue}>1.0.0</Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>

            <Text style={styles.infoValue}>Android</Text>
          </View>
        </SettingsCard>

        {/* DEVELOPMENT NOTICE */}
        <InfoCard
          title="DEVELOPMENT NOTICE"
          description="Your settings are saved locally on this device. Background monitoring, movement detection, and alarm activation still need to be connected to the native Android protection service."
          icon="ⓘ"
          variant="notice"
        />
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 15,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  securityIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1D3453',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  securityIcon: {
    fontSize: 20,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 5,
  },
  securityDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  pinStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pinStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pinButton: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinButtonText: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },
  pinButtonArrow: {
    color: colors.primaryLight,
    fontSize: 18,
  },
  pressedButton: {
    opacity: 0.7,
  },
  securityFooter: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 13,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  infoValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
});

export default SettingsScreen;
