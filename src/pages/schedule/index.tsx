import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, ScrollView, Picker } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import StationCard from '@/components/StationCard';
import TimeSlotComponent from '@/components/TimeSlot';

const SchedulePage: React.FC = () => {
  const {
    stations,
    selectedDate,
    setSelectedDate,
    getStationSchedule,
    repairOrders,
    config
  } = useAppStore();

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [pickerValue, setPickerValue] = useState(0);

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

  const dailyStats = useMemo(() => {
    let totalOccupied = 0;
    let totalAvailable = 0;
    let totalMerged = 0;

    stations.forEach((station) => {
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

    const activeStations = stations.filter((s) => s.status === 'available').length;

    return { totalOccupied, totalAvailable, totalMerged, activeStations };
  }, [stations, selectedDate, getStationSchedule]);

  const selectedSchedule = useMemo(() => {
    if (!selectedStationId) return null;
    return getStationSchedule(selectedStationId, selectedDate);
  }, [selectedStationId, selectedDate, getStationSchedule]);

  const selectedStation = useMemo(() => {
    return stations.find((s) => s.id === selectedStationId);
  }, [stations, selectedStationId]);

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

  useDidShow(() => {
    console.log('[SchedulePage] 页面显示');
  });

  const displayDate = dayjs(selectedDate).format('YYYY年MM月DD日');
  const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(selectedDate).day()];

  return (
    <View className={styles.page}>
      <View className={styles.header}>
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
        </View>

        <View className={styles.sectionTitle}>
          <Text className={styles.titleText}>工位列表</Text>
          <Button className={styles.addBtn} onClick={handleAddRepair}>
            + 新增工单
          </Button>
        </View>

        {stations.map((station) => (
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
                    onClick={() => handleSlotClick(slotData)}
                  />
                );
              })
            )}
          </View>
        )}
      </View>

      <Button className={styles.floatingBtn} onClick={handleAddRepair}>
        +
      </Button>
    </View>
  );
};

export default SchedulePage;
