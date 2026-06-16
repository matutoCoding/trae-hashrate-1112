import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, Input, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import dayjs from 'dayjs';
import styles from './index.module.scss';
import useAppStore from '@/store/useAppStore';
import RepairCard from '@/components/RepairCard';
import type { RepairStatus } from '@/types';

type TabType = 'all' | RepairStatus;

const tabs: { key: TabType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'in_progress', label: '维修中' },
  { key: 'queuing', label: '排队中' },
  { key: 'pending', label: '待排期' },
  { key: 'completed', label: '已完成' },
  { key: 'cancelled', label: '已取消' }
];

const RepairPage: React.FC = () => {
  const { repairOrders } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  const stats = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    const todayOrders = repairOrders.filter((o) =>
      dayjs(o.createdAt).isSame(today, 'day')
    );

    return {
      today: todayOrders.length,
      inProgress: repairOrders.filter((o) => o.status === 'in_progress').length,
      completed: repairOrders.filter((o) => o.status === 'completed').length,
      total: repairOrders.length
    };
  }, [repairOrders]);

  const filteredOrders = useMemo(() => {
    let orders = [...repairOrders];

    if (activeTab !== 'all') {
      orders = orders.filter((o) => o.status === activeTab);
    }

    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      orders = orders.filter((o) =>
        o.orderNumber.toLowerCase().includes(keyword) ||
        o.vehicle.plateNumber.toLowerCase().includes(keyword) ||
        o.vehicle.ownerName.toLowerCase().includes(keyword) ||
        o.vehicle.brand.toLowerCase().includes(keyword) ||
        o.vehicle.model.toLowerCase().includes(keyword)
      );
    }

    return orders.sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }, [repairOrders, activeTab, searchKeyword]);

  const handleSearch = useCallback(() => {
    console.log('[RepairPage] 搜索:', searchKeyword);
  }, [searchKeyword]);

  const handleAddRepair = useCallback(() => {
    Taro.navigateTo({
      url: '/pages/repair-create/index'
    });
  }, []);

  usePullDownRefresh(() => {
    setTimeout(() => {
      Taro.stopPullDownRefresh();
    }, 500);
  });

  useDidShow(() => {
    console.log('[RepairPage] 页面显示');
  });

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>维修管理</Text>
        <Text className={styles.subtitle}>今日工单状态概览</Text>

        <View className={styles.stats}>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{stats.today}</Text>
            <Text className={styles.statLabel}>今日新增</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue} style={{ color: '#FFD666' }}>{stats.inProgress}</Text>
            <Text className={styles.statLabel}>维修中</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue} style={{ color: '#95DE64' }}>{stats.completed}</Text>
            <Text className={styles.statLabel}>已完成</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statValue}>{stats.total}</Text>
            <Text className={styles.statLabel}>总工单</Text>
          </View>
        </View>
      </View>

      <View className={styles.content}>
        <ScrollView scrollX className={styles.tabs}>
          {tabs.map((tab) => (
            <View
              key={tab.key}
              className={classnames(styles.tabItem, {
                [styles.active]: activeTab === tab.key
              })}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </View>
          ))}
        </ScrollView>

        <View className={styles.searchBar}>
          <Input
            className={styles.searchInput}
            placeholder='搜索工单号、车牌号、车主...'
            value={searchKeyword}
            onInput={(e) => setSearchKeyword(e.detail.value)}
            confirmType='search'
            onConfirm={handleSearch}
          />
          <Button className={styles.searchBtn} onClick={handleSearch}>
            搜索
          </Button>
        </View>

        <View className={styles.sectionTitle}>
          <Text className={styles.titleText}>
            {tabs.find((t) => t.key === activeTab)?.label || '全部工单'}
          </Text>
          <Text className={styles.countBadge}>
            {filteredOrders.length} 条
          </Text>
        </View>

        <ScrollView scrollY>
          {filteredOrders.length === 0 ? (
            <View className={styles.empty}>
              <Text>暂无工单数据</Text>
            </View>
          ) : (
            filteredOrders.map((repair) => (
              <RepairCard key={repair.id} repair={repair} />
            ))
          )}
        </ScrollView>
      </View>

      <Button className={styles.floatingBtn} onClick={handleAddRepair}>
        +
      </Button>
    </View>
  );
};

export default RepairPage;
