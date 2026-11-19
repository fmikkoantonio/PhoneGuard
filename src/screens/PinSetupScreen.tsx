import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import colors from '../theme/colors';

import { hasPin, verifyPin, savePin, removePin } from '../services/pinStorage';

type PinSetupScreenProps = {
  onComplete: () => void;
  onCancel: () => void;
};

type PinStep = 'verify' | 'choose' | 'create' | 'confirm' | 'removeConfirm';

function PinSetupScreen({ onComplete, onCancel }: PinSetupScreenProps) {
  const [step, setStep] = useState<PinStep>('create');

  const [pinLength, setPinLength] = useState<4 | 6>(4);

  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isSaved, setIsSaved] = useState(false);
  const [isPinRemoved, setIsPinRemoved] = useState(false);

  const [error, setError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initializePinSetup = async () => {
      try {
        const configured = await hasPin();

        if (!isMounted) {
          return;
        }

        if (configured) {
          setIsChangingPin(true);
          setStep('verify');
        } else {
          setIsChangingPin(false);
          setStep('create');
        }
      } catch (checkError) {
        console.error('Failed to check existing PIN:', checkError);

        if (isMounted) {
          setError('Unable to check your security PIN. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    initializePinSetup();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleVerifyCurrentPin = async () => {
    Keyboard.dismiss();
    setError('');

    if (currentPin.length !== 4 && currentPin.length !== 6) {
      setError('Enter your complete current PIN.');
      return;
    }

    try {
      setIsSaving(true);

      const isValid = await verifyPin(currentPin);

      if (!isValid) {
        setCurrentPin('');
        setError('Incorrect PIN. Please try again.');
        return;
      }

      setCurrentPin('');
      setStep('choose');
    } catch (verifyError) {
      console.error('PIN verification failed:', verifyError);
      setError('Unable to verify your PIN. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    Keyboard.dismiss();
    setError('');

    if (pin.length !== pinLength) {
      setError(`Enter all ${pinLength} digits.`);
      return;
    }

    setStep('confirm');
  };

  const handleSavePin = async () => {
    Keyboard.dismiss();
    setError('');

    if (confirmPin.length !== pinLength) {
      setError(`Enter all ${pinLength} digits.`);
      return;
    }

    if (pin !== confirmPin) {
      setConfirmPin('');
      setError('PINs do not match. Please try again.');
      return;
    }

    try {
      setIsSaving(true);

      await savePin(pin);

      setIsSaved(true);
    } catch (saveError) {
      console.error('PIN save failed:', saveError);
      setError('Unable to save your PIN securely. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePin = async () => {
    try {
      setIsSaving(true);
      setError('');

      await removePin();

      setIsPinRemoved(true);
    } catch (removeError) {
      console.error('PIN removal failed:', removeError);
      setError('Unable to remove your PIN. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    setError('');
    setConfirmPin('');
    setStep(isChangingPin ? 'choose' : 'create');
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    onCancel();
  };

  const getStepLabel = () => {
    switch (step) {
      case 'verify':
        return 'VERIFY CURRENT PIN';
      case 'choose':
        return 'PIN MANAGEMENT';
      case 'create':
        return 'STEP 1 OF 2';
      case 'confirm':
        return 'STEP 2 OF 2';
      case 'removeConfirm':
        return 'REMOVE SECURITY PIN';
      default:
        return '';
    }
  };

  const successTitle = isPinRemoved
    ? 'PIN Removed Successfully!'
    : isChangingPin
    ? 'PIN Updated Successfully!'
    : 'PIN Saved Successfully!';

  const successDescription = isPinRemoved
    ? 'Your Phone Guard security PIN has been removed from this device.'
    : isChangingPin
    ? 'Your Phone Guard security PIN has been securely updated.'
    : 'Your Phone Guard security PIN has been configured successfully.';

  if (isChecking) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />

          <Text style={styles.loadingText}>Checking security PIN...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isSaved || isPinRemoved) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <View style={styles.successContainer}>
          <AppHeader title="Secure Your Device" subtitle="PIN management" />

          <View style={styles.successContent}>
            <View
              style={[
                styles.successIconContainer,
                isPinRemoved && styles.removedIconContainer,
              ]}
            >
              <Text
                style={[styles.successIcon, isPinRemoved && styles.removedIcon]}
              >
                {isPinRemoved ? '✓' : '✓'}
              </Text>
            </View>

            <Text style={styles.successTitle}>{successTitle}</Text>

            <Text style={styles.successDescription}>{successDescription}</Text>

            <View style={styles.successInfo}>
              <Text style={styles.successInfoTitle}>SECURITY STATUS</Text>

              <Text style={styles.successInfoText}>
                {isPinRemoved
                  ? 'No security PIN is currently configured.'
                  : 'Your security PIN is securely stored on this device.'}
              </Text>
            </View>

            <Pressable
              onPress={onComplete}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Continue to Settings</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <AppHeader
            title="Secure Your Device"
            subtitle={
              isChangingPin
                ? 'Manage your security PIN'
                : 'Set up your security PIN'
            }
          />

          <Pressable onPress={handleCancel} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back to Settings</Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.stepLabel}>{getStepLabel()}</Text>

            <Text style={styles.cardTitle}>
              {step === 'verify'
                ? 'Verify Current PIN'
                : step === 'choose'
                ? 'Manage Your PIN'
                : step === 'create'
                ? isChangingPin
                  ? 'Create New PIN'
                  : 'Create Your PIN'
                : step === 'confirm'
                ? 'Confirm New PIN'
                : 'Are You Sure?'}
            </Text>

            <Text style={styles.cardDescription}>
              {step === 'verify'
                ? 'Enter your existing security PIN before making changes.'
                : step === 'choose'
                ? 'Choose what you want to do with your security PIN.'
                : step === 'create'
                ? 'Choose a new 4-digit or 6-digit security PIN.'
                : step === 'confirm'
                ? 'Enter your new PIN again to confirm it.'
                : 'Removing your PIN means there will be no security PIN configured on this device.'}
            </Text>

            {step === 'choose' && (
              <View style={styles.managementOptions}>
                <Pressable
                  onPress={() => {
                    setPin('');
                    setConfirmPin('');
                    setError('');
                    setStep('create');
                  }}
                  style={({ pressed }) => [
                    styles.managementButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.managementButtonTitle}>Change PIN</Text>

                  <Text style={styles.managementButtonDescription}>
                    Create a new security PIN.
                  </Text>

                  <Text style={styles.managementArrow}>→</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setError('');
                    setStep('removeConfirm');
                  }}
                  style={({ pressed }) => [
                    styles.managementButton,
                    styles.removeOption,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.removeButtonTitle}>Remove PIN</Text>

                  <Text style={styles.managementButtonDescription}>
                    Remove your current security PIN.
                  </Text>

                  <Text style={styles.removeArrow}>→</Text>
                </Pressable>
              </View>
            )}

            {(step === 'verify' || step === 'create' || step === 'confirm') && (
              <>
                {step === 'create' && (
                  <View style={styles.lengthSelector}>
                    <Pressable
                      onPress={() => {
                        setPinLength(4);
                        setPin('');
                        setError('');
                      }}
                      style={[
                        styles.lengthOption,
                        pinLength === 4 && styles.lengthOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.lengthText,
                          pinLength === 4 && styles.lengthTextSelected,
                        ]}
                      >
                        4 DIGITS
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setPinLength(6);
                        setPin('');
                        setError('');
                      }}
                      style={[
                        styles.lengthOption,
                        pinLength === 6 && styles.lengthOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.lengthText,
                          pinLength === 6 && styles.lengthTextSelected,
                        ]}
                      >
                        6 DIGITS
                      </Text>
                    </Pressable>
                  </View>
                )}

                <Text style={styles.inputLabel}>
                  {step === 'verify'
                    ? 'CURRENT SECURITY PIN'
                    : step === 'create'
                    ? 'NEW SECURITY PIN'
                    : 'CONFIRM NEW PIN'}
                </Text>

                <TextInput
                  style={styles.pinInput}
                  value={
                    step === 'verify'
                      ? currentPin
                      : step === 'create'
                      ? pin
                      : confirmPin
                  }
                  onChangeText={value => {
                    const maxLength = step === 'verify' ? 6 : pinLength;

                    const digits = value
                      .replace(/[^0-9]/g, '')
                      .slice(0, maxLength);

                    if (step === 'verify') {
                      setCurrentPin(digits);
                    } else if (step === 'create') {
                      setPin(digits);
                    } else {
                      setConfirmPin(digits);
                    }

                    setError('');
                  }}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={step === 'verify' ? 6 : pinLength}
                  placeholder="Enter PIN"
                  placeholderTextColor={colors.textMuted}
                  editable={!isSaving}
                  returnKeyType="done"
                  onSubmitEditing={
                    step === 'verify'
                      ? handleVerifyCurrentPin
                      : step === 'create'
                      ? handleContinue
                      : handleSavePin
                  }
                />

                <Text style={styles.pinHint}>
                  {step === 'verify'
                    ? `${currentPin.length} digits entered`
                    : step === 'create'
                    ? `${pin.length} of ${pinLength} digits entered`
                    : `${confirmPin.length} of ${pinLength} digits entered`}
                </Text>

                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable
                  onPress={
                    step === 'verify'
                      ? handleVerifyCurrentPin
                      : step === 'create'
                      ? handleContinue
                      : handleSavePin
                  }
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                    isSaving && styles.buttonDisabled,
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {step === 'verify'
                        ? 'Verify PIN'
                        : step === 'create'
                        ? 'Continue'
                        : 'Save New PIN'}
                    </Text>
                  )}
                </Pressable>
              </>
            )}

            {step === 'confirm' && (
              <Pressable onPress={handleBack} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Go Back</Text>
              </Pressable>
            )}

            {step === 'removeConfirm' && (
              <>
                {!!error && <Text style={styles.errorText}>{error}</Text>}

                <Pressable
                  onPress={handleRemovePin}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    styles.removeConfirmButton,
                    pressed && styles.buttonPressed,
                    isSaving && styles.buttonDisabled,
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Yes, Remove PIN
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setError('');
                    setStep('choose');
                  }}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.securityNote}>
            <Text style={styles.securityNoteTitle}>Secure PIN Storage</Text>

            <Text style={styles.securityNoteText}>
              Your PIN is stored using native secure credential storage. Current
              PIN verification is required before changing or removing an
              existing PIN.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 14,
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 22,
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
  },
  successIconContainer: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#123B2B',
    borderWidth: 1,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },
  removedIconContainer: {
    backgroundColor: '#30251A',
    borderColor: colors.warning,
  },
  successIcon: {
    color: colors.success,
    fontSize: 42,
    fontWeight: '800',
  },
  removedIcon: {
    color: colors.warning,
  },
  successTitle: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  successDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 28,
  },
  successInfo: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
    marginBottom: 25,
  },
  successInfoTitle: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  successInfoText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  backButton: {
    marginTop: 22,
    marginBottom: 20,
  },
  backText: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 20,
  },
  stepLabel: {
    color: colors.primaryLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 7,
  },
  cardDescription: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 22,
  },
  managementOptions: {
    gap: 12,
  },
  managementButton: {
    position: 'relative',
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    paddingRight: 42,
  },
  managementButtonTitle: {
    color: colors.primaryLight,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  managementButtonDescription: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  managementArrow: {
    position: 'absolute',
    right: 15,
    top: 20,
    color: colors.primaryLight,
    fontSize: 20,
  },
  removeOption: {
    borderColor: '#653434',
    backgroundColor: '#281C25',
  },
  removeButtonTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  removeArrow: {
    position: 'absolute',
    right: 15,
    top: 20,
    color: colors.danger,
    fontSize: 20,
  },
  lengthSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  lengthOption: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  lengthOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#1A3456',
  },
  lengthText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  lengthTextSelected: {
    color: colors.primaryLight,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
  },
  pinInput: {
    height: 58,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  pinHint: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
  },
  primaryButton: {
    width: '100%',
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  removeConfirmButton: {
    width: '100%',
    height: 50,
    backgroundColor: colors.danger,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 15,
    marginTop: 5,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  securityNote: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#111D2D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  securityNoteTitle: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  securityNoteText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
});

export default PinSetupScreen;
