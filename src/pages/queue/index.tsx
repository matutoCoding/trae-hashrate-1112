import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, ScrollView, Picker } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import QueueItemComponent from '@/components/QueueItem';
import { getActiveQueueCount, getWaitingCount, getCalledCount } from '@/utils/queue';
import { findContiguousFreeBlocks, generateTimeSlots, mergeTimeSlots, isAdjacentSlot, ContiguousFreeBlock } from '@/utils/schedule';
import type { TimeSlot, Station, RepairOrder } from '@/types';

const QueuePage: React.FC = () => {
  const {
    queue,
    callNextNumber,
    markAsSkipped,
    completeService,
    cancelQueueItem,
    repairOrders,
    stations,
    config,
    assignStationAndStart,
    getStationSchedule
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'waiting' | 'called' | 'history'>('waiting');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningQueueItemId, setAssigningQueueItemId] = useState<string | null>(null);
  const [assignStationId, setAssignStationId] = useState<string>('');
  const [assignDate, setAssignDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [assignSelectedSlots, setAssignSelectedSlots] = useState<string[]>([]);

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

  const availableStations = useMemo(() => {
    return stations.filter((s) => s.status === 'available');
  }, [stations]);

  const assignStationOrders = useMemo((): RepairOrder[] => {
    if (!assignStationId) return [];
    return repairOrders.filter(
      (o) => o.stationId === assignStationId
        && o.status !== 'cancelled'
        && o.scheduleDate === assignDate
    );
  }, [assignStationId, assignDate, repairOrders]);

  const assignAllSlots = useMemo(() => {
    return generateTimeSlots(config, assignDate);
  }, [config, assignDate]);

  const assignSchedule = useMemo(() => {
    if (!assignStationId) return null;
    return getStationSchedule(assignStationId, assignDate);
  }, [assignStationId, assignDate, getStationSchedule]);

  const assignRecommendBlocks = useMemo((): ContiguousFreeBlock[] => {
    if (!assignStationId) return [];
    const blocks = findContiguousFreeBlocks(assignAllSlots, assignStationOrders, assignDate, 1);
    return blocks.slice(0, 5);
  }, [assignStationId, assignAllSlots, assignStationOrders, assignDate]);

  const isAssignMerged = useMemo(() => {
    if (assignSelectedSlots.length < 2) return false;
    const sortedSlots = [...assignSelectedSlots].sort();
    for (let i = 1; i < sortedSlots.length; i++) {
      const prev: TimeSlot = {
        id: '1',
        startTime: sortedSlots[i - 1],
        endTime: (() => {
          const [h, m] = sortedSlots[i - 1].split(':').map(Number);
          const total = h * 60 + m + config.timeSlotDuration;
          return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        })()
      };
      const curr: TimeSlot = {
        id: '2',
        startTime: sortedSlots[i],
        endTime: (() => {
          const [h, m] = sortedSlots[i].split(':').map(Number);
          const total = h * 60 + m + config.timeSlotDuration;
          return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        })()
      };
      if (!isAdjacentSlot(prev, curr, assignDate)) {
        return false;
      }
    }
    return true;
  }, [assignSelectedSlots, config.timeSlotDuration, assignDate]);

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

  const handleOpenAssign = useCallback((queueItemId: string) => {
    setAssigningQueueItemId(queueItemId);
    setAssignStationId(availableStations[0]?.id || '');
    setAssignDate(dayjs().format('YYYY-MM-DD'));
    setAssignSelectedSlots([]);
    setShowAssignModal(true);
  }, [availableStations]);

  const handleCloseAssign = useCallback(() => {
    setShowAssignModal(false);
    setAssigningQueueItemId(null);
    setAssignStationId('');
    setAssignSelectedSlots([]);
  }, []);

  const handleAssignSlotClick = useCallback((startTime: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    setAssignSelectedSlots((prev) => {
      if (prev.includes(startTime)) {
        return prev.filter((t) => t !== startTime);
      }
      return [...prev, startTime].sort();
    });
  }, []);

  const handleAssignRecommendSelect = useCallback((block: ContiguousFreeBlock) => {
    const startTimes = block.slots.map((s) => s.startTime);
    setAssignSelectedSlots(startTimes);
  }, []);

  const handleAssignStationChange = useCallback((e: any) => {
    const idx = e.detail.value;
    setAssignStationId(availableStations[idx]?.id || '');
    setAssignSelectedSlots([]);
  }, [availableStations]);

  const handleAssignDateChange = useCallback((e: any) => {
    setAssignDate(e.detail.value);
    setAssignSelectedSlots([]);
  }, []);

  const handleConfirmAssign = useCallback(() => {
    if (!assigningQueueItemId) return;
    if (!assignStationId) {
      Taro.showToast({ title: '请选择工位', icon: 'none' });
      return;
    }
    if (assignSelectedSlots.length === 0) {
      Taro.showToast({ title: '请选择时段', icon: 'none' });
      return;
    }
    if (!isAssignMerged && assignSelectedSlots.length > 1) {
      Taro.showModal({
        title: '时段不连续',
        content: '您选择的时段不连续，是否继续安排？',
        success: (res) => {
          if (res.confirm) {
            doAssign();
          }
        }
      });
      return;
    }
    doAssign();
  }, [assigningQueueItemId, assignStationId, assignSelectedSlots, isAssignMerged]);

  const doAssign = useCallback(() => {
    if (!assigningQueueItemId) return;
    const station = stations.find((s) => s.id === assignStationId);
    if (!station) return;

    const timeSlots: TimeSlot[] = assignSelectedSlots.map((startTime) => ({
      id: `slot-${Date.now()}-${startTime}`,
      startTime,
      endTime: (() => {
        const [h, m] = startTime.split(':').map(Number);
        const total = h * 60 + m + config.timeSlotDuration;
        return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      })()
    }));

    let mergedSlot: TimeSlot | undefined;
    if (isAssignMerged && timeSlots.length > 1) {
      mergedSlot = mergeTimeSlots(timeSlots, assignDate);
    }

    assignStationAndStart(
      assigningQueueItemId,
      assignStationId,
      station.name,
      assignDate,
      timeSlots,
      mergedSlot
    );

    Taro.showToast({ title: '已安排工位并开始维修', icon: 'success' });
    handleCloseAssign();
  }, [assigningQueueItemId, assignStationId, assignSelectedSlots, assignDate, stations, config.timeSlotDuration, isAssignMerged, assignStationAndStart, handleCloseAssign]);

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

  const assigningQueueItem = useMemo(() => {
    return queue.find((q) => q.id === assigningQueueItemId);
  }, [queue, assigningQueueItemId]);

  const assignSlotClass = (startTime: string, isAvailable: boolean) => {
    if (!isAvailable) return styles.occupied;
    if (assignSelectedSlots.includes(startTime)) {
      return isAssignMerged && assignSelectedSlots.length > 1 ? styles.merged : styles.selected;
    }
    return styles.available;
  };

  const assignEstimatedDuration = assignSelectedSlots.length * config.timeSlotDuration;

  const assignSelectedTimeRange = useMemo(() => {
    if (assignSelectedSlots.length === 0) return '';
    const last = assignSelectedSlots[assignSelectedSlots.length - 1];
    const [h, m] = last.split(':').map(Number);
    const total = h * 60 + m + config.timeSlotDuration;
    const endH = Math.floor(total / 60) % 24;
    const endM = total % 60;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    return `${assignSelectedSlots[0]} - ${endTime}`;
  }, [assignSelectedSlots, config.timeSlotDuration]);

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
              {calledItem.status === 'called' && (
                <Button
                  className={styles.assignBtn}
                  onClick={() => handleOpenAssign(calledItem.id)}
                >
                  安排工位并开始维修
                </Button>
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
              <View key={item.id}>
                <QueueItemComponent
                  item={item}
                  showActions={activeTab !== 'history'}
                  onCall={() => handleCallItem(item.id)}
                  onSkip={() => handleSkip(item.id)}
                  onComplete={() => handleComplete(item.id)}
                  onCancel={() => handleCancel(item.id)}
                />
                {(item.status === 'called') && (
                  <View className={styles.itemActions}>
                    <Button
                      className={styles.itemAssignBtn}
                      onClick={() => handleOpenAssign(item.id)}
                    >
                      安排工位并开始
                    </Button>
                  </View>
                )}
              </View>
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

      {showAssignModal && assigningQueueItem && (
        <View className={styles.assignModal}>
          <View className={styles.assignContent}>
            <View className={styles.assignHeader}>
              <Text className={styles.modalTitle}>安排工位并开始维修</Text>
              <Text className={styles.assignClose} onClick={handleCloseAssign}>✕</Text>
            </View>

            <View className={styles.assignVehicle}>
              <Text className={styles.assignPlate}>{assigningQueueItem.vehicle.plateNumber}</Text>
              <Text className={styles.assignInfo}>
                {assigningQueueItem.vehicle.brand} {assigningQueueItem.vehicle.model} · {assigningQueueItem.serviceType}
              </Text>
              <Text className={styles.assignQueueNo}>
                排队号：{String(assigningQueueItem.queueNumber).padStart(3, '0')}
              </Text>
            </View>

            <ScrollView scrollY className={styles.assignScroll}>
              <View className={styles.assignSection}>
                <Text className={styles.assignLabel}>选择工位</Text>
                {availableStations.length > 0 ? (
                  <Picker
                    mode='selector'
                    range={availableStations.map((s) => `${s.name} · ${s.type}`)}
                    value={availableStations.findIndex((s) => s.id === assignStationId)}
                    onChange={handleAssignStationChange}
                  >
                    <View className={styles.assignPicker}>
                      <Text>
                        {availableStations.find((s) => s.id === assignStationId)?.name || '请选择工位'}
                      </Text>
                      <Text style={{ color: 'var(--color-text-tertiary, #86909C)' }}>›</Text>
                    </View>
                  </Picker>
                ) : (
                  <View className={styles.empty}>暂无可用工位</View>
                )}
              </View>

              <View className={styles.assignSection}>
                <Text className={styles.assignLabel}>预约日期</Text>
                <Picker
                  mode='date'
                  value={assignDate}
                  onChange={handleAssignDateChange}
                >
                  <View className={styles.assignPicker}>
                    <Text>{assignDate}</Text>
                    <Text style={{ color: 'var(--color-text-tertiary, #86909C)' }}>›</Text>
                  </View>
                </Picker>
              </View>

              {assignStationId && assignSchedule && (
                <>
                  {assignRecommendBlocks.length > 0 && (
                    <View className={styles.assignSection}>
                      <Text className={styles.assignLabel}>推荐连续空档</Text>
                      <View className={styles.assignRecommendList}>
                        {assignRecommendBlocks.map((block, idx) => (
                          <View
                            key={`rec-${idx}`}
                            className={styles.assignRecommendItem}
                            onClick={() => handleAssignRecommendSelect(block)}
                          >
                            <Text className={styles.assignRecommendTime}>
                              {block.startTime} - {block.endTime}
                            </Text>
                            <Text className={styles.assignRecommendMeta}>
                              {block.slotCount}段 · {block.duration}分钟
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View className={styles.assignSection}>
                    <Text className={styles.assignLabel}>选择时段</Text>
                    <View className={styles.assignSlotGrid}>
                      {assignSchedule.timeSlots.map((item) => (
                        <View
                          key={item.slot.id}
                          className={classnames(
                            styles.assignSlotItem,
                            assignSlotClass(item.slot.startTime, item.isAvailable)
                          )}
                          onClick={() => handleAssignSlotClick(item.slot.startTime, item.isAvailable)}
                        >
                          {item.slot.startTime}
                        </View>
                      ))}
                    </View>
                  </View>

                  {assignSelectedSlots.length > 0 && (
                    <View className={styles.assignSection}>
                      <View className={styles.assignSummary}>
                        <View className={styles.assignSummaryRow}>
                          <Text>已选时段</Text>
                          <Text className={styles.assignSummaryValue}>
                            {assignSelectedTimeRange}
                            {!isAssignMerged && assignSelectedSlots.length > 1 && ' (不连续)'}
                          </Text>
                        </View>
                        <View className={styles.assignSummaryRow}>
                          <Text>时段数量</Text>
                          <Text className={styles.assignSummaryValue}>
                            {assignSelectedSlots.length} 个 · {assignEstimatedDuration} 分钟
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View className={styles.modalActions}>
              <Button
                className={classnames(styles.modalBtn, styles.cancel)}
                onClick={handleCloseAssign}
              >
                取消
              </Button>
              <Button
                className={classnames(styles.modalBtn, styles.confirm)}
                onClick={handleConfirmAssign}
              >
                确认安排并开始
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default QueuePage;
