import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  variant?: 'default' | 'eyebrow';
};

function SectionHeader({
  title,
  subtitle,
  variant = 'default',
}: SectionHeaderProps) {
  if (variant === 'eyebrow') {
    return <Text style={styles.eyebrow}>{title}</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 5,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 12,
  },
});

export default SectionHeader;
