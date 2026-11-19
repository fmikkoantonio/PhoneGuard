import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import colors from '../theme/colors';

type SettingsCardProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

function SettingsCard({ children, style }: SettingsCardProps) {
  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 17,
    marginBottom: 26,
  },
});

export default SettingsCard;
