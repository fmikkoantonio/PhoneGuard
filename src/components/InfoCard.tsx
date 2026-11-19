import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';

type InfoCardProps = {
  title: string;
  description: string;
  icon?: string;
  variant?: 'info' | 'notice';
};

function InfoCard({
  title,
  description,
  icon = 'ⓘ',
  variant = 'info',
}: InfoCardProps) {
  return (
    <View
      style={[styles.container, variant === 'notice' && styles.noticeContainer]}
    >
      <View style={styles.header}>
        <Text style={[styles.icon, variant === 'notice' && styles.noticeIcon]}>
          {icon}
        </Text>

        <Text
          style={[styles.title, variant === 'notice' && styles.noticeTitle]}
        >
          {title}
        </Text>
      </View>

      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#12243A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#294362',
    padding: 16,
  },
  noticeContainer: {
    marginBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  icon: {
    color: colors.cyan,
    fontSize: 19,
    marginRight: 9,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 19,
  },
  noticeIcon: {
    color: colors.cyan,
  },
  noticeTitle: {
    color: colors.cyan,
    fontSize: 10,
    letterSpacing: 1.2,
  },
});

export default InfoCard;
