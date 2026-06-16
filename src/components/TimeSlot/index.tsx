import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import type { RepairOrder } from '@/types';

interface TimeSlotProps {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isMerged?: boolean;
  repairOrder?: RepairOrder;
  stationStatus?: string;
  selected?: boolean;
  onClick?: () => void;
}

const TimeSlotComponent: React.FC<TimeSlotProps> = ({
  startTime,
  endTime,
  isAvailable,
  isMerged = false,
  repairOrder,
  stationStatus = 'available',
  selected = false,
  onClick
}) => {
  const slotClass = classnames(styles.slot, {
    [styles.available]: isAvailable && stationStatus === 'available',
    [styles.occupied]: !isAvailable && stationStatus === 'available',
    [styles.merged]: isMerged,
    [styles.maintenance]: stationStatus === 'maintenance',
    [styles.selected]: selected
  });

  return (
    <View className={slotClass} onClick={onClick}>
      {isAvailable && stationStatus === 'available' && (
        <View className={classnames(styles.statusDot, styles.available)} />
      )}
      {!isAvailable && stationStatus === 'available' && (
        <View className={classnames(styles.statusDot, styles.occupied)} />
      )}

      <Text className={styles.time}>{startTime} - {endTime}</Text>

      {repairOrder && (
        <View className={styles.content}>
          <View style={{ display: 'flex', alignItems: 'center' }}>
            <Text className={styles.vehicle}>
              {repairOrder.vehicle.plateNumber} · {repairOrder.vehicle.brand} {repairOrder.vehicle.model}
            </Text>
            {isMerged && (
              <Text className={styles.mergedTag}>已合并</Text>
            )}
          </View>
          <Text className={styles.service}>{repairOrder.serviceType}</Text>
        </View>
      )}

      {isAvailable && stationStatus === 'available' && !repairOrder && (
        <View className={styles.content}>
          <Text className={styles.vehicle} style={{ color: 'var(--color-success, #52C41A)' }}>空闲可预约</Text>
        </View>
      )}

      {stationStatus === 'maintenance' && (
        <View className={styles.content}>
          <Text className={styles.vehicle} style={{ color: 'var(--color-warning, #FAAD14)' }}>设备维护中</Text>
        </View>
      )}
    </View>
  );
};

export default TimeSlotComponent;
