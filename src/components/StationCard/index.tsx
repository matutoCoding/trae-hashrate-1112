import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import type { Station } from '@/types';
import StatusTag from '@/components/StatusTag';
import useAppStore from '@/store/useAppStore';

interface StationCardProps {
  station: Station;
  date: string;
  onClick?: () => void;
}

const StationCard: React.FC<StationCardProps> = ({ station, date, onClick }) => {
  const getStationSchedule = useAppStore((state) => state.getStationSchedule);
  const schedule = getStationSchedule(station.id, date);

  const occupiedCount = schedule.timeSlots.filter((s) => !s.isAvailable).length;
  const availableCount = schedule.timeSlots.filter((s) => s.isAvailable).length;
  const mergedCount = schedule.timeSlots.filter((s) => s.isMerged).length;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    Taro.navigateTo({
      url: `/pages/station-detail/index?id=${station.id}`
    });
  };

  return (
    <View className={styles.card} onClick={handleClick}>
      <View className={styles.header}>
        <View className={styles.info}>
          <View style={{ display: 'flex', alignItems: 'center' }}>
            <Text className={styles.name}>{station.name}</Text>
            {mergedCount > 0 && (
              <Text className={styles.mergedBadge}>{mergedCount}个合并时段</Text>
            )}
          </View>
          <Text className={styles.number}>{station.number} · {station.type}</Text>
          <Text className={styles.type}>载重: {station.capacity}kg</Text>
        </View>
        <StatusTag status={station.status} />
      </View>

      <View className={styles.stats}>
        <View className={styles.statItem}>
          <Text className={styles.statValue}>{availableCount}</Text>
          <Text className={styles.statLabel}>空闲时段</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue} style={{ color: 'var(--color-warning, #FAAD14)' }}>{occupiedCount}</Text>
          <Text className={styles.statLabel}>占用时段</Text>
        </View>
        <View className={styles.statItem}>
          <Text className={styles.statValue} style={{ color: 'var(--color-success, #52C41A)' }}>{schedule.timeSlots.length}</Text>
          <Text className={styles.statLabel}>总时段</Text>
        </View>
      </View>

      {station.description && (
        <Text className={styles.description}>{station.description}</Text>
      )}
    </View>
  );
};

export default StationCard;
