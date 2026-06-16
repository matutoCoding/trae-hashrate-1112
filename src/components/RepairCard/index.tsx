import React from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import type { RepairOrder } from '@/types';
import StatusTag from '@/components/StatusTag';
import { formatTimeDisplay } from '@/utils/schedule';

interface RepairCardProps {
  repair: RepairOrder;
  showTime?: boolean;
  onClick?: () => void;
}

const RepairCard: React.FC<RepairCardProps> = ({ repair, showTime = true, onClick }) => {
  const displaySlot = repair.mergedSlot || repair.timeSlots[0];
  const totalPartsAmount = repair.parts.reduce((sum, p) => sum + p.price * p.quantity, 0);

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    Taro.navigateTo({
      url: `/pages/repair-detail/index?id=${repair.id}`
    });
  };

  return (
    <View className={styles.card} onClick={handleClick}>
      <View className={styles.header}>
        <View style={{ display: 'flex', alignItems: 'center' }}>
          <Text className={styles.orderNumber}>{repair.orderNumber}</Text>
          {repair.mergedSlot && (
            <Text className={styles.mergedBadge}>时段已合并</Text>
          )}
        </View>
        <StatusTag status={repair.status} />
      </View>

      <View className={styles.vehicleInfo}>
        <Text className={styles.plate}>{repair.vehicle.plateNumber}</Text>
        <View className={styles.vehicleDetail}>
          <Text className={styles.brandModel}>
            {repair.vehicle.brand} {repair.vehicle.model} · {repair.vehicle.color}
          </Text>
          <Text className={styles.owner}>
            {repair.vehicle.ownerName} {repair.vehicle.ownerPhone}
          </Text>
        </View>
      </View>

      <View className={styles.serviceInfo}>
        <Text className={styles.serviceType}>{repair.serviceType}</Text>
        <Text className={styles.description}>{repair.description}</Text>
      </View>

      {showTime && displaySlot && (
        <View className={styles.timeInfo}>
          <Text className={styles.timeSlot}>
            {formatTimeDisplay(displaySlot.startTime, displaySlot.endTime)}
          </Text>
          <Text className={styles.duration}>预计 {repair.estimatedDuration} 分钟</Text>
        </View>
      )}

      {repair.parts.length > 0 && (
        <View className={styles.partsInfo}>
          <Text className={styles.partsCount}>已领用 {repair.parts.length} 项配件</Text>
          <Text className={styles.partsAmount}>¥{totalPartsAmount.toFixed(2)}</Text>
        </View>
      )}
    </View>
  );
};

export default RepairCard;
