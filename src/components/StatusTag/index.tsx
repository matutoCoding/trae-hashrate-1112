import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';

interface StatusTagProps {
  status: string;
  text?: string;
  className?: string;
}

const statusTextMap: Record<string, string> = {
  waiting: '等待中',
  called: '已叫号',
  skipped: '已过号',
  serving: '维修中',
  completed: '已完成',
  cancelled: '已作废',
  available: '空闲',
  occupied: '占用中',
  maintenance: '维护中',
  in_progress: '维修中',
  pending: '待排期',
  queuing: '排队中'
};

const StatusTag: React.FC<StatusTagProps> = ({ status, text, className }) => {
  const statusClass = status.replace(/_/g, '');
  const displayText = text || statusTextMap[status] || status;

  return (
    <View className={classnames(styles.tag, styles[statusClass], className)}>
      <Text>{displayText}</Text>
    </View>
  );
};

export default StatusTag;
