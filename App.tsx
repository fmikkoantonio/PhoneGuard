import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PinSetupScreen from './src/screens/PinSetupScreen';

import colors from './src/theme/colors';

import {
  AppSettings,
  DEFAULT_SETTINGS,
  MotionSensitivity,
} from './src/types/AppSettings';

import { loadSettings, saveSettings } from './src/services/settingsStorage';

import {
  updateProtectionSensitivity,
  updateProtectionCountdown,
  updateProtectionAlarmSettings,
} from './src/services/protectionService';

type Screen = 'home' | 'settings' | 'pinSetup';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [isLoading, setIsLoading] = useState(true);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    let isMounted = true;

    const initializeSettings = async () => {
      try {
        const savedSettings = await loadSettings();

        if (!isMounted) {
          return;
        }

        setSettings(savedSettings);

        try {
          await updateProtectionSensitivity(savedSettings.sensitivity);

          await updateProtectionCountdown(savedSettings.countdown);

          await updateProtectionAlarmSettings(
            savedSettings.soundEnabled,
            savedSettings.vibrationEnabled,
          );
        } catch (error) {
          console.warn(
            'Unable to synchronize saved settings with native service:',
            error,
          );
        }
      } catch (error) {
        console.error('Unable to load Phone Guard settings:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      saveSettings(settings).catch(error => {
        console.error('Unable to save Phone Guard settings:', error);
      });
    }
  }, [settings, isLoading]);

  const updateCountdown = (countdown: number) => {
    setSettings(previous => ({
      ...previous,
      countdown,
    }));

    updateProtectionCountdown(countdown).catch(error => {
      console.error('Unable to update native protection countdown:', error);
    });
  };

  const updateSensitivity = (sensitivity: MotionSensitivity) => {
    setSettings(previous => ({
      ...previous,
      sensitivity,
    }));

    updateProtectionSensitivity(sensitivity).catch(error => {
      console.error('Unable to update native protection sensitivity:', error);
    });
  };

  const updateSound = (soundEnabled: boolean) => {
    setSettings(previous => ({
      ...previous,
      soundEnabled,
    }));

    updateProtectionAlarmSettings(
      soundEnabled,
      settings.vibrationEnabled,
    ).catch(error => {
      console.error('Unable to update native alarm settings:', error);
    });
  };

  const updateVibration = (vibrationEnabled: boolean) => {
    setSettings(previous => ({
      ...previous,
      vibrationEnabled,
    }));

    updateProtectionAlarmSettings(
      settings.soundEnabled,
      vibrationEnabled,
    ).catch(error => {
      console.error('Unable to update native alarm settings:', error);
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />

        <Text style={styles.loadingText}>Loading Phone Guard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screenContainer}>
        {currentScreen === 'home' && <HomeScreen settings={settings} />}

        {currentScreen === 'settings' && (
          <SettingsScreen
            settings={settings}
            onCountdownChange={updateCountdown}
            onSensitivityChange={updateSensitivity}
            onSoundChange={updateSound}
            onVibrationChange={updateVibration}
            onConfigurePin={() => setCurrentScreen('pinSetup')}
          />
        )}

        {currentScreen === 'pinSetup' && (
          <PinSetupScreen
            onComplete={() => setCurrentScreen('settings')}
            onCancel={() => setCurrentScreen('settings')}
          />
        )}
      </View>

      {currentScreen !== 'pinSetup' && (
        <View
          style={[
            styles.bottomNavigation,
            {
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <Pressable
            onPress={() => setCurrentScreen('home')}
            style={({ pressed }) => [
              styles.navItem,
              currentScreen === 'home' && styles.navItemSelected,
              pressed && styles.navPressed,
            ]}
          >
            <Text
              style={[
                styles.navIcon,
                currentScreen === 'home' && styles.navItemActive,
              ]}
            >
              ◈
            </Text>

            <Text
              style={[
                styles.navLabel,
                currentScreen === 'home' && styles.navItemActive,
              ]}
            >
              Home
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setCurrentScreen('settings')}
            style={({ pressed }) => [
              styles.navItem,
              currentScreen === 'settings' && styles.navItemSelected,
              pressed && styles.navPressed,
            ]}
          >
            <Text
              style={[
                styles.navIcon,
                currentScreen === 'settings' && styles.navItemActive,
              ]}
            >
              ⚙
            </Text>

            <Text
              style={[
                styles.navLabel,
                currentScreen === 'settings' && styles.navItemActive,
              ]}
            >
              Settings
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 14,
  },
  bottomNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  navItemSelected: {
    backgroundColor: '#182A43',
  },
  navIcon: {
    color: colors.textMuted,
    fontSize: 21,
    marginBottom: 5,
  },
  navLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  navItemActive: {
    color: colors.primaryLight,
  },
  navPressed: {
    opacity: 0.6,
  },
});

export default App;
