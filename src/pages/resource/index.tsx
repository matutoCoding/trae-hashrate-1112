import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, Input, Switch, ScrollView, Textarea, Picker } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import StatusTag from '@/components/StatusTag';
import type { Station, StationStatus } from '@/types';

const ResourcePage: React.FC = () => {
  const { stations, config, addStation, updateStation, deleteStation, updateConfig } = useAppStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    type: '双柱举升机',
    capacity: '3500',
    description: '',
    status: 'available' as StationStatus
  });

  const stats = useMemo(() => {
    return {
      total: stations.length,
      available: stations.filter((s) => s.status === 'available').length,
      maintenance: stations.filter((s) => s.status === 'maintenance').length,
      occupied: stations.filter((s) => s.status === 'occupied').length
    };
  }, [stations]);

  const handleInputChange = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAddStation = useCallback(() => {
    setEditingStation(null);
    setFormData({
      name: '',
      number: '',
      type: '双柱举升机',
      capacity: '3500',
      description: '',
      status: 'available'
    });
    setShowAddModal(true);
  }, []);

  const handleEditStation = useCallback((station: Station) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      number: station.number,
      type: station.type,
      capacity: String(station.capacity),
      description: station.description,
      status: station.status
    });
    setShowAddModal(true);
  }, []);

  const handleDeleteStation = useCallback((station: Station) => {
    Taro.showModal({
      title: '确认删除',
      content: `确定删除工位 "${station.name}" 吗？`,
      confirmText: '确认删除',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          deleteStation(station.id);
          Taro.showToast({ title: '删除成功', icon: 'success' });
        }
      }
    });
  }, [deleteStation]);

  const handleSubmit = useCallback(() => {
    if (!formData.name.trim()) {
      Taro.showToast({ title: '请输入工位名称', icon: 'none' });
      return;
    }
    if (!formData.number.trim()) {
      Taro.showToast({ title: '请输入工位编号', icon: 'none' });
      return;
    }

    const stationData = {
      name: formData.name.trim(),
      number: formData.number.trim(),
      type: formData.type,
      status: formData.status,
      capacity: Number(formData.capacity) || 3500,
      description: formData.description.trim()
    };

    if (editingStation) {
      updateStation(editingStation.id, stationData);
      Taro.showToast({ title: '更新成功', icon: 'success' });
    } else {
      addStation(stationData);
      Taro.showToast({ title: '添加成功', icon: 'success' });
    }

    setShowAddModal(false);
  }, [formData, editingStation, addStation, updateStation]);

  const handleConfigChange = useCallback((key: string, value: any) => {
    updateConfig({ [key]: value });
  }, [updateConfig]);

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 500);
  });

  useDidShow(() => {
    console.log('[ResourcePage] 页面显示');
  });

  const stationTypes = ['双柱举升机', '四柱举升机', '剪式举升机', '地藏式举升机', '大梁校正仪'];
  const statusOptions = [
    { value: 'available', label: '空闲可用' },
    { value: 'occupied', label: '占用中' },
    { value: 'maintenance', label: '维护中' }
  ];

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>资源管理</Text>
        <Text className={styles.subtitle}>工位资源与系统配置管理</Text>

        <View className={styles.stats}>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{stats.total}</Text>
            <Text className={styles.statLabel}>总工位</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue} style={{ color: '#95DE64' }}>{stats.available}</Text>
            <Text className={styles.statLabel}>可用</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue} style={{ color: '#FFD666' }}>{stats.maintenance}</Text>
            <Text className={styles.statLabel}>维护</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue} style={{ color: '#69B1FF' }}>{stats.occupied}</Text>
            <Text className={styles.statLabel}>占用</Text>
          </View>
        </View>
      </View>

      <View className={styles.content}>
        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>系统配置</Text>
          </View>

          <View className={styles.configItem}>
            <Text className={styles.configLabel}>最大过号次数</Text>
            <Input
              className={styles.configInput}
              type='number'
              value={String(config.maxSkipCount)}
              onInput={(e) => handleConfigChange('maxSkipCount', Number(e.detail.value))}
            />
          </View>

          <View className={styles.configItem}>
            <Text className={styles.configLabel}>营业时间开始</Text>
            <Input
              className={styles.configInput}
              value={config.businessHours.start}
              onInput={(e) => handleConfigChange('businessHours', { ...config.businessHours, start: e.detail.value })}
              placeholder='08:00'
            />
          </View>

          <View className={styles.configItem}>
            <Text className={styles.configLabel}>营业时间结束</Text>
            <Input
              className={styles.configInput}
              value={config.businessHours.end}
              onInput={(e) => handleConfigChange('businessHours', { ...config.businessHours, end: e.detail.value })}
              placeholder='18:00'
            />
          </View>

          <View className={styles.configItem}>
            <Text className={styles.configLabel}>时段时长（分钟）</Text>
            <Input
              className={styles.configInput}
              type='number'
              value={String(config.timeSlotDuration)}
              onInput={(e) => handleConfigChange('timeSlotDuration', Number(e.detail.value))}
            />
          </View>

          <View className={styles.configItem}>
            <Text className={styles.configLabel}>自动合并相邻时段</Text>
            <Switch
              className={styles.switch}
              checked={config.autoMergeEnabled}
              onChange={(e) => handleConfigChange('autoMergeEnabled', e.detail.value)}
              color='#1677FF'
            />
          </View>
        </View>

        <View className={styles.section}>
          <View className={styles.sectionHeader}>
            <Text className={styles.sectionTitle}>工位列表</Text>
            <Button className={styles.addBtn} onClick={handleAddStation}>
              + 添加工位
            </Button>
          </View>

          <ScrollView scrollY>
            {stations.length === 0 ? (
              <View className={styles.empty}>
                <Text>暂无工位数据</Text>
              </View>
            ) : (
              stations.map((station) => (
                <View key={station.id} className={styles.stationItem}>
                  <View className={styles.stationInfo}>
                    <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
                      <Text className={styles.stationName}>{station.name}</Text>
                      <StatusTag status={station.status} />
                    </View>
                    <Text className={styles.stationMeta}>
                      {station.number} · {station.type} · 载重 {station.capacity}kg
                    </Text>
                  </View>
                  <View className={styles.stationActions}>
                    <Button
                      className={classnames(styles.actionBtn, styles.edit)}
                      onClick={() => handleEditStation(station)}
                    >
                      编辑
                    </Button>
                    <Button
                      className={classnames(styles.actionBtn, styles.delete)}
                      onClick={() => handleDeleteStation(station)}
                    >
                      删除
                    </Button>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>

      <Button className={styles.floatingBtn} onClick={handleAddStation}>
        +
      </Button>

      {showAddModal && (
        <View className={styles.modal}>
          <View className={styles.modalContent}>
            <Text className={styles.modalTitle}>
              {editingStation ? '编辑工位' : '添加工位'}
            </Text>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>工位名称</Text>
              <Input
                className={styles.formInput}
                placeholder='如：举升机1号'
                value={formData.name}
                onInput={(e) => handleInputChange('name', e.detail.value)}
              />
            </View>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>工位编号</Text>
              <Input
                className={styles.formInput}
                placeholder='如：JSJ-001'
                value={formData.number}
                onInput={(e) => handleInputChange('number', e.detail.value)}
              />
            </View>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>设备类型</Text>
              <Picker
                mode='selector'
                range={stationTypes}
                value={stationTypes.indexOf(formData.type)}
                onChange={(e) => handleInputChange('type', stationTypes[e.detail.value])}
              >
                <View className={styles.formInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text>{formData.type}</Text>
                  <Text style={{ color: 'var(--color-text-tertiary, #86909C)' }}>›</Text>
                </View>
              </Picker>
            </View>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>载重（kg）</Text>
              <Input
                className={styles.formInput}
                type='number'
                placeholder='3500'
                value={formData.capacity}
                onInput={(e) => handleInputChange('capacity', e.detail.value)}
              />
            </View>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>状态</Text>
              <Picker
                mode='selector'
                range={statusOptions.map((o) => o.label)}
                value={statusOptions.findIndex((o) => o.value === formData.status)}
                onChange={(e) => handleInputChange('status', statusOptions[e.detail.value].value as StationStatus)}
              >
                <View className={styles.formInput} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text>{statusOptions.find((o) => o.value === formData.status)?.label}</Text>
                  <Text style={{ color: 'var(--color-text-tertiary, #86909C)' }}>›</Text>
                </View>
              </Picker>
            </View>

            <View className={styles.formItem}>
              <Text className={styles.formLabel}>备注说明</Text>
              <Textarea
                className={styles.formTextarea}
                placeholder='输入工位描述或备注...'
                value={formData.description}
                onInput={(e) => handleInputChange('description', e.detail.value)}
              />
            </View>

            <View className={styles.modalActions}>
              <Button
                className={classnames(styles.modalBtn, styles.cancel)}
                onClick={() => setShowAddModal(false)}
              >
                取消
              </Button>
              <Button
                className={classnames(styles.modalBtn, styles.confirm)}
                onClick={handleSubmit}
              >
                {editingStation ? '确认更新' : '确认添加'}
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default ResourcePage;
