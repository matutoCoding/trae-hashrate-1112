import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, ScrollView, Picker } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import StationCard from '@/components/StationCard';
import TimeSlotComponent from '@/components/TimeSlot';

type ViewMode = 'day' | 'week';

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
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [weekStartDate, setWeekStartDate] = useState(dayjs().format('YYYY-MM-DD'));

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

  const weekStats = useMemo(() => {
    const result: Record<string, Record<string, {
      total: number;
      occupied: number;
      available: number;
      merged: number;
      isMaintenance: boolean;
    }>> = {};

    stations.forEach((station) => {
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
  }, [stations, weekDates, getStationSchedule]);

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

  useDidShow(() => {
    console.log('[SchedulePage] 页面显示');
  });

  const displayDate = dayjs(selectedDate).format('YYYY年MM月DD日');
  const weekDay = weekDayLabels[dayjs(selectedDate).day()];
  const weekRangeLabel = weekDates.length > 1
    ? `${dayjs(weekDates[0]).format('MM/DD')} - ${dayjs(weekDates[weekDates.length - 1]).format('MM/DD')}`
    : '';

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

                  {stations.map((station) => (
                    <View key={station.id} className={styles.weekRow}>
                      <View className={styles.weekStationCell}>
                        <Text className={styles.weekStationName}>{station.name}</Text>
                        <Text className={styles.weekStationType}>{station.type}</Text>
                      </View>
                      {weekDates.map((date) => {
                        const stat = weekStats[station.id]?.[date];
                        const occupancy = stat && stat.total > 0 ? (stat.occupied / stat.total) * 100 : 0;

                        return (
                          <View
                            key={`${station.id}-${date}`}
                            className={classnames(styles.weekCell, {
                              [styles.weekCellMaintained]: stat?.isMaintenance
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
                                  <View className={styles.weekOccupancyBar}>
                                    <View
                                      className={styles.weekOccupancyFill}
                                      style={{ width: `${occupancy}%` }}
                                    />
                                  </View>
                                  <View className={styles.weekStats}>
                                    <Text className={styles.weekOccupied}>
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
          </>
        )}
      </View>

      <Button className={styles.floatingBtn} onClick={handleAddRepair}>
        +
      </Button>
    </View>
  );
};

export default SchedulePage;
