import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, Input, ScrollView, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import StatusTag from '@/components/StatusTag';
import { formatTimeDisplay } from '@/utils/schedule';

const RepairDetailPage: React.FC = () => {
  const router = useRouter();
  const orderId = router.params.id;

  const {
    repairOrders,
    updateRepairOrder,
    splitTimeSlot,
    addPart,
    addQueueItem,
    config
  } = useAppStore();

  const [showPartModal, setShowPartModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitTime, setSplitTime] = useState('');
  const [partForm, setPartForm] = useState({
    name: '',
    partNumber: '',
    quantity: '1',
    unit: '个',
    price: ''
  });

  const repair = useMemo(() => {
    return repairOrders.find((o) => o.id === orderId || o.id === `merged-${orderId}`);
  }, [repairOrders, orderId]);

  const displaySlot = useMemo(() => {
    if (!repair || repair.timeSlots.length === 0) return null;
    if (repair.mergedSlot) return repair.mergedSlot;
    const sorted = [...repair.timeSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return {
      id: 'display',
      startTime: sorted[0].startTime,
      endTime: sorted[sorted.length - 1].endTime
    };
  }, [repair]);

  const totalPartsAmount = useMemo(() => {
    if (!repair) return 0;
    return repair.parts.reduce((sum, p) => sum + p.price * p.quantity, 0);
  }, [repair]);

  const handleAddPart = useCallback(() => {
    setShowPartModal(true);
  }, []);

  const handleSplit = useCallback(() => {
    if (!displaySlot) return;
    setSplitTime(displaySlot.startTime);
    setShowSplitModal(true);
  }, [displaySlot]);

  const handleConfirmSplit = useCallback(() => {
    if (!repair || !splitTime || !displaySlot) return;

    const start = dayjs(`2024-01-01 ${displaySlot.startTime}`);
    const end = dayjs(`2024-01-01 ${displaySlot.endTime}`);
    const split = dayjs(`2024-01-01 ${splitTime}`);

    if (split.isSame(start) || split.isSame(end) || split.isBefore(start) || split.isAfter(end)) {
      Taro.showToast({
        title: `请选择 ${displaySlot.startTime} - ${displaySlot.endTime} 之间的时间`,
        icon: 'none',
        duration: 2500
      });
      return;
    }

    const success = splitTimeSlot(repair.id, splitTime);
    if (success) {
      setShowSplitModal(false);
      Taro.showToast({ title: '拆分成功，后续时段已释放', icon: 'success' });
    } else {
      Taro.showToast({
        title: '拆分失败，请重新选择有效时间',
        icon: 'none',
        duration: 2000
      });
    }
  }, [repair, splitTime, splitTimeSlot, displaySlot]);

  const handleSubmitPart = useCallback(() => {
    if (!repair || !partForm.name.trim()) {
      Taro.showToast({ title: '请输入配件名称', icon: 'none' });
      return;
    }
    if (!partForm.price) {
      Taro.showToast({ title: '请输入配件价格', icon: 'none' });
      return;
    }

    const partData = {
      name: partForm.name.trim(),
      partNumber: partForm.partNumber.trim(),
      quantity: Number(partForm.quantity) || 1,
      unit: partForm.unit,
      price: Number(partForm.price) || 0,
      pickupTime: dayjs().toISOString(),
      operator: '当前操作员'
    };

    addPart(repair.id, partData);
    setShowPartModal(false);
    setPartForm({ name: '', partNumber: '', quantity: '1', unit: '个', price: '' });
    Taro.showToast({ title: '登记成功', icon: 'success' });
  }, [repair, partForm, addPart]);

  const handleAddToQueue = useCallback(() => {
    if (!repair) return;
    addQueueItem(repair.id);
    Taro.showToast({ title: '已加入排队', icon: 'success' });
  }, [repair, addQueueItem]);

  const handleComplete = useCallback(() => {
    if (!repair) return;
    Taro.showModal({
      title: '确认完成',
      content: '确定将该维修单标记为已完成吗？',
      confirmText: '确认完成',
      confirmColor: '#52C41A',
      success: (res) => {
        if (res.confirm) {
          updateRepairOrder(repair.id, {
            status: 'completed',
            actualEndTime: dayjs().toISOString()
          });
          Taro.showToast({ title: '已完成', icon: 'success' });
        }
      }
    });
  }, [repair, updateRepairOrder]);

  const handleCancel = useCallback(() => {
    if (!repair) return;
    Taro.showModal({
      title: '取消维修单',
      content: '确定取消该维修单吗？此操作不可恢复。',
      confirmText: '确认取消',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          updateRepairOrder(repair.id, { status: 'cancelled' });
          Taro.showToast({ title: '已取消', icon: 'success' });
          setTimeout(() => Taro.navigateBack(), 500);
        }
      }
    });
  }, [repair, updateRepairOrder]);

  useDidShow(() => {
    console.log('[RepairDetailPage] 页面显示，工单ID:', orderId);
  });

  if (!repair) {
    return (
      <View className={styles.page}>
        <View className={styles.empty} style={{ margin: '32rpx' }}>
          <Text>维修单不存在</Text>
        </View>
      </View>
    );
  }

  const timeOptions = [];
  if (displaySlot) {
    let current = dayjs(`2024-01-01 ${displaySlot.startTime}`);
    const end = dayjs(`2024-01-01 ${displaySlot.endTime}`);
    while (current.isBefore(end)) {
      timeOptions.push(current.format('HH:mm'));
      current = current.add(config.timeSlotDuration, 'minute');
    }
  }

  return (
    <View className={styles.page}>
      <ScrollView scrollY>
        <View className={styles.headerCard}>
          <View className={styles.orderHeader}>
            <View>
              <Text className={styles.orderNumber}>{repair.orderNumber}</Text>
              <Text className={styles.createTime}>
                创建时间: {dayjs(repair.createdAt).format('YYYY-MM-DD HH:mm')}
              </Text>
            </View>
            <StatusTag status={repair.status} />
          </View>

          <View className={styles.vehicleCard}>
            <Text className={styles.plate}>{repair.vehicle.plateNumber}</Text>
            <View className={styles.vehicleInfo}>
              <Text className={styles.brandModel}>
                {repair.vehicle.brand} {repair.vehicle.model} · {repair.vehicle.color}
              </Text>
              <Text className={styles.owner}>
                {repair.vehicle.ownerName} {repair.vehicle.ownerPhone}
              </Text>
            </View>
          </View>

          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>服务类型</Text>
            <Text className={styles.infoValue}>{repair.serviceType}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>故障描述</Text>
            <Text className={styles.infoValue}>{repair.description}</Text>
          </View>
          {repair.notes && (
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>备注</Text>
              <Text className={styles.infoValue}>{repair.notes}</Text>
            </View>
          )}
          {repair.skipCount > 0 && (
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>过号记录</Text>
              <Text className={styles.infoValue} style={{ color: 'var(--color-warning, #FAAD14)' }}>
                已过号 {repair.skipCount}/{config.maxSkipCount} 次
              </Text>
            </View>
          )}
        </View>

        <View className={styles.section}>
          <View className={styles.sectionTitle}>预约时段</View>
          {displaySlot && (
            <View className={styles.timeSlot}>
              <View>
                <Text className={styles.timeRange}>
                  {formatTimeDisplay(displaySlot.startTime, displaySlot.endTime)}
                </Text>
                {repair.mergedSlot && (
                  <Text className={styles.mergedBadge}>已合并 {repair.timeSlots.length} 个时段</Text>
                )}
              </View>
              <Text className={styles.duration}>预计 {repair.estimatedDuration} 分钟</Text>
            </View>
          )}
          {repair.actualStartTime && (
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>实际开始</Text>
              <Text className={styles.infoValue}>
                {dayjs(repair.actualStartTime).format('YYYY-MM-DD HH:mm')}
              </Text>
            </View>
          )}
          {repair.actualEndTime && (
            <View className={styles.infoRow}>
              <Text className={styles.infoLabel}>实际结束</Text>
              <Text className={styles.infoValue}>
                {dayjs(repair.actualEndTime).format('YYYY-MM-DD HH:mm')}
              </Text>
            </View>
          )}

          {(repair.status === 'in_progress' || repair.status === 'pending') && (
            <View className={styles.actionSection} style={{ marginTop: '16rpx' }}>
              <Button
                className={classnames(styles.actionBtn, styles.warning)}
                onClick={handleSplit}
              >
                拆分占用时段（提前结束）
              </Button>
            </View>
          )}
        </View>

        <View className={styles.section}>
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16rpx' }}>
            <Text className={styles.sectionTitle}>配件领用</Text>
            {(repair.status === 'in_progress' || repair.status === 'pending') && (
              <Button
                className={classnames(styles.actionBtn, styles.primary)}
                style={{ width: 'auto', height: '56rpx', padding: '0 24rpx' }}
                onClick={handleAddPart}
              >
                + 登记配件
              </Button>
            )}
          </View>

          {repair.parts.length === 0 ? (
            <View className={styles.empty}>
              <Text>暂无配件领用记录</Text>
            </View>
          ) : (
            <>
              {repair.parts.map((part) => (
                <View key={part.id} className={styles.partItem}>
                  <View className={styles.partInfo}>
                    <Text className={styles.partName}>{part.name}</Text>
                    <Text className={styles.partMeta}>
                      编号: {part.partNumber} · {part.quantity}{part.unit} · {part.operator} · {dayjs(part.pickupTime).format('HH:mm')}
                    </Text>
                  </View>
                  <Text className={styles.partPrice}>¥{(part.price * part.quantity).toFixed(2)}</Text>
                </View>
              ))}
              <View className={styles.totalRow}>
                <Text className={styles.totalLabel}>配件总计</Text>
                <Text className={styles.totalValue}>¥{totalPartsAmount.toFixed(2)}</Text>
              </View>
            </>
          )}
        </View>

        <View className={styles.section}>
          <Text className={styles.sectionTitle}>操作记录</Text>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>创建人</Text>
            <Text className={styles.infoValue}>{repair.createdBy}</Text>
          </View>
          <View className={styles.infoRow}>
            <Text className={styles.infoLabel}>创建时间</Text>
            <Text className={styles.infoValue}>
              {dayjs(repair.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {(repair.status === 'pending' || repair.status === 'queuing' || repair.status === 'in_progress') && (
        <View className={styles.bottomActions}>
          {repair.status === 'pending' && (
            <Button
              className={classnames(styles.actionBtn, styles.primary)}
              onClick={handleAddToQueue}
            >
              加入排队
            </Button>
          )}
          {repair.status === 'in_progress' && (
            <Button
              className={classnames(styles.actionBtn, styles.success)}
              onClick={handleComplete}
            >
              完成维修
            </Button>
          )}
          {(repair.status === 'pending' || repair.status === 'queuing') && (
            <Button
              className={classnames(styles.actionBtn, styles.danger)}
              onClick={handleCancel}
            >
              取消工单
            </Button>
          )}
        </View>
      )}

      {showPartModal && (
        <View className={styles.modal}>
          <View className={styles.modalContent}>
            <Text className={styles.modalTitle}>登记配件领用</Text>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>配件名称 *</Text>
              <Input
                className={styles.formInput}
                placeholder='如：全合成机油 5W-40'
                value={partForm.name}
                onInput={(e) => setPartForm((prev) => ({ ...prev, name: e.detail.value }))}
              />
            </View>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>配件编号</Text>
              <Input
                className={styles.formInput}
                placeholder='如：OIL-001'
                value={partForm.partNumber}
                onInput={(e) => setPartForm((prev) => ({ ...prev, partNumber: e.detail.value }))}
              />
            </View>

            <View style={{ display: 'flex', gap: '16rpx' }}>
              <View className={styles.formItem} style={{ flex: 1 }}>
                <Text className={styles.formLabel}>数量</Text>
                <Input
                  className={styles.formInput}
                  type='digit'
                  placeholder='1'
                  value={partForm.quantity}
                  onInput={(e) => setPartForm((prev) => ({ ...prev, quantity: e.detail.value }))}
                />
              </View>
              <View className={styles.formItem} style={{ flex: 1 }}>
                <Text className={styles.formLabel}>单位</Text>
                <Input
                  className={styles.formInput}
                  placeholder='个'
                  value={partForm.unit}
                  onInput={(e) => setPartForm((prev) => ({ ...prev, unit: e.detail.value }))}
                />
              </View>
            </View>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>单价（元）*</Text>
              <Input
                className={styles.formInput}
                type='digit'
                placeholder='0.00'
                value={partForm.price}
                onInput={(e) => setPartForm((prev) => ({ ...prev, price: e.detail.value }))}
              />
            </View>

            <View className={styles.modalActions}>
              <Button
                className={classnames(styles.modalBtn, styles.cancel)}
                onClick={() => setShowPartModal(false)}
              >
                取消
              </Button>
              <Button
                className={classnames(styles.modalBtn, styles.confirm)}
                onClick={handleSubmitPart}
              >
                确认登记
              </Button>
            </View>
          </View>
        </View>
      )}

      {showSplitModal && displaySlot && (
        <View className={styles.modal}>
          <View className={styles.modalContent}>
            <Text className={styles.modalTitle}>拆分占用时段</Text>
            <Text style={{ textAlign: 'center', color: 'var(--color-text-secondary, #4E5969)', fontSize: '28rpx', marginBottom: '32rpx' }}>
              选择实际结束时间，系统将拆分时段并释放后续时间
            </Text>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>当前时段</Text>
              <View style={{ padding: '20rpx', background: 'var(--color-bg-page, #F5F7FA)', borderRadius: '12rpx' }}>
                <Text style={{ fontSize: '28rpx', color: 'var(--color-primary, #1677FF)', fontWeight: '600' }}>
                  {displaySlot.startTime} - {displaySlot.endTime}
                </Text>
              </View>
            </View>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>拆分时间（实际结束）*</Text>
              <Picker
                mode='selector'
                range={timeOptions}
                value={timeOptions.indexOf(splitTime)}
                onChange={(e) => setSplitTime(timeOptions[e.detail.value])}
              >
                <View className={styles.formInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text>{splitTime}</Text>
                  <Text style={{ color: 'var(--color-text-tertiary, #86909C)' }}>›</Text>
                </View>
              </Picker>
            </View>

            <View className={styles.modalActions}>
              <Button
                className={classnames(styles.modalBtn, styles.cancel)}
                onClick={() => setShowSplitModal(false)}
              >
                取消
              </Button>
              <Button
                className={classnames(styles.modalBtn, styles.confirm)}
                onClick={handleConfirmSplit}
              >
                确认拆分
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default RepairDetailPage;
