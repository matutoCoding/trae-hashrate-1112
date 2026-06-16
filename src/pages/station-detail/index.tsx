import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, ScrollView, Picker } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import StatusTag from '@/components/StatusTag';
import { formatTimeDisplay } from '@/utils/schedule';
import type { RepairOrder } from '@/types';

const StationDetailPage: React.FC = () => {
  const router = useRouter();
  const stationId = router.params.id;

  const {
    stations,
    repairOrders,
    getStationSchedule,
    selectedDate,
    setSelectedDate,
    updateStation
  } = useAppStore();

  const [currentDate, setCurrentDate] = useState(selectedDate);

  const station = useMemo(() => {
    return stations.find((s) => s.id === stationId);
  }, [stations, stationId]);

  const scheduleData = useMemo(() => {
    if (!stationId) return null;
    return getStationSchedule(stationId, currentDate);
  }, [stationId, currentDate, getStationSchedule]);

  const todayRepairs = useMemo(() => {
    if (!stationId) return [];
    return repairOrders.filter((o) => {
      if (o.stationId !== stationId) return false;
      if (o.status === 'cancelled') return false;
      const orderDate = dayjs(o.createdAt).format('YYYY-MM-DD');
      return orderDate === currentDate;
    }).sort((a, b) => {
      const aTime = a.timeSlots[0]?.startTime || '00:00';
      const bTime = b.timeSlots[0]?.startTime || '00:00';
      return aTime.localeCompare(bTime);
    });
  }, [repairOrders, stationId, currentDate]);

  const stats = useMemo(() => {
    const completed = todayRepairs.filter((o) => o.status === 'completed').length;
    const inProgress = todayRepairs.filter((o) => o.status === 'in_progress').length;
    const pending = todayRepairs.filter((o) => o.status === 'pending' || o.status === 'queuing').length;
    const totalSlots = scheduleData?.timeSlots.length || 0;
    const occupiedSlots = scheduleData?.timeSlots.filter((s) => !s.isAvailable).length || 0;
    const utilization = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0;

    return { completed, inProgress, pending, totalSlots, occupiedSlots, utilization };
  }, [todayRepairs, scheduleData]);

  const handleDateChange = useCallback((e: any) => {
    const newDate = e.detail.value;
    setCurrentDate(newDate);
    setSelectedDate(newDate);
  }, [setSelectedDate]);

  const handleCreateOrder = useCallback(() => {
    Taro.navigateTo({
      url: `/pages/repair-create/index?stationId=${stationId}&date=${currentDate}`
    });
  }, [stationId, currentDate]);

  const handleToggleMaintenance = useCallback(() => {
    if (!station) return;

    const newStatus = station.status === 'maintenance' ? 'available' : 'maintenance';
    const confirmText = newStatus === 'maintenance'
      ? '确定将该工位设置为维护状态吗？维护期间无法预约。'
      : '确定取消维护状态吗？';

    Taro.showModal({
      title: newStatus === 'maintenance' ? '设置维护' : '取消维护',
      content: confirmText,
      success: (res) => {
        if (res.confirm) {
          updateStation(station.id, { status: newStatus });
          Taro.showToast({
            title: newStatus === 'maintenance' ? '已设置维护' : '已取消维护',
            icon: 'success'
          });
        }
      }
    });
  }, [station, updateStation]);

  const handleRepairClick = useCallback((repair: RepairOrder) => {
    Taro.navigateTo({
      url: `/pages/repair-detail/index?id=${repair.id}`
    });
  }, []);

  const getSlotStatusClass = (isAvailable: boolean, isMerged: boolean, isMaintenance: boolean) => {
    if (isMaintenance) return styles.maintenance;
    if (!isAvailable) {
      return isMerged ? styles.merged : styles.occupied;
    }
    return styles.available;
  };

  useDidShow(() => {
    console.log('[StationDetailPage] 页面显示，工位ID:', stationId);
  });

  if (!station) {
    return (
      <View className={styles.page}>
        <View className={styles.empty} style={{ margin: '32rpx' }}>
          <Text>工位不存在</Text>
        </View>
      </View>
    );
  }

  return (
    <View className={styles.page}>
      <ScrollView scrollY>
        <View className={styles.headerCard}>
          <Text className={styles.stationName}>{station.name}</Text>
          <Text className={styles.stationNumber}>编号：{station.number}</Text>
          <View style={{ marginBottom: '16rpx' }}>
            <StatusTag status={station.status} />
          </View>
          <View className={styles.stationTags}>
            <View className={styles.stationTag}>{station.type}</View>
            <View className={styles.stationTag}>承重 {station.capacity} 吨</View>
            <View className={styles.stationTag}>{station.description}</View>
          </View>

          <View className={styles.infoGrid}>
            <View className={styles.infoItem}>
              <Text className={styles.infoValue}>{stats.totalSlots}</Text>
              <Text className={styles.infoLabel}>总时段</Text>
            </View>
            <View className={styles.infoItem}>
              <Text className={styles.infoValue}>{stats.occupiedSlots}</Text>
              <Text className={styles.infoLabel}>已占用</Text>
            </View>
            <View className={styles.infoItem}>
              <Text className={styles.infoValue}>{stats.utilization}%</Text>
              <Text className={styles.infoLabel}>利用率</Text>
            </View>
          </View>
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>今日统计</Text>
          <View className={styles.statCard}>
            <View className={classnames(styles.statIcon, styles.success)}>✅</View>
            <View className={styles.statInfo}>
              <Text className={styles.statValue}>{stats.completed}</Text>
              <Text className={styles.statLabel}>已完成</Text>
            </View>
          </View>
          <View className={styles.statCard}>
            <View className={classnames(styles.statIcon, styles.primary)}>🔧</View>
            <View className={styles.statInfo}>
              <Text className={styles.statValue}>{stats.inProgress}</Text>
              <Text className={styles.statLabel}>进行中</Text>
            </View>
          </View>
          <View className={styles.statCard}>
            <View className={classnames(styles.statIcon, styles.warning)}>⏳</View>
            <View className={styles.statInfo}>
              <Text className={styles.statValue}>{stats.pending}</Text>
              <Text className={styles.statLabel}>待处理</Text>
            </View>
          </View>
        </View>

        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>时段排期</Text>
            <Picker
              mode='date'
              value={currentDate}
              onChange={handleDateChange}
            >
              <View className={styles.datePicker}>
                <Text>{currentDate}</Text>
                <Text style={{ color: 'var(--color-text-tertiary, #86909C)' }}>›</Text>
              </View>
            </Picker>
          </View>

          {scheduleData && (
            <>
              <View className={styles.timeSlotGrid}>
                {scheduleData.timeSlots.map((item) => (
                  <View
                    key={item.slot.id}
                    className={classnames(
                      styles.timeSlotItem,
                      getSlotStatusClass(item.isAvailable, item.isMerged, station.status === 'maintenance')
                    )}
                  >
                    {item.slot.startTime}
                  </View>
                ))}
              </View>

              <View className={styles.slotLegend}>
                <View className={styles.legendItem}>
                  <View className={classnames(styles.legendDot)} style={{ background: 'var(--color-bg-page, #F5F7FA)' }} />
                  <Text>空闲</Text>
                </View>
                <View className={styles.legendItem}>
                  <View className={classnames(styles.legendDot)} style={{ background: 'rgba(22, 119, 255, 0.1)' }} />
                  <Text>已占用</Text>
                </View>
                <View className={styles.legendItem}>
                  <View className={classnames(styles.legendDot)} style={{ background: 'linear-gradient(135deg, #1677FF 0%, #4096FF 100%)' }} />
                  <Text>已合并</Text>
                </View>
                <View className={styles.legendItem}>
                  <View className={classnames(styles.legendDot)} style={{ background: 'rgba(250, 173, 20, 0.1)' }} />
                  <Text>维护</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>当日维修单</Text>
          {todayRepairs.length === 0 ? (
            <View className={styles.empty}>暂无维修单</View>
          ) : (
            <View className={styles.repairList}>
              {todayRepairs.map((repair) => {
                const displaySlot = repair.mergedSlot || repair.timeSlots[0];
                return (
                  <View
                    key={repair.id}
                    className={styles.repairItem}
                    onClick={() => handleRepairClick(repair)}
                  >
                    <View className={styles.repairTime}>
                      {displaySlot && formatTimeDisplay(displaySlot.startTime, displaySlot.endTime)}
                    </View>
                    <View className={styles.repairInfo}>
                      <Text className={styles.repairPlate}>{repair.vehicle.plateNumber}</Text>
                      <Text className={styles.repairService}>
                        {repair.serviceType} · {repair.vehicle.brand} {repair.vehicle.model}
                      </Text>
                    </View>
                    <StatusTag status={repair.status} />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>工位信息</Text>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>工位名称</Text>
            <Text className={styles.infoValue}>{station.name}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>工位编号</Text>
            <Text className={styles.infoValue}>{station.number}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>工位类型</Text>
            <Text className={styles.infoValue}>{station.type}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>承重能力</Text>
            <Text className={styles.infoValue}>{station.capacity} 吨</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>当前状态</Text>
            <Text className={styles.infoValue}>
              <StatusTag status={station.status} />
            </Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>描述</Text>
            <Text className={styles.infoValue}>{station.description}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>创建时间</Text>
            <Text className={styles.infoValue}>
              {dayjs(station.createdAt).format('YYYY-MM-DD HH:mm')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className={styles.bottomActions}>
        <Button
          className={classnames(styles.actionBtn, station.status === 'maintenance' ? styles.primary : styles.warning)}
          onClick={handleToggleMaintenance}
        >
          {station.status === 'maintenance' ? '取消维护' : '设置维护'}
        </Button>
        <Button
          className={classnames(styles.actionBtn, styles.primary)}
          onClick={handleCreateOrder}
        >
          新增预约
        </Button>
      </View>
    </View>
  );
};

export default StationDetailPage;
