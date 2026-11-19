import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';

type OptionSelectorProps<T extends string> = {
  label: string;
  description?: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
};

function OptionSelector<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: OptionSelectorProps<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}

      <View style={styles.optionsContainer}>
        {options.map(option => {
          const selected = value === option;

          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.optionButton,
                selected && styles.selectedOption,
                pressed && styles.pressedOption,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  selected && styles.selectedOptionText,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 7,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 15,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedOption: {
    backgroundColor: '#1D3D68',
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  selectedOptionText: {
    color: colors.primaryLight,
  },
  pressedOption: {
    opacity: 0.7,
  },
});

export default OptionSelector;
