import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import QueueItemComponent from '@/components/QueueItem';
import { getActiveQueueCount, getWaitingCount, getCalledCount } from '@/utils/queue';

const QueuePage: React.FC = () => {
  const {
    queue,
    callNextNumber,
    markAsSkipped,
    completeService,
    cancelQueueItem,
    repairOrders
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'waiting' | 'called' | 'history'>('waiting');
  const [showAddModal, setShowAddModal] = useState(false);

  const activeCount = useMemo(() => getActiveQueueCount(queue), [queue]);
  const waitingCount = useMemo(() => getWaitingCount(queue), [queue]);
  const calledCount = useMemo(() => getCalledCount(queue), [queue]);

  const calledItem = useMemo(() => {
    return queue.find((item) => item.status === 'called');
  }, [queue]);

  const waitingList = useMemo(() => {
    return queue
      .filter((item) => item.status === 'waiting' || item.status === 'skipped')
      .sort((a, b) => {
        if (a.status === 'skipped' && b.status !== 'skipped') return 1;
        if (b.status === 'skipped' && a.status !== 'skipped') return -1;
        return a.queueNumber - b.queueNumber;
      });
  }, [queue]);

  const calledList = useMemo(() => {
    return queue
      .filter((item) => item.status === 'called' || item.status === 'serving')
      .sort((a, b) => b.queueNumber - a.queueNumber);
  }, [queue]);

  const historyList = useMemo(() => {
    return queue
      .filter((item) => item.status === 'completed' || item.status === 'cancelled')
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
      .slice(0, 20);
  }, [queue]);

  const handleCallNext = useCallback(() => {
    callNextNumber();
    Taro.vibrateShort();
  }, [callNextNumber]);

  const handleSkip = useCallback((queueItemId: string) => {
    markAsSkipped(queueItemId);
  }, [markAsSkipped]);

  const handleComplete = useCallback((queueItemId: string) => {
    completeService(queueItemId);
    const queueItem = queue.find((q) => q.id === queueItemId);
    if (queueItem) {
      const store = useAppStore.getState();
      store.updateRepairOrder(queueItem.repairOrderId, {
        status: 'in_progress',
        actualStartTime: dayjs().toISOString()
      });
    }
  }, [completeService, queue]);

  const handleCancel = useCallback((queueItemId: string) => {
    cancelQueueItem(queueItemId);
  }, [cancelQueueItem]);

  const handleCallItem = useCallback((queueItemId: string) => {
    const item = queue.find((q) => q.id === queueItemId);
    if (item) {
      useAppStore.setState((state) => ({
        queue: state.queue.map((q) =>
          q.id === queueItemId
            ? { ...q, status: 'called', calledAt: dayjs().toISOString() }
            : q
        ),
        currentCallingNumber: item.queueNumber
      }));
      Taro.vibrateShort();
    }
  }, [queue]);

  const handleAddQueue = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const handleQuickAdd = useCallback(() => {
    const pendingRepairs = repairOrders.filter(
      (o) => o.status === 'pending' || o.status === 'queuing'
    );

    if (pendingRepairs.length === 0) {
      Taro.showToast({
        title: '暂无待排队工单',
        icon: 'none'
      });
      return;
    }

    const firstPending = pendingRepairs[0];
    useAppStore.getState().addQueueItem(firstPending.id);
    setShowAddModal(false);
    Taro.showToast({
      title: '已加入排队',
      icon: 'success'
    });
  }, [repairOrders]);

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 500);
  });

  useDidShow(() => {
    console.log('[QueuePage] 页面显示');
  });

  const displayList = activeTab === 'waiting'
    ? waitingList
    : activeTab === 'called'
    ? calledList
    : historyList;

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View className={styles.currentCall}>
          <Text className={styles.callLabel}>当前叫号</Text>
          {calledItem ? (
            <>
              <Text className={styles.currentNumber}>
                {String(calledItem.queueNumber).padStart(3, '0')}
              </Text>
              <Text className={styles.currentVehicle}>
                {calledItem.vehicle.plateNumber} · {calledItem.vehicle.brand} {calledItem.vehicle.model}
              </Text>
              <Text className={styles.currentService}>{calledItem.serviceType}</Text>
              {calledItem.calledAt && (
                <Text className={styles.callTime}>
                  叫号时间: {dayjs(calledItem.calledAt).format('HH:mm:ss')}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text className={styles.currentNumber}>---</Text>
              <Text className={styles.currentVehicle}>暂无叫号</Text>
              <Text className={styles.currentService}>点击下方按钮开始叫号</Text>
            </>
          )}
        </View>

        <View className={styles.stats}>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{activeCount}</Text>
            <Text className={styles.statLabel}>排队总数</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{waitingCount}</Text>
            <Text className={styles.statLabel}>等待中</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{calledCount}</Text>
            <Text className={styles.statLabel}>已叫号</Text>
          </View>
        </View>

        <View className={styles.actions}>
          <Button className={classnames(styles.actionBtn, styles.primary)} onClick={handleCallNext}>
            叫下一号
          </Button>
          <Button className={classnames(styles.actionBtn, styles.secondary)} onClick={handleAddQueue}>
            取号排队
          </Button>
        </View>
      </View>

      <View className={styles.content}>
        <View className={styles.tabs}>
          <View
            className={classnames(styles.tabItem, { [styles.active]: activeTab === 'waiting' })}
            onClick={() => setActiveTab('waiting')}
          >
            等待队列
          </View>
          <View
            className={classnames(styles.tabItem, { [styles.active]: activeTab === 'called' })}
            onClick={() => setActiveTab('called')}
          >
            已叫号
          </View>
          <View
            className={classnames(styles.tabItem, { [styles.active]: activeTab === 'history' })}
            onClick={() => setActiveTab('history')}
          >
            历史记录
          </View>
        </View>

        <View className={styles.sectionTitle}>
          <Text className={styles.titleText}>
            {activeTab === 'waiting' ? '等待队列' : activeTab === 'called' ? '已叫号' : '历史记录'}
          </Text>
          <Text className={styles.countBadge}>
            {displayList.length} 条
          </Text>
        </View>

        <ScrollView scrollY>
          {displayList.length === 0 ? (
            <View className={styles.empty}>
              <Text>暂无数据</Text>
            </View>
          ) : (
            displayList.map((item) => (
              <QueueItemComponent
                key={item.id}
                item={item}
                showActions={activeTab !== 'history'}
                onCall={() => handleCallItem(item.id)}
                onSkip={() => handleSkip(item.id)}
                onComplete={() => handleComplete(item.id)}
                onCancel={() => handleCancel(item.id)}
              />
            ))
          )}
        </ScrollView>
      </View>

      <Button className={styles.floatingBtn} onClick={handleAddQueue}>
        +
      </Button>

      {showAddModal && (
        <View className={styles.addModal}>
          <View className={styles.modalContent}>
            <Text className={styles.modalTitle}>添加排队</Text>
            <Text style={{ textAlign: 'center', color: 'var(--color-text-secondary, #4E5969)', fontSize: '28rpx', marginBottom: '32rpx' }}>
              将待排期的工单添加到排队队列？
            </Text>
            <View className={styles.modalActions}>
              <Button
                className={classnames(styles.modalBtn, styles.cancel)}
                onClick={() => setShowAddModal(false)}
              >
                取消
              </Button>
              <Button
                className={classnames(styles.modalBtn, styles.confirm)}
                onClick={handleQuickAdd}
              >
                确认添加
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default QueuePage;
