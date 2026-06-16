import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, ScrollView, Picker, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import StationCard from '@/components/StationCard';
import TimeSlotComponent from '@/components/TimeSlot';
import { findContiguousFreeBlocks, generateTimeSlots, mergeTimeSlots, isAdjacentSlot, ContiguousFreeBlock, getSlotConflicts } from '@/utils/schedule';
import type { TimeSlot, RepairOrder } from '@/types';

type ViewMode = 'day' | 'week';
type StationTypeFilter = 'all' | string;
type AvailabilityFilter = 'all' | 'busy' | 'free';

const SchedulePage: React.FC = () => {
  const {
    stations,
    selectedDate,
    setSelectedDate,
    getStationSchedule,
    repairOrders,
    config,
    delayRepairOrder,
    transferRepairOrder,
    splitTimeSlot,
    insertUrgentOrder
  } = useAppStore();

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [pickerValue, setPickerValue] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [weekStartDate, setWeekStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [stationTypeFilter, setStationTypeFilter] = useState<StationTypeFilter>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');

  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayOrderId, setDelayOrderId] = useState<string>('');
  const [delayMinutes, setDelayMinutes] = useState('30');

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferOrder, setTransferOrder] = useState<RepairOrder | null>(null);
  const [transferStationId, setTransferStationId] = useState('');
  const [transferDate, setTransferDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [transferSelectedSlots, setTransferSelectedSlots] = useState<string[]>([]);

  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [urgentStationId, setUrgentStationId] = useState('');
  const [urgentDate, setUrgentDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [urgentSelectedSlots, setUrgentSelectedSlots] = useState<string[]>([]);
  const [urgentForm, setUrgentForm] = useState({
    plateNumber: '',
    brand: '',
    model: '',
    color: '白色',
    ownerName: '',
    ownerPhone: '',
    serviceType: '急修',
    description: '',
    stationId: '',
    stationName: '',
    estimatedDuration: 60,
    createdBy: '管理员'
  });

  const weekDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(dayjs(weekStartDate).add(i, 'day').format('YYYY-MM-DD'));
    }
    return dates;
  }, [weekStartDate]);

  const weekDayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  const quickDates = useMemo(() => {
    return [
      { label: '今天', value: dayjs().format('YYYY-MM-DD') },
      { label: '明天', value: dayjs().add(1, 'day').format('YYYY-MM-DD') },
      { label: '后天', value: dayjs().add(2, 'day').format('YYYY-MM-DD') },
      { label: '本周', value: dayjs().add(3, 'day').format('YYYY-MM-DD') }
    ];
  }, []);

  const dateRange = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 30; i++) {
      dates.push(dayjs().add(i, 'day').format('YYYY-MM-DD'));
    }
    return dates;
  }, []);

  const stationTypes = useMemo(() => {
    const types = new Set(stations.map((s) => s.type));
    return ['all', ...Array.from(types)];
  }, [stations]);

  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      if (stationTypeFilter !== 'all' && station.type !== stationTypeFilter) return false;
      if (availabilityFilter !== 'all') {
        const schedule = getStationSchedule(station.id, selectedDate);
        const totalSlots = schedule.timeSlots.length;
        const availableSlots = schedule.timeSlots.filter((s) => s.isAvailable).length;
        const occupancyRate = totalSlots > 0 ? availableSlots / totalSlots : 1;
        if (availabilityFilter === 'busy' && occupancyRate > 0.5) return false;
        if (availabilityFilter === 'free' && occupancyRate <= 0.5) return false;
      }
      return true;
    });
  }, [stations, stationTypeFilter, availabilityFilter, selectedDate, getStationSchedule]);

  const filteredWeekStations = useMemo(() => {
    return stations.filter((station) => {
      if (stationTypeFilter !== 'all' && station.type !== stationTypeFilter) return false;
      return true;
    });
  }, [stations, stationTypeFilter]);

  const dailyStats = useMemo(() => {
    let totalOccupied = 0;
    let totalAvailable = 0;
    let totalMerged = 0;

    filteredStations.forEach((station) => {
      if (station.status !== 'maintenance') {
        const schedule = getStationSchedule(station.id, selectedDate);
        schedule.timeSlots.forEach((slot) => {
          if (slot.isAvailable) {
            totalAvailable++;
          } else {
            totalOccupied++;
          }
          if (slot.isMerged) {
            totalMerged++;
          }
        });
      }
    });

    const activeStations = filteredStations.filter((s) => s.status === 'available').length;

    return { totalOccupied, totalAvailable, totalMerged, activeStations };
  }, [filteredStations, selectedDate, getStationSchedule]);

  const selectedSchedule = useMemo(() => {
    if (!selectedStationId) return null;
    return getStationSchedule(selectedStationId, selectedDate);
  }, [selectedStationId, selectedDate, getStationSchedule]);

  const selectedStation = useMemo(() => {
    return stations.find((s) => s.id === selectedStationId);
  }, [stations, selectedStationId]);

  const weekStats = useMemo(() => {
    const result: Record<string, Record<string, {
      total: number;
      occupied: number;
      available: number;
      merged: number;
      isMaintenance: boolean;
    }>> = {};

    filteredWeekStations.forEach((station) => {
      result[station.id] = {};
      weekDates.forEach((date) => {
        const schedule = getStationSchedule(station.id, date);
        let occupied = 0;
        let available = 0;
        let merged = 0;

        schedule.timeSlots.forEach((slot) => {
          if (slot.isAvailable) {
            available++;
          } else {
            occupied++;
          }
          if (slot.isMerged) {
            merged++;
          }
        });

        result[station.id][date] = {
          total: schedule.timeSlots.length,
          occupied,
          available,
          merged,
          isMaintenance: station.status === 'maintenance'
        };
      });
    });

    return result;
  }, [filteredWeekStations, weekDates, getStationSchedule]);

  const handlePrevWeek = useCallback(() => {
    setWeekStartDate(dayjs(weekStartDate).subtract(7, 'day').format('YYYY-MM-DD'));
  }, [weekStartDate]);

  const handleNextWeek = useCallback(() => {
    setWeekStartDate(dayjs(weekStartDate).add(7, 'day').format('YYYY-MM-DD'));
  }, [weekStartDate]);

  const handleWeekCellClick = useCallback((stationId: string, date: string) => {
    setSelectedStationId(stationId);
    setSelectedDate(date);
    setViewMode('day');
    const idx = dateRange.findIndex((d) => d === date);
    if (idx >= 0) setPickerValue(idx);
  }, [setSelectedDate, dateRange]);

  const handleWeekCellAdd = useCallback((stationId: string, date: string) => {
    Taro.navigateTo({
      url: `/pages/repair-create/index?stationId=${stationId}&date=${date}`
    });
  }, []);

  const handleDateChange = useCallback((e: any) => {
    const index = e.detail.value;
    setPickerValue(index);
    setSelectedDate(dateRange[index]);
  }, [dateRange, setSelectedDate]);

  const handlePrevDay = useCallback(() => {
    const newDate = dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD');
    if (dayjs(newDate).isAfter(dayjs().subtract(1, 'day'))) {
      setSelectedDate(newDate);
      const idx = dateRange.findIndex((d) => d === newDate);
      if (idx >= 0) setPickerValue(idx);
    }
  }, [selectedDate, dateRange, setSelectedDate]);

  const handleNextDay = useCallback(() => {
    const newDate = dayjs(selectedDate).add(1, 'day').format('YYYY-MM-DD');
    setSelectedDate(newDate);
    const idx = dateRange.findIndex((d) => d === newDate);
    if (idx >= 0) setPickerValue(idx);
  }, [selectedDate, dateRange, setSelectedDate]);

  const handleQuickDate = useCallback((date: string) => {
    setSelectedDate(date);
    const idx = dateRange.findIndex((d) => d === date);
    if (idx >= 0) setPickerValue(idx);
  }, [dateRange, setSelectedDate]);

  const handleAddRepair = useCallback(() => {
    Taro.navigateTo({
      url: '/pages/repair-create/index'
    });
  }, []);

  const handleSlotClick = useCallback((slot: any) => {
    if (slot.isAvailable && selectedStation?.status === 'available') {
      Taro.navigateTo({
        url: `/pages/repair-create/index?stationId=${selectedStationId}&date=${selectedDate}&startTime=${slot.slot.startTime}`
      });
    } else if (slot.repairOrder) {
      const orderId = slot.repairOrder.id.replace('merged-', '');
      Taro.navigateTo({
        url: `/pages/repair-detail/index?id=${orderId}`
      });
    }
  }, [selectedStation, selectedStationId, selectedDate]);

  const handleDelay = useCallback((repairOrder: RepairOrder) => {
    setDelayOrderId(repairOrder.id);
    setDelayMinutes('30');
    setShowDelayModal(true);
  }, []);

  const handleConfirmDelay = useCallback(() => {
    const mins = parseInt(delayMinutes, 10);
    if (!mins || mins <= 0) {
      Taro.showToast({ title: '请输入有效延时分钟数', icon: 'none' });
      return;
    }
    delayRepairOrder(delayOrderId, mins);
    setShowDelayModal(false);
    Taro.showToast({ title: `已延时${mins}分钟`, icon: 'success' });
  }, [delayOrderId, delayMinutes, delayRepairOrder]);

  const handleEarlyEnd = useCallback((repairOrder: RepairOrder) => {
    Taro.navigateTo({
      url: `/pages/repair-detail/index?id=${repairOrder.id}`
    });
  }, []);

  const handleTransfer = useCallback((repairOrder: RepairOrder) => {
    setTransferOrder(repairOrder);
    const availableStations = stations.filter((s) => s.status === 'available' && s.id !== repairOrder.stationId);
    setTransferStationId(availableStations[0]?.id || '');
    setTransferDate(repairOrder.scheduleDate || dayjs().format('YYYY-MM-DD'));
    setTransferSelectedSlots([]);
    setShowTransferModal(true);
  }, [stations]);

  const transferAvailableStations = useMemo(() => {
    if (!transferOrder) return [];
    return stations.filter((s) => s.status === 'available' && s.id !== transferOrder.stationId);
  }, [stations, transferOrder]);

  const transferSchedule = useMemo(() => {
    if (!transferStationId) return null;
    return getStationSchedule(transferStationId, transferDate);
  }, [transferStationId, transferDate, getStationSchedule]);

  const transferStationOrders = useMemo((): RepairOrder[] => {
    if (!transferStationId) return [];
    return repairOrders.filter(
      (o) => o.stationId === transferStationId && o.status !== 'cancelled' && o.scheduleDate === transferDate
    );
  }, [transferStationId, transferDate, repairOrders]);

  const transferAllSlots = useMemo(() => {
    return generateTimeSlots(config, transferDate);
  }, [config, transferDate]);

  const transferRecommendBlocks = useMemo((): ContiguousFreeBlock[] => {
    if (!transferStationId) return [];
    const blocks = findContiguousFreeBlocks(transferAllSlots, transferStationOrders, transferDate, 1);
    return blocks.slice(0, 5);
  }, [transferStationId, transferAllSlots, transferStationOrders, transferDate]);

  const isTransferMerged = useMemo(() => {
    if (transferSelectedSlots.length < 2) return true;
    const sortedSlots = [...transferSelectedSlots].sort();
    for (let i = 1; i < sortedSlots.length; i++) {
      const prev: TimeSlot = {
        id: '1', startTime: sortedSlots[i - 1],
        endTime: (() => {
          const [h, m] = sortedSlots[i - 1].split(':').map(Number);
          const total = h * 60 + m + config.timeSlotDuration;
          return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        })()
      };
      const curr: TimeSlot = {
        id: '2', startTime: sortedSlots[i],
        endTime: (() => {
          const [h, m] = sortedSlots[i].split(':').map(Number);
          const total = h * 60 + m + config.timeSlotDuration;
          return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        })()
      };
      if (!isAdjacentSlot(prev, curr, transferDate)) return false;
    }
    return true;
  }, [transferSelectedSlots, config.timeSlotDuration, transferDate]);

  const handleTransferSlotClick = useCallback((startTime: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    setTransferSelectedSlots((prev) => {
      if (prev.includes(startTime)) return prev.filter((t) => t !== startTime);
      return [...prev, startTime].sort();
    });
  }, []);

  const handleTransferStationChange = useCallback((e: any) => {
    const idx = e.detail.value;
    setTransferStationId(transferAvailableStations[idx]?.id || '');
    setTransferSelectedSlots([]);
  }, [transferAvailableStations]);

  const handleConfirmTransfer = useCallback(() => {
    if (!transferOrder || !transferStationId) return;
    if (transferSelectedSlots.length === 0) {
      Taro.showToast({ title: '请选择时段', icon: 'none' });
      return;
    }
    const station = stations.find((s) => s.id === transferStationId);
    if (!station) return;

    const timeSlots: TimeSlot[] = transferSelectedSlots.map((startTime) => ({
      id: `slot-${Date.now()}-${startTime}`,
      startTime,
      endTime: (() => {
        const [h, m] = startTime.split(':').map(Number);
        const total = h * 60 + m + config.timeSlotDuration;
        return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      })()
    }));

    let mergedSlot: TimeSlot | undefined;
    if (isTransferMerged && timeSlots.length > 1) {
      mergedSlot = mergeTimeSlots(timeSlots, transferDate);
    }

    transferRepairOrder(transferOrder.id, transferStationId, station.name, transferDate, timeSlots, mergedSlot);
    setShowTransferModal(false);
    Taro.showToast({ title: '已转移工位', icon: 'success' });
  }, [transferOrder, transferStationId, transferSelectedSlots, transferDate, stations, config.timeSlotDuration, isTransferMerged, transferRepairOrder]);

  const handleOpenUrgent = useCallback((stationId?: string, date?: string) => {
    setUrgentStationId(stationId || stations.find((s) => s.status === 'available')?.id || '');
    setUrgentDate(date || selectedDate);
    setUrgentSelectedSlots([]);
    setUrgentForm({
      plateNumber: '', brand: '', model: '', color: '白色',
      ownerName: '', ownerPhone: '', serviceType: '急修',
      description: '', stationId: '', stationName: '',
      estimatedDuration: 60, createdBy: '管理员'
    });
    setShowUrgentModal(true);
  }, [stations, selectedDate]);

  const urgentSchedule = useMemo(() => {
    if (!urgentStationId) return null;
    return getStationSchedule(urgentStationId, urgentDate);
  }, [urgentStationId, urgentDate, getStationSchedule]);

  const urgentStationOrders = useMemo((): RepairOrder[] => {
    if (!urgentStationId) return [];
    return repairOrders.filter(
      (o) => o.stationId === urgentStationId && o.status !== 'cancelled' && o.scheduleDate === urgentDate
    );
  }, [urgentStationId, urgentDate, repairOrders]);

  const urgentAllSlots = useMemo(() => {
    return generateTimeSlots(config, urgentDate);
  }, [config, urgentDate]);

  const urgentRecommendBlocks = useMemo((): ContiguousFreeBlock[] => {
    if (!urgentStationId) return [];
    const blocks = findContiguousFreeBlocks(urgentAllSlots, urgentStationOrders, urgentDate, 1);
    return blocks.slice(0, 5);
  }, [urgentStationId, urgentAllSlots, urgentStationOrders, urgentDate]);

  const isUrgentMerged = useMemo(() => {
    if (urgentSelectedSlots.length < 2) return true;
    const sortedSlots = [...urgentSelectedSlots].sort();
    for (let i = 1; i < sortedSlots.length; i++) {
      const prev: TimeSlot = {
        id: '1', startTime: sortedSlots[i - 1],
        endTime: (() => {
          const [h, m] = sortedSlots[i - 1].split(':').map(Number);
          const total = h * 60 + m + config.timeSlotDuration;
          return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        })()
      };
      const curr: TimeSlot = {
        id: '2', startTime: sortedSlots[i],
        endTime: (() => {
          const [h, m] = sortedSlots[i].split(':').map(Number);
          const total = h * 60 + m + config.timeSlotDuration;
          return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        })()
      };
      if (!isAdjacentSlot(prev, curr, urgentDate)) return false;
    }
    return true;
  }, [urgentSelectedSlots, config.timeSlotDuration, urgentDate]);

  const urgentAffectedOrders = useMemo((): RepairOrder[] => {
    if (urgentSelectedSlots.length === 0 || !urgentStationId) return [];
    const selectedTimeSlots: TimeSlot[] = urgentSelectedSlots.map((startTime) => ({
      id: `sel-${startTime}`, startTime,
      endTime: (() => {
        const [h, m] = startTime.split(':').map(Number);
        const total = h * 60 + m + config.timeSlotDuration;
        return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      })()
    }));

    return urgentStationOrders.filter((order) => {
      return selectedTimeSlots.some((selSlot) => {
        const orderSlots = order.mergedSlot ? [order.mergedSlot] : order.timeSlots;
        return orderSlots.some((orderSlot) => {
          const selStart = dayjs(`${urgentDate} ${selSlot.startTime}`);
          const selEnd = dayjs(`${urgentDate} ${selSlot.endTime}`);
          const ordStart = dayjs(`${urgentDate} ${orderSlot.startTime}`);
          const ordEnd = dayjs(`${urgentDate} ${orderSlot.endTime}`);
          return selStart.isBefore(ordEnd) && selEnd.isAfter(ordStart);
        });
      });
    });
  }, [urgentSelectedSlots, urgentStationId, urgentStationOrders, urgentDate]);

  const handleUrgentSlotClick = useCallback((startTime: string, isAvailable: boolean) => {
    if (!isAvailable) return;
    setUrgentSelectedSlots((prev) => {
      if (prev.includes(startTime)) return prev.filter((t) => t !== startTime);
      return [...prev, startTime].sort();
    });
  }, []);

  const handleUrgentStationChange = useCallback((e: any) => {
    const availableStations = stations.filter((s) => s.status === 'available');
    const idx = e.detail.value;
    setUrgentStationId(availableStations[idx]?.id || '');
    setUrgentSelectedSlots([]);
  }, [stations]);

  const handleConfirmUrgent = useCallback(() => {
    if (!urgentForm.plateNumber.trim()) {
      Taro.showToast({ title: '请输入车牌号', icon: 'none' });
      return;
    }
    if (!urgentStationId) {
      Taro.showToast({ title: '请选择工位', icon: 'none' });
      return;
    }
    if (urgentSelectedSlots.length === 0) {
      Taro.showToast({ title: '请选择时段', icon: 'none' });
      return;
    }

    const station = stations.find((s) => s.id === urgentStationId);
    if (!station) return;

    const timeSlots: TimeSlot[] = urgentSelectedSlots.map((startTime) => ({
      id: `slot-${Date.now()}-${startTime}`,
      startTime,
      endTime: (() => {
        const [h, m] = startTime.split(':').map(Number);
        const total = h * 60 + m + config.timeSlotDuration;
        return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      })()
    }));

    let mergedSlot: TimeSlot | undefined;
    if (isUrgentMerged && timeSlots.length > 1) {
      mergedSlot = mergeTimeSlots(timeSlots, urgentDate);
    }

    const orderId = insertUrgentOrder({
      stationId: urgentStationId,
      stationName: station.name,
      vehicle: {
        plateNumber: urgentForm.plateNumber.trim(),
        brand: urgentForm.brand.trim(),
        model: urgentForm.model.trim(),
        color: urgentForm.color,
        ownerName: urgentForm.ownerName.trim(),
        ownerPhone: urgentForm.ownerPhone.trim()
      },
      status: 'in_progress',
      serviceType: urgentForm.serviceType,
      description: urgentForm.description.trim(),
      timeSlots,
      mergedSlot,
      estimatedDuration: urgentSelectedSlots.length * config.timeSlotDuration,
      parts: [],
      createdBy: urgentForm.createdBy,
      scheduleDate: urgentDate
    });

    useAppStore.getState().updateRepairOrder(orderId, {
      actualStartTime: dayjs().toISOString()
    });

    setShowUrgentModal(false);
    Taro.showToast({ title: '急修单已插入', icon: 'success' });
  }, [urgentForm, urgentStationId, urgentSelectedSlots, urgentDate, stations, config.timeSlotDuration, isUrgentMerged, insertUrgentOrder]);

  useDidShow(() => {
    console.log('[SchedulePage] 页面显示');
  });

  React.useEffect(() => {
    const handler = () => handleOpenUrgent();
    Taro.eventCenter.on('openUrgentModal', handler);
    return () => {
      Taro.eventCenter.off('openUrgentModal', handler);
    };
  }, [handleOpenUrgent]);

  const displayDate = dayjs(selectedDate).format('YYYY年MM月DD日');
  const weekDay = weekDayLabels[dayjs(selectedDate).day()];
  const weekRangeLabel = weekDates.length > 1
    ? `${dayjs(weekDates[0]).format('MM/DD')} - ${dayjs(weekDates[weekDates.length - 1]).format('MM/DD')}`
    : '';

  const urgentAvailableStations = useMemo(() => {
    return stations.filter((s) => s.status === 'available');
  }, [stations]);

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        {viewMode === 'day' ? (
          <View className={styles.dateSelector}>
            <Button className={styles.dateBtn} onClick={handlePrevDay}>‹</Button>
            <Picker
              mode='selector'
              range={dateRange.map((d) => dayjs(d).format('MM月DD日'))}
              value={pickerValue}
              onChange={handleDateChange}
            >
              <View className={styles.currentDate}>
                {displayDate} {weekDay}
              </View>
            </Picker>
            <Button className={styles.dateBtn} onClick={handleNextDay}>›</Button>
          </View>
        ) : (
          <View className={styles.dateSelector}>
            <Button className={styles.dateBtn} onClick={handlePrevWeek}>‹</Button>
            <View className={styles.currentDate}>
              {weekRangeLabel}
            </View>
            <Button className={styles.dateBtn} onClick={handleNextWeek}>›</Button>
          </View>
        )}

        {viewMode === 'day' && (
          <ScrollView scrollX className={styles.quickDates}>
            {quickDates.map((item) => (
              <Button
                key={item.value}
                className={classnames(styles.quickDateBtn, {
                  [styles.active]: item.value === selectedDate
                })}
                onClick={() => handleQuickDate(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </ScrollView>
        )}

        <View className={styles.viewTabs}>
          <Button
            className={classnames(styles.viewTab, { [styles.active]: viewMode === 'day' })}
            onClick={() => setViewMode('day')}
          >
            日视图
          </Button>
          <Button
            className={classnames(styles.viewTab, { [styles.active]: viewMode === 'week' })}
            onClick={() => setViewMode('week')}
          >
            多日概览
          </Button>
        </View>

        <View className={styles.stats}>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{dailyStats.activeStations}</Text>
            <Text className={styles.statLabel}>可用工位</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{dailyStats.totalAvailable}</Text>
            <Text className={styles.statLabel}>空闲时段</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue} style={{ color: '#FFD666' }}>{dailyStats.totalMerged}</Text>
            <Text className={styles.statLabel}>合并时段</Text>
          </View>
        </View>
      </View>

      <View className={styles.content}>
        <View className={styles.filterBar}>
          <Picker
            mode='selector'
            range={stationTypes.map((t) => t === 'all' ? '全部类型' : t)}
            value={stationTypes.indexOf(stationTypeFilter)}
            onChange={(e) => setStationTypeFilter(stationTypes[e.detail.value])}
          >
            <View className={styles.filterBtn}>
              <Text>{stationTypeFilter === 'all' ? '全部类型' : stationTypeFilter}</Text>
              <Text className={styles.filterArrow}>▼</Text>
            </View>
          </Picker>
          <Picker
            mode='selector'
            range={['全部', '忙碌', '空闲']}
            value={['all', 'busy', 'free'].indexOf(availabilityFilter)}
            onChange={(e) => setAvailabilityFilter((['all', 'busy', 'free'] as AvailabilityFilter[])[e.detail.value])}
          >
            <View className={styles.filterBtn}>
              <Text>{availabilityFilter === 'all' ? '全部' : availabilityFilter === 'busy' ? '忙碌' : '空闲'}</Text>
              <Text className={styles.filterArrow}>▼</Text>
            </View>
          </Picker>
          <Button
            className={classnames(styles.filterBtn, styles.urgentBtn)}
            onClick={() => handleOpenUrgent()}
          >
            🚨 插急单
          </Button>
        </View>

        {viewMode === 'week' ? (
          <>
            <View className={styles.sectionTitle}>
              <Text className={styles.titleText}>多日工位概览</Text>
              <Button className={styles.addBtn} onClick={handleAddRepair}>
                + 新增工单
              </Button>
            </View>

            <ScrollView scrollX className={styles.weekScroll}>
              <View className={styles.weekWrapper}>
                <View className={styles.weekView}>
                  <View className={styles.weekHeader}>
                    <View className={styles.weekCorner}>工位</View>
                    {weekDates.map((date) => {
                      const isToday = date === dayjs().format('YYYY-MM-DD');
                      return (
                        <View key={date} className={styles.weekDateCell}>
                          <Text className={styles.weekDateLabel}>
                            {dayjs(date).format('MM/DD')}
                            {isToday && <Text className={styles.weekDateToday}>今天</Text>}
                          </Text>
                          <Text className={styles.weekDateDay}>
                            {weekDayLabels[dayjs(date).day()]}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {filteredWeekStations.map((station) => (
                    <View key={station.id} className={styles.weekRow}>
                      <View className={styles.weekStationCell}>
                        <Text className={styles.weekStationName}>{station.name}</Text>
                        <Text className={styles.weekStationType}>{station.type}</Text>
                      </View>
                      {weekDates.map((date) => {
                        const stat = weekStats[station.id]?.[date];
                        const occupancy = stat && stat.total > 0 ? (stat.occupied / stat.total) * 100 : 0;
                        const isBusy = occupancy >= 70;
                        const isFree = occupancy <= 30;

                        return (
                          <View
                            key={`${station.id}-${date}`}
                            className={classnames(styles.weekCell, {
                              [styles.weekCellMaintained]: stat?.isMaintenance,
                              [styles.weekCellBusy]: isBusy && !stat?.isMaintenance,
                              [styles.weekCellFree]: isFree && !stat?.isMaintenance
                            })}
                            onClick={() => handleWeekCellClick(station.id, date)}
                          >
                            <View className={styles.weekCellContent}>
                              {stat?.isMaintenance ? (
                                <>
                                  <Text className={styles.weekOccupied} style={{ color: '#FAAD14' }}>
                                    维护中
                                  </Text>
                                </>
                              ) : (
                                <>
                                  <View className={classnames(styles.weekOccupancyBar, { [styles.busyBar]: isBusy, [styles.freeBar]: isFree })}>
                                    <View
                                      className={classnames(styles.weekOccupancyFill, { [styles.busyFill]: isBusy, [styles.freeFill]: isFree })}
                                      style={{ width: `${occupancy}%` }}
                                    />
                                  </View>
                                  <View className={styles.weekStats}>
                                    <Text className={classnames(styles.weekOccupied, { [styles.busyText]: isBusy })}>
                                      {stat?.occupied || 0}/{stat?.total || 0}
                                    </Text>
                                    <Text className={styles.weekAvailable}>
                                      空闲 {stat?.available || 0}
                                    </Text>
                                  </View>
                                  <View className={styles.weekCellActions}>
                                    <Button
                                      className={classnames(styles.weekCellBtn, styles.detail)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleWeekCellClick(station.id, date);
                                      }}
                                    >
                                      详情
                                    </Button>
                                    {station.status === 'available' && (
                                      <Button
                                        className={classnames(styles.weekCellBtn, styles.add)}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleWeekCellAdd(station.id, date);
                                        }}
                                      >
                                        +预约
                                      </Button>
                                    )}
                                  </View>
                                </>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </>
        ) : (
          <>
            <View className={styles.legend}>
              <View className={styles.legendItem}>
                <View className={classnames(styles.legendDot, styles.available)} />
                <Text>空闲</Text>
              </View>
              <View className={styles.legendItem}>
                <View className={classnames(styles.legendDot, styles.occupied)} />
                <Text>占用</Text>
              </View>
              <View className={styles.legendItem}>
                <View className={classnames(styles.legendDot, styles.merged)} />
                <Text>合并</Text>
              </View>
              <View className={styles.legendItem}>
                <View className={classnames(styles.legendDot, styles.maintenance)} />
                <Text>维护</Text>
              </View>
              <View className={styles.legendItem}>
                <View className={classnames(styles.legendDot, styles.inProgressDot)} />
                <Text>维修中</Text>
              </View>
              <View className={styles.legendItem}>
                <View className={classnames(styles.legendDot, styles.overtimeDot)} />
                <Text>超时</Text>
              </View>
            </View>

            <View className={styles.sectionTitle}>
              <Text className={styles.titleText}>工位列表</Text>
              <Button className={styles.addBtn} onClick={handleAddRepair}>
                + 新增工单
              </Button>
            </View>

            {filteredStations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                date={selectedDate}
                onClick={() => setSelectedStationId(station.id === selectedStationId ? null : station.id)}
              />
            ))}

            {selectedStationId && selectedSchedule && (
              <View className={styles.sectionTitle} style={{ marginTop: '32rpx' }}>
                <Text className={styles.titleText}>{selectedStation?.name} 时段详情</Text>
              </View>
            )}

            {selectedSchedule && (
              <View className={styles.stationSchedule}>
                <View className={styles.stationHeader}>
                  <Text className={styles.stationName}>{selectedSchedule.stationName}</Text>
                </View>
                {selectedSchedule.timeSlots.length === 0 ? (
                  <View className={styles.empty}>暂无时段数据</View>
                ) : (
                  selectedSchedule.timeSlots.map((slotData, index) => {
                    const showSlot = index === 0 || !slotData.isMerged ||
                      (slotData.isMerged && !selectedSchedule.timeSlots[index - 1]?.isMerged);

                    if (!showSlot && slotData.isMerged) {
                      return null;
                    }

                    return (
                      <TimeSlotComponent
                        key={slotData.slot.id}
                        startTime={slotData.slot.startTime}
                        endTime={slotData.slot.endTime}
                        isAvailable={slotData.isAvailable}
                        isMerged={slotData.isMerged}
                        repairOrder={slotData.repairOrder}
                        stationStatus={selectedStation?.status}
                        onDelay={handleDelay}
                        onEarlyEnd={handleEarlyEnd}
                        onTransfer={handleTransfer}
                        onClick={() => handleSlotClick(slotData)}
                      />
                    );
                  })
                )}
              </View>
            )}
          </>
        )}
      </View>

      <Button className={styles.floatingBtn} onClick={handleAddRepair}>
        +
      </Button>

      {showDelayModal && (
        <View className={styles.modal}>
          <View className={styles.modalContent}>
            <Text className={styles.modalTitle}>延时维修</Text>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>延长时间（分钟）</Text>
              <View className={styles.delayOptions}>
                {['30', '60', '90', '120'].map((mins) => (
                  <Button
                    key={mins}
                    className={classnames(styles.delayBtn, { [styles.active]: delayMinutes === mins })}
                    onClick={() => setDelayMinutes(mins)}
                  >
                    {mins}分钟
                  </Button>
                ))}
              </View>
              <Input
                className={styles.formInput}
                type='number'
                placeholder='自定义分钟数'
                value={delayMinutes}
                onInput={(e) => setDelayMinutes(e.detail.value)}
              />
            </View>
            <View className={styles.modalActions}>
              <Button className={classnames(styles.modalBtn, styles.cancel)} onClick={() => setShowDelayModal(false)}>取消</Button>
              <Button className={classnames(styles.modalBtn, styles.confirm)} onClick={handleConfirmDelay}>确认延时</Button>
            </View>
          </View>
        </View>
      )}

      {showTransferModal && transferOrder && (
        <View className={styles.modal}>
          <View className={styles.modalContent}>
            <Text className={styles.modalTitle}>转移工位</Text>
            <View className={styles.transferInfo}>
              <Text className={styles.transferPlate}>{transferOrder.vehicle.plateNumber}</Text>
              <Text className={styles.transferMeta}>{transferOrder.serviceType} · {transferOrder.stationName}</Text>
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>目标工位</Text>
              <Picker
                mode='selector'
                range={transferAvailableStations.map((s) => `${s.name} · ${s.type}`)}
                value={transferAvailableStations.findIndex((s) => s.id === transferStationId)}
                onChange={handleTransferStationChange}
              >
                <View className={styles.formPicker}>
                  <Text>{transferAvailableStations.find((s) => s.id === transferStationId)?.name || '请选择'}</Text>
                  <Text className={styles.filterArrow}>›</Text>
                </View>
              </Picker>
            </View>
            {transferStationId && transferSchedule && (
              <>
                {transferRecommendBlocks.length > 0 && (
                  <View className={styles.formItem}>
                    <Text className={styles.formLabel}>推荐空档</Text>
                    <View className={styles.recommendList}>
                      {transferRecommendBlocks.map((block, idx) => (
                        <View key={idx} className={styles.recommendItem} onClick={() => setTransferSelectedSlots(block.slots.map((s) => s.startTime))}>
                          <Text className={styles.recommendTime}>{block.startTime} - {block.endTime}</Text>
                          <Text className={styles.recommendMeta}>{block.slotCount}段 · {block.duration}分钟</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                <View className={styles.formItem}>
                  <Text className={styles.formLabel}>选择时段</Text>
                  <View className={styles.slotGrid}>
                    {transferSchedule.timeSlots.map((item) => (
                      <View
                        key={item.slot.id}
                        className={classnames(
                          styles.slotItem,
                          { [styles.slotOccupied]: !item.isAvailable },
                          { [styles.slotSelected]: transferSelectedSlots.includes(item.slot.startTime) && item.isAvailable },
                          { [styles.slotMerged]: transferSelectedSlots.includes(item.slot.startTime) && item.isAvailable && isTransferMerged && transferSelectedSlots.length > 1 }
                        )}
                        onClick={() => handleTransferSlotClick(item.slot.startTime, item.isAvailable)}
                      >
                        {item.slot.startTime}
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
            <View className={styles.modalActions}>
              <Button className={classnames(styles.modalBtn, styles.cancel)} onClick={() => setShowTransferModal(false)}>取消</Button>
              <Button className={classnames(styles.modalBtn, styles.confirm)} onClick={handleConfirmTransfer}>确认转移</Button>
            </View>
          </View>
        </View>
      )}

      {showUrgentModal && (
        <View className={styles.modal}>
          <View className={styles.modalContent}>
            <Text className={styles.modalTitle}>🚨 插入急修单</Text>
            <ScrollView scrollY className={styles.urgentScroll}>
              <View className={styles.formItem}>
                <Text className={styles.formLabel}>车牌号 *</Text>
                <Input className={styles.formInput} placeholder='输入车牌号' value={urgentForm.plateNumber} onInput={(e) => setUrgentForm((p) => ({ ...p, plateNumber: e.detail.value }))} />
              </View>
              <View style={{ display: 'flex', gap: '16rpx' }}>
                <View className={styles.formItem} style={{ flex: 1 }}>
                  <Text className={styles.formLabel}>品牌</Text>
                  <Input className={styles.formInput} placeholder='品牌' value={urgentForm.brand} onInput={(e) => setUrgentForm((p) => ({ ...p, brand: e.detail.value }))} />
                </View>
                <View className={styles.formItem} style={{ flex: 1 }}>
                  <Text className={styles.formLabel}>型号</Text>
                  <Input className={styles.formInput} placeholder='型号' value={urgentForm.model} onInput={(e) => setUrgentForm((p) => ({ ...p, model: e.detail.value }))} />
                </View>
              </View>
              <View className={styles.formItem}>
                <Text className={styles.formLabel}>车主姓名</Text>
                <Input className={styles.formInput} placeholder='车主姓名' value={urgentForm.ownerName} onInput={(e) => setUrgentForm((p) => ({ ...p, ownerName: e.detail.value }))} />
              </View>
              <View className={styles.formItem}>
                <Text className={styles.formLabel}>车主电话</Text>
                <Input className={styles.formInput} type='number' placeholder='车主电话' value={urgentForm.ownerPhone} onInput={(e) => setUrgentForm((p) => ({ ...p, ownerPhone: e.detail.value }))} />
              </View>
              <View className={styles.formItem}>
                <Text className={styles.formLabel}>故障描述</Text>
                <Input className={styles.formInput} placeholder='简述故障' value={urgentForm.description} onInput={(e) => setUrgentForm((p) => ({ ...p, description: e.detail.value }))} />
              </View>
              <View className={styles.formItem}>
                <Text className={styles.formLabel}>工位</Text>
                <Picker
                  mode='selector'
                  range={urgentAvailableStations.map((s) => `${s.name} · ${s.type}`)}
                  value={urgentAvailableStations.findIndex((s) => s.id === urgentStationId)}
                  onChange={handleUrgentStationChange}
                >
                  <View className={styles.formPicker}>
                    <Text>{urgentAvailableStations.find((s) => s.id === urgentStationId)?.name || '请选择'}</Text>
                    <Text className={styles.filterArrow}>›</Text>
                  </View>
                </Picker>
              </View>
              <View className={styles.formItem}>
                <Text className={styles.formLabel}>日期</Text>
                <Picker mode='date' value={urgentDate} onChange={(e) => { setUrgentDate(e.detail.value); setUrgentSelectedSlots([]); }}>
                  <View className={styles.formPicker}>
                    <Text>{urgentDate}</Text>
                    <Text className={styles.filterArrow}>›</Text>
                  </View>
                </Picker>
              </View>
              {urgentStationId && urgentSchedule && (
                <>
                  {urgentRecommendBlocks.length > 0 && (
                    <View className={styles.formItem}>
                      <Text className={styles.formLabel}>推荐空档</Text>
                      <View className={styles.recommendList}>
                        {urgentRecommendBlocks.map((block, idx) => (
                          <View key={idx} className={styles.recommendItem} onClick={() => setUrgentSelectedSlots(block.slots.map((s) => s.startTime))}>
                            <Text className={styles.recommendTime}>{block.startTime} - {block.endTime}</Text>
                            <Text className={styles.recommendMeta}>{block.slotCount}段 · {block.duration}分钟</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  <View className={styles.formItem}>
                    <Text className={styles.formLabel}>选择时段</Text>
                    <View className={styles.slotGrid}>
                      {urgentSchedule.timeSlots.map((item) => (
                        <View
                          key={item.slot.id}
                          className={classnames(
                            styles.slotItem,
                            { [styles.slotOccupied]: !item.isAvailable },
                            { [styles.slotSelected]: urgentSelectedSlots.includes(item.slot.startTime) && item.isAvailable },
                            { [styles.slotMerged]: urgentSelectedSlots.includes(item.slot.startTime) && item.isAvailable && isUrgentMerged && urgentSelectedSlots.length > 1 }
                          )}
                          onClick={() => handleUrgentSlotClick(item.slot.startTime, item.isAvailable)}
                        >
                          {item.slot.startTime}
                        </View>
                      ))}
                    </View>
                  </View>
                  {urgentAffectedOrders.length > 0 && (
                    <View className={styles.impactAlert}>
                      <Text className={styles.impactTitle}>⚠️ 将影响以下预约：</Text>
                      {urgentAffectedOrders.map((order) => (
                        <View key={order.id} className={styles.impactItem}>
                          <Text className={styles.impactPlate}>{order.vehicle.plateNumber}</Text>
                          <Text className={styles.impactTime}>
                            {order.timeSlots[0]?.startTime} - {order.timeSlots[order.timeSlots.length - 1]?.endTime}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            <View className={styles.modalActions}>
              <Button className={classnames(styles.modalBtn, styles.cancel)} onClick={() => setShowUrgentModal(false)}>取消</Button>
              <Button className={classnames(styles.modalBtn, styles.confirm)} onClick={handleConfirmUrgent}>确认插入</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default SchedulePage;
