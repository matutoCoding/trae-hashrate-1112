import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Button, Input, ScrollView, Picker, Textarea } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import StatusTag from '@/components/StatusTag';
import {
  isAdjacentSlot,
  mergeTimeSlots,
  findContiguousFreeBlocks,
  getSlotConflicts,
  generateTimeSlots,
  ContiguousFreeBlock
} from '@/utils/schedule';
import type { TimeSlot, Station, RepairOrder } from '@/types';

const serviceTypes = [
  { key: '常规保养', icon: '🔧' },
  { key: '发动机维修', icon: '⚙️' },
  { key: '底盘维修', icon: '🔩' },
  { key: '电气维修', icon: '🔋' },
  { key: '钣金喷漆', icon: '🎨' },
  { key: '轮胎更换', icon: '🚗' },
  { key: '空调维修', icon: '❄️' },
  { key: '故障诊断', icon: '🔍' },
  { key: '其他服务', icon: '📋' }
];

const quickDescriptions = [
  '发动机异响',
  '刹车失灵',
  '保养到期',
  '空调不制冷',
  '轮胎漏气',
  '电瓶没电'
];

const RepairCreatePage: React.FC = () => {
  const router = useRouter();
  const preSelectedStationId = router.params.stationId;
  const preSelectedDate = router.params.date;

  const { stations, createRepairOrder, getStationSchedule, config, selectedDate, setSelectedDate, repairOrders } = useAppStore();

  const [form, setForm] = useState({
    plateNumber: '',
    brand: '',
    model: '',
    color: '',
    ownerName: '',
    ownerPhone: '',
    stationId: preSelectedStationId || '',
    serviceType: '',
    description: '',
    estimatedDuration: '60',
    notes: ''
  });

  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [currentDate, setCurrentDate] = useState(preSelectedDate || selectedDate);

  const availableStations = useMemo(() => {
    return stations.filter((s) => s.status === 'available');
  }, [stations]);

  const scheduleData = useMemo(() => {
    if (!form.stationId) return null;
    return getStationSchedule(form.stationId, currentDate);
  }, [form.stationId, currentDate, getStationSchedule]);

  const stationOrders = useMemo((): RepairOrder[] => {
    if (!form.stationId) return [];
    return repairOrders.filter(
      (o) => o.stationId === form.stationId
        && o.status !== 'cancelled'
        && o.scheduleDate === currentDate
    );
  }, [form.stationId, currentDate, repairOrders]);

  const allTimeSlots = useMemo(() => {
    return generateTimeSlots(config, currentDate);
  }, [config, currentDate]);

  const recommendedBlocks = useMemo((): ContiguousFreeBlock[] => {
    if (!form.stationId) return [];
    const blocks = findContiguousFreeBlocks(allTimeSlots, stationOrders, currentDate, 1);
    return blocks.slice(0, 5);
  }, [form.stationId, allTimeSlots, stationOrders, currentDate]);

  const slotConflicts = useMemo(() => {
    if (selectedSlots.length === 0) return { conflictingSlots: [] as string[], selectedBlocks: [] as ContiguousFreeBlock[] };
    return getSlotConflicts(selectedSlots, allTimeSlots, stationOrders, currentDate, config.timeSlotDuration);
  }, [selectedSlots, allTimeSlots, stationOrders, currentDate, config.timeSlotDuration]);

  const hasConflict = slotConflicts.conflictingSlots.length > 0;

  useEffect(() => {
    if (hasConflict) {
      Taro.showToast({
        title: `时段${slotConflicts.conflictingSlots.join('、')}已被占用`,
        icon: 'none',
        duration: 2000
      });
    }
  }, [hasConflict, slotConflicts.conflictingSlots]);

  const handleRecommendSelect = useCallback((block: ContiguousFreeBlock) => {
    const startTimes = block.slots.map((s) => s.startTime);
    setSelectedSlots(startTimes);
    Taro.showToast({
      title: `已选择${block.slotCount}个连续时段`,
      icon: 'success'
    });
  }, []);

  const isMergedSelection = useMemo(() => {
    if (selectedSlots.length < 2) return false;
    const sortedSlots = [...selectedSlots].sort();
    for (let i = 1; i < sortedSlots.length; i++) {
      const prev: TimeSlot = { id: '1', startTime: sortedSlots[i - 1], endTime: addMinutes(sortedSlots[i - 1], config.timeSlotDuration) };
      const curr: TimeSlot = { id: '2', startTime: sortedSlots[i], endTime: addMinutes(sortedSlots[i], config.timeSlotDuration) };
      if (!isAdjacentSlot(prev, curr, currentDate)) {
        return false;
      }
    }
    return true;
  }, [selectedSlots, config.timeSlotDuration, currentDate]);

  const estimatedDuration = useMemo(() => {
    return selectedSlots.length * config.timeSlotDuration;
  }, [selectedSlots, config.timeSlotDuration]);

  const mergedSlotDisplay = useMemo(() => {
    if (selectedSlots.length === 0) return '';
    if (selectedSlots.length === 1) return selectedSlots[0];
    if (!isMergedSelection) return `${selectedSlots[0]} - ${addMinutes(selectedSlots[selectedSlots.length - 1], config.timeSlotDuration)} (不连续)`;
    return `${selectedSlots[0]} - ${addMinutes(selectedSlots[selectedSlots.length - 1], config.timeSlotDuration)} (已合并)`;
  }, [selectedSlots, isMergedSelection, config.timeSlotDuration]);

  function addMinutes(timeStr: string, minutes: number): string {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }

  const handleSlotClick = useCallback((startTime: string, isAvailable: boolean) => {
    if (!isAvailable) return;

    setSelectedSlots((prev) => {
      if (prev.includes(startTime)) {
        return prev.filter((t) => t !== startTime);
      }
      return [...prev, startTime].sort();
    });
  }, []);

  const handleStationSelect = useCallback((station: Station) => {
    setForm((prev) => ({ ...prev, stationId: station.id }));
    setSelectedSlots([]);
  }, []);

  const handleServiceTypeSelect = useCallback((type: string) => {
    setForm((prev) => ({ ...prev, serviceType: type }));
  }, []);

  const handleQuickDescription = useCallback((desc: string) => {
    setForm((prev) => ({ ...prev, description: prev.description ? `${prev.description}、${desc}` : desc }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.plateNumber.trim()) {
      Taro.showToast({ title: '请输入车牌号', icon: 'none' });
      return;
    }
    if (!form.brand.trim() || !form.model.trim()) {
      Taro.showToast({ title: '请输入车辆品牌和型号', icon: 'none' });
      return;
    }
    if (!form.ownerName.trim() || !form.ownerPhone.trim()) {
      Taro.showToast({ title: '请输入车主信息', icon: 'none' });
      return;
    }
    if (!form.stationId) {
      Taro.showToast({ title: '请选择工位', icon: 'none' });
      return;
    }
    if (!form.serviceType) {
      Taro.showToast({ title: '请选择服务类型', icon: 'none' });
      return;
    }
    if (selectedSlots.length === 0) {
      Taro.showToast({ title: '请选择预约时段', icon: 'none' });
      return;
    }
    if (hasConflict) {
      Taro.showToast({
        title: `时段${slotConflicts.conflictingSlots.join('、')}已被占用，请重新选择`,
        icon: 'none'
      });
      return;
    }
    if (!isMergedSelection && selectedSlots.length > 1) {
      Taro.showModal({
        title: '时段不连续',
        content: '您选择的时段不连续，无法合并为整段占用。是否继续创建？系统将创建多个独立时段。',
        success: (res) => {
          if (res.confirm) {
            doCreate();
          }
        }
      });
      return;
    }

    doCreate();
  }, [form, selectedSlots, isMergedSelection]);

  const doCreate = useCallback(() => {
    const timeSlots: TimeSlot[] = selectedSlots.map((startTime) => ({
      id: `slot-${Date.now()}-${startTime}`,
      startTime,
      endTime: addMinutes(startTime, config.timeSlotDuration)
    }));

    let mergedSlot: TimeSlot | undefined;
    if (isMergedSelection && timeSlots.length > 1) {
      mergedSlot = mergeTimeSlots(timeSlots, currentDate);
    }

    const station = stations.find((s) => s.id === form.stationId);

    createRepairOrder({
      stationId: form.stationId,
      stationName: station?.name || '',
      vehicle: {
        plateNumber: form.plateNumber.trim().toUpperCase(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        color: form.color.trim() || '未填写',
        ownerName: form.ownerName.trim(),
        ownerPhone: form.ownerPhone.trim()
      },
      status: 'pending',
      serviceType: form.serviceType,
      description: form.description.trim() || '无',
      scheduleDate: currentDate,
      timeSlots,
      mergedSlot,
      estimatedDuration: estimatedDuration || Number(form.estimatedDuration) || 60,
      parts: [],
      createdBy: '当前操作员',
      notes: form.notes.trim()
    });

    Taro.showToast({ title: '创建成功', icon: 'success' });
    setTimeout(() => Taro.navigateBack(), 800);
  }, [form, selectedSlots, isMergedSelection, config.timeSlotDuration, currentDate, stations, estimatedDuration, createRepairOrder]);

  const handleDateChange = useCallback((e: any) => {
    const newDate = e.detail.value;
    setCurrentDate(newDate);
    setSelectedDate(newDate);
    setSelectedSlots([]);
  }, [setSelectedDate]);

  useDidShow(() => {
    console.log('[RepairCreatePage] 页面显示');
  });

  const getSlotStatusClass = (slotStartTime: string, isAvailable: boolean) => {
    if (!isAvailable) return styles.occupied;
    if (selectedSlots.includes(slotStartTime)) {
      return isMergedSelection && selectedSlots.length > 1 ? styles.merged : styles.selected;
    }
    return styles.available;
  };

  return (
    <View className={styles.page}>
      <ScrollView scrollY>
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>车辆信息<Text className={styles.required}>*</Text></Text>

          <View className={styles.vehicleCard}>
            <Input
              className={styles.plateInput}
              placeholder='请输入车牌号'
              placeholderClass={styles.plateInput}
              value={form.plateNumber}
              onInput={(e) => setForm((prev) => ({ ...prev, plateNumber: e.detail.value.toUpperCase() }))}
              maxLength={8}
            />
            {form.plateNumber && (
              <Text className={styles.platePreview}>{form.plateNumber}</Text>
            )}
          </View>

          <View className={styles.formRow}>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>品牌<Text className={styles.required}>*</Text></Text>
              <Input
                className={styles.formInput}
                placeholder='如：大众'
                value={form.brand}
                onInput={(e) => setForm((prev) => ({ ...prev, brand: e.detail.value }))}
              />
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>型号<Text className={styles.required}>*</Text></Text>
              <Input
                className={styles.formInput}
                placeholder='如：帕萨特'
                value={form.model}
                onInput={(e) => setForm((prev) => ({ ...prev, model: e.detail.value }))}
              />
            </View>
          </View>

          <View className={styles.formRow}>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>颜色</Text>
              <Input
                className={styles.formInput}
                placeholder='如：黑色'
                value={form.color}
                onInput={(e) => setForm((prev) => ({ ...prev, color: e.detail.value }))}
              />
            </View>
            <View className={styles.formItem}>
              <Text className={styles.formLabel}>车主<Text className={styles.required}>*</Text></Text>
              <Input
                className={styles.formInput}
                placeholder='车主姓名'
                value={form.ownerName}
                onInput={(e) => setForm((prev) => ({ ...prev, ownerName: e.detail.value }))}
              />
            </View>
          </View>

          <View className={styles.formItem}>
            <Text className={styles.formLabel}>联系电话<Text className={styles.required}>*</Text></Text>
            <Input
              className={styles.formInput}
              type='number'
              placeholder='手机号码'
              value={form.ownerPhone}
              onInput={(e) => setForm((prev) => ({ ...prev, ownerPhone: e.detail.value }))}
              maxLength={11}
            />
          </View>
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>选择工位<Text className={styles.required}>*</Text></Text>
          {availableStations.length === 0 ? (
            <View className={styles.empty}>暂无可用工位</View>
          ) : (
            <View className={styles.stationList}>
              {availableStations.map((station) => (
                <View
                  key={station.id}
                  className={classnames(styles.stationOption, { [styles.selected]: form.stationId === station.id })}
                  onClick={() => handleStationSelect(station)}
                >
                  <View className={styles.stationInfo}>
                    <Text className={styles.stationName}>{station.name}</Text>
                    <Text className={styles.stationMeta}>
                      {station.type} · 承重{station.capacity}吨 · {station.description}
                    </Text>
                  </View>
                  <StatusTag status={station.status} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>服务类型<Text className={styles.required}>*</Text></Text>
          <View className={styles.serviceTypeGrid}>
            {serviceTypes.map((item) => (
              <View
                key={item.key}
                className={classnames(styles.serviceTypeItem, { [styles.selected]: form.serviceType === item.key })}
                onClick={() => handleServiceTypeSelect(item.key)}
              >
                <Text className={styles.serviceTypeIcon}>{item.icon}</Text>
                <Text className={styles.serviceTypeText}>{item.key}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>预约时段<Text className={styles.required}>*</Text></Text>

          <View className={styles.formItem}>
            <Text className={styles.formLabel}>预约日期</Text>
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

          {form.stationId && scheduleData ? (
            <>
              {recommendedBlocks.length > 0 && (
                <View className={styles.formItem}>
                  <Text className={styles.formLabel}>
                    推荐连续空档（点击快速选择）
                  </Text>
                  <View className={styles.recommendList}>
                    {recommendedBlocks.map((block, idx) => (
                      <View
                        key={`rec-${idx}`}
                        className={styles.recommendItem}
                        onClick={() => handleRecommendSelect(block)}
                      >
                        <Text className={styles.recommendTime}>
                          {block.startTime} - {block.endTime}
                        </Text>
                        <Text className={styles.recommendMeta}>
                          {block.slotCount}个时段 · {block.duration}分钟
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View className={styles.formItem}>
                <Text className={styles.formLabel}>
                  选择时段（可多选，相邻时段自动合并）
                </Text>
                {hasConflict && (
                  <View className={styles.conflictAlert}>
                    ⚠️ 时段 {slotConflicts.conflictingSlots.join('、')} 已被占用，请重新选择
                  </View>
                )}
                <View className={styles.timeSlotGrid}>
                  {scheduleData.timeSlots.map((item) => {
                    const isConflict = slotConflicts.conflictingSlots.includes(item.slot.startTime);
                    return (
                      <View
                        key={item.slot.id}
                        className={classnames(
                          styles.timeSlotItem,
                          getSlotStatusClass(item.slot.startTime, item.isAvailable),
                          { [styles.conflict]: isConflict }
                        )}
                        onClick={() => handleSlotClick(item.slot.startTime, item.isAvailable)}
                      >
                        {item.slot.startTime}
                      </View>
                    );
                  })}
                </View>
              </View>

              {selectedSlots.length > 0 && (
                <View className={styles.summaryCard}>
                  <View className={styles.summaryRow}>
                    <Text className={styles.summaryLabel}>已选时段</Text>
                    <Text className={styles.summaryValue}>{mergedSlotDisplay}</Text>
                  </View>
                  {slotConflicts.selectedBlocks.length > 1 && (
                    <View className={styles.blockList}>
                      <Text className={styles.blockLabel}>占用分段：</Text>
                      {slotConflicts.selectedBlocks.map((block, idx) => (
                        <View key={idx} className={styles.blockItem}>
                          <Text className={styles.blockTime}>
                            第{idx + 1}段：{block.startTime} - {block.endTime}
                          </Text>
                          <Text className={styles.blockMeta}>
                            ({block.slotCount}个时段 · {block.duration}分钟)
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View className={styles.summaryRow}>
                    <Text className={styles.summaryLabel}>时段数量</Text>
                    <Text className={styles.summaryValue}>
                      {selectedSlots.length} 个
                      {isMergedSelection && selectedSlots.length > 1 && ' · 已合并'}
                      {!isMergedSelection && selectedSlots.length > 1 && ` · ${slotConflicts.selectedBlocks.length}段`}
                    </Text>
                  </View>
                  <View className={styles.summaryRow}>
                    <Text className={styles.summaryLabel}>预计时长</Text>
                    <Text className={styles.summaryValue}>{estimatedDuration} 分钟</Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View className={styles.empty}>请先选择工位</View>
          )}
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>故障描述</Text>
          <View className={styles.formItem}>
            <Text className={styles.formLabel}>快速选择</Text>
            <View className={styles.quickInputs}>
              {quickDescriptions.map((desc) => (
                <View
                  key={desc}
                  className={styles.quickTag}
                  onClick={() => handleQuickDescription(desc)}
                >
                  {desc}
                </View>
              ))}
            </View>
          </View>
          <View className={styles.formItem}>
            <Text className={styles.formLabel}>详细描述</Text>
            <Textarea
              className={styles.formTextarea}
              placeholder='请详细描述故障情况...'
              value={form.description}
              onInput={(e) => setForm((prev) => ({ ...prev, description: e.detail.value }))}
              maxlength={500}
            />
          </View>
          <View className={styles.formItem}>
            <Text className={styles.formLabel}>备注</Text>
            <Textarea
              className={styles.formTextarea}
              placeholder='其他需要说明的信息...'
              value={form.notes}
              onInput={(e) => setForm((prev) => ({ ...prev, notes: e.detail.value }))}
              maxlength={200}
            />
          </View>
        </View>
      </ScrollView>

      <View className={styles.bottomActions}>
        <Button
          className={classnames(styles.actionBtn, styles.secondary)}
          onClick={() => Taro.navigateBack()}
        >
          取消
        </Button>
        <Button
          className={classnames(styles.actionBtn, styles.primary)}
          onClick={handleSubmit}
        >
          创建维修单
        </Button>
      </View>
    </View>
  );
};

export default RepairCreatePage;
