import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import type { QueueItem } from '@/types';
import StatusTag from '@/components/StatusTag';
import { formatWaitTime } from '@/utils/queue';
import dayjs from 'dayjs';

interface QueueItemComponentProps {
  item: QueueItem;
  onCall?: () => void;
  onSkip?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

const QueueItemComponent: React.FC<QueueItemComponentProps> = ({
  item,
  onCall,
  onSkip,
  onComplete,
  onCancel,
  showActions = true
}) => {
  const itemClass = classnames(styles.item, {
    [styles.called]: item.status === 'called',
    [styles.skipped]: item.status === 'skipped'
  });

  const badgeClass = classnames(styles.numberBadge, styles[item.status]);

  const handleCall = () => {
    onCall?.();
  };

  const handleSkip = () => {
    Taro.showModal({
      title: '确认过号',
      content: `确定将 ${item.vehicle.plateNumber} 标记为过号吗？过号${item.skipCount + 1 >= item.maxSkipCount ? '后将自动作废' : '后重排队尾'}`,
      confirmText: '确认过号',
      confirmColor: '#FAAD14',
      success: (res) => {
        if (res.confirm) {
          onSkip?.();
        }
      }
    });
  };

  const handleComplete = () => {
    onComplete?.();
  };

  const handleCancel = () => {
    Taro.showModal({
      title: '确认取消',
      content: `确定取消 ${item.vehicle.plateNumber} 的排队吗？`,
      confirmText: '确认取消',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          onCancel?.();
        }
      }
    });
  };

  return (
    <View className={itemClass}>
      <View className={styles.header}>
        <View className={styles.queueNumber}>
          <View className={badgeClass}>
            <Text>{item.queueNumber}</Text>
          </View>
          <View className={styles.vehicleInfo}>
            <Text className={styles.plate}>{item.vehicle.plateNumber}</Text>
            <Text className={styles.service}>
              {item.vehicle.brand} {item.vehicle.model} · {item.serviceType}
            </Text>
          </View>
        </View>
        <StatusTag status={item.status} />
      </View>

      <View className={styles.meta}>
        <View className={styles.metaItem}>
          <Text>车主: {item.vehicle.ownerName}</Text>
        </View>
        {item.status === 'waiting' && item.estimatedWaitTime > 0 && (
          <View className={styles.metaItem}>
            <Text>预计等待: {formatWaitTime(item.estimatedWaitTime)}</Text>
          </View>
        )}
        {item.calledAt && (
          <View className={styles.metaItem}>
            <Text>叫号时间: {dayjs(item.calledAt).format('HH:mm')}</Text>
          </View>
        )}
        {item.skipCount > 0 && (
          <View className={classnames(styles.metaItem, styles.skipWarning)}>
            <Text>已过号 {item.skipCount}/{item.maxSkipCount} 次</Text>
          </View>
        )}
      </View>

      {showActions && (item.status === 'called' || item.status === 'waiting' || item.status === 'skipped') && (
        <View className={styles.actions}>
          {item.status === 'called' && (
            <>
              <Button className={classnames(styles.btn, styles.success)} onClick={handleComplete}>
                开始维修
              </Button>
              <Button className={classnames(styles.btn, styles.warning)} onClick={handleSkip}>
                过号处理
              </Button>
            </>
          )}
          {item.status === 'waiting' && (
            <>
              <Button className={classnames(styles.btn, styles.primary)} onClick={handleCall}>
                立即叫号
              </Button>
              <Button className={classnames(styles.btn, styles.danger)} onClick={handleCancel}>
                取消排队
              </Button>
            </>
          )}
          {item.status === 'skipped' && (
            <>
              <Button className={classnames(styles.btn, styles.primary)} onClick={handleCall}>
                重新叫号
              </Button>
              <Button className={classnames(styles.btn, styles.danger)} onClick={handleCancel}>
                取消排队
              </Button>
            </>
          )}
        </View>
      )}
    </View>
  );
};

export default QueueItemComponent;
