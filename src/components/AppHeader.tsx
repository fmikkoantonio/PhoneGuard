import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import colors from '../theme/colors';

type AppHeaderProps = {
  title: string;
  subtitle: string;
  variant?: 'brand' | 'screen';
};

function AppHeader({ title, subtitle }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={[styles.title]}>{title}</Text>

        <Text style={[styles.subtitle]}>{subtitle}</Text>
      </View>

      <View style={styles.previewBadge}>
        <View style={styles.previewDot} />

        <Text style={styles.previewText}>UI PREVIEW</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  title: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 2,
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 4,
  },

  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },

  previewDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.warning,
    marginRight: 7,
  },

  previewText: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default AppHeader;
