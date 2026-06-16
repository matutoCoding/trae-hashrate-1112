import React, { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import dayjs from 'dayjs';
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
  onDelay?: (repairOrder: RepairOrder) => void;
  onEarlyEnd?: (repairOrder: RepairOrder) => void;
  onTransfer?: (repairOrder: RepairOrder) => void;
}

const TimeSlotComponent: React.FC<TimeSlotProps> = ({
  startTime,
  endTime,
  isAvailable,
  isMerged = false,
  repairOrder,
  stationStatus = 'available',
  selected = false,
  onClick,
  onDelay,
  onEarlyEnd,
  onTransfer
}) => {
  const [now, setNow] = useState(dayjs());

  useEffect(() => {
    if (repairOrder?.status !== 'in_progress' || !repairOrder.actualStartTime) return;
    const timer = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(timer);
  }, [repairOrder?.status, repairOrder?.actualStartTime]);

  const isInProgress = repairOrder?.status === 'in_progress' && !!repairOrder.actualStartTime;
  let elapsedMinutes = 0;
  let remainingMinutes = 0;
  let progressPercent = 0;
  let overtimeMinutes = 0;

  if (isInProgress && repairOrder!.actualStartTime) {
    const elapsed = now.diff(dayjs(repairOrder!.actualStartTime), 'minute');
    const estimatedDuration = repairOrder!.estimatedDuration;
    elapsedMinutes = elapsed;
    remainingMinutes = estimatedDuration - elapsed;
    overtimeMinutes = Math.abs(remainingMinutes);
    progressPercent = Math.min((elapsed / estimatedDuration) * 100, 100);
  }

  const slotClass = classnames(styles.slot, {
    [styles.available]: isAvailable && stationStatus === 'available',
    [styles.occupied]: !isAvailable && stationStatus === 'available',
    [styles.merged]: isMerged,
    [styles.maintenance]: stationStatus === 'maintenance',
    [styles.selected]: selected,
    [styles.inProgress]: isInProgress,
    [styles.overtime]: isInProgress && remainingMinutes < 0
  });

  const formatMinutes = (mins: number) => {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
    }
    return `${mins}分钟`;
  };

  return (
    <View className={slotClass} onClick={onClick}>
      {isAvailable && stationStatus === 'available' && (
        <View className={classnames(styles.statusDot, styles.available)} />
      )}
      {!isAvailable && stationStatus === 'available' && !isInProgress && (
        <View className={classnames(styles.statusDot, styles.occupied)} />
      )}
      {isInProgress && (
        <View className={classnames(styles.statusDot, styles.inProgress)} />
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

          {isInProgress && (
            <View className={styles.progressSection}>
              <View className={styles.progressInfo}>
                {remainingMinutes >= 0 ? (
                  <>
                    <Text className={styles.elapsed}>已进行 {formatMinutes(elapsedMinutes)}</Text>
                    <Text className={styles.remaining}>预计剩余 {formatMinutes(remainingMinutes)}</Text>
                  </>
                ) : (
                  <Text className={styles.overtimeText}>⚠️ 超时 {formatMinutes(overtimeMinutes)}</Text>
                )}
              </View>
              <View className={styles.progressBar}>
                <View
                  className={classnames(styles.progressFill, {
                    [styles.progressFillOvertime]: remainingMinutes < 0
                  })}
                  style={{ width: `${progressPercent}%` }}
                />
              </View>
              <View className={styles.actions}>
                {onDelay && (
                  <View className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); onDelay(repairOrder); }}>
                    <Text className={styles.actionBtnText}>延时</Text>
                  </View>
                )}
                {onEarlyEnd && (
                  <View className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); onEarlyEnd(repairOrder); }}>
                    <Text className={styles.actionBtnText}>提前结束</Text>
                  </View>
                )}
                {onTransfer && (
                  <View className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); onTransfer(repairOrder); }}>
                    <Text className={styles.actionBtnText}>转移工位</Text>
                  </View>
                )}
              </View>
            </View>
          )}
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
