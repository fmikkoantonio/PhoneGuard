import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import colors from '../theme/colors';

type SettingRowProps = {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

function SettingRow({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
}: SettingRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>

        {description ? (
          <Text style={styles.description}>{description}</Text>
        ) : null}
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.border,
          true: colors.primary,
        }}
        thumbColor={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  textContainer: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
});

export default SettingRow;
