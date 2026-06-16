import dayjs from 'dayjs';
import type { QueueItem, RepairOrder, AppConfig } from '@/types';

export const generateQueueNumber = (existingQueue: QueueItem[], date: string): number => {
  const todayQueue = existingQueue.filter((item) =>
    dayjs(item.createdAt).isSame(date, 'day')
  );

  if (todayQueue.length === 0) {
    return 1;
  }

  const maxNumber = Math.max(...todayQueue.map((item) => item.queueNumber));
  return maxNumber + 1;
};

export const createQueueItem = (
  repairOrder: RepairOrder,
  existingQueue: QueueItem[],
  config: AppConfig
): QueueItem => {
  const today = dayjs().format('YYYY-MM-DD');
  const queueNumber = generateQueueNumber(existingQueue, today);
  const waitingCount = existingQueue.filter(
    (item) => item.status === 'waiting' || item.status === 'skipped'
  ).length;

  return {
    id: `queue-${Date.now()}`,
    repairOrderId: repairOrder.id,
    orderNumber: repairOrder.orderNumber,
    vehicle: repairOrder.vehicle,
    queueNumber,
    status: 'waiting',
    skipCount: 0,
    maxSkipCount: config.maxSkipCount,
    estimatedWaitTime: waitingCount * 30,
    serviceType: repairOrder.serviceType,
    createdAt: dayjs().toISOString()
  };
};

export const handleSkip = (queueItem: QueueItem, config: AppConfig): QueueItem => {
  const newSkipCount = queueItem.skipCount + 1;

  if (newSkipCount >= config.maxSkipCount) {
    return {
      ...queueItem,
      status: 'cancelled',
      skipCount: newSkipCount
    };
  }

  return {
    ...queueItem,
    status: 'skipped',
    skipCount: newSkipCount,
    calledAt: undefined
  };
};

export const reorderSkippedItems = (queue: QueueItem[]): QueueItem[] => {
  const skippedItems = queue.filter((item) => item.status === 'skipped');
  const otherItems = queue.filter((item) => item.status !== 'skipped');

  skippedItems.forEach((item) => {
    item.estimatedWaitTime =
      otherItems.filter((o) => o.status === 'waiting').length * 30;
  });

  return [...otherItems, ...skippedItems];
};

export const getNextCallNumber = (queue: QueueItem[]): QueueItem | null => {
  const waitingItems = queue
    .filter((item) => item.status === 'waiting' || item.status === 'skipped')
    .sort((a, b) => {
      if (a.status === 'skipped' && b.status !== 'skipped') return 1;
      if (b.status === 'skipped' && a.status !== 'skipped') return -1;
      return a.queueNumber - b.queueNumber;
    });

  return waitingItems.length > 0 ? waitingItems[0] : null;
};

export const getQueueStatusText = (status: QueueItem['status']): string => {
  const statusMap: Record<QueueItem['status'], string> = {
    waiting: '等待中',
    called: '已叫号',
    skipped: '已过号',
    serving: '维修中',
    completed: '已完成',
    cancelled: '已作废'
  };
  return statusMap[status];
};

export const getQueueStatusColor = (status: QueueItem['status']): string => {
  const colorMap: Record<QueueItem['status'], string> = {
    waiting: '#FA8C16',
    called: '#1677FF',
    skipped: '#FAAD14',
    serving: '#52C41A',
    completed: '#86909C',
    cancelled: '#FF4D4F'
  };
  return colorMap[status];
};

export const getActiveQueueCount = (queue: QueueItem[]): number => {
  return queue.filter(
    (item) => item.status === 'waiting' || item.status === 'skipped' || item.status === 'called'
  ).length;
};

export const getWaitingCount = (queue: QueueItem[]): number => {
  return queue.filter((item) => item.status === 'waiting').length;
};

export const getCalledCount = (queue: QueueItem[]): number => {
  return queue.filter((item) => item.status === 'called').length;
};

export const formatWaitTime = (minutes: number): string => {
  if (minutes < 60) {
    return `约 ${minutes} 分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `约 ${hours} 小时 ${mins} 分钟` : `约 ${hours} 小时`;
};
