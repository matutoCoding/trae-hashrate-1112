import { create } from 'zustand';
import dayjs from 'dayjs';
import Taro from '@tarojs/taro';
import type { AppState, AppActions, Station, RepairOrder, QueueItem, PartItem, TimeSlot } from '@/types';
import { mockStations } from '@/data/mockStations';
import { mockRepairs } from '@/data/mockRepairs';
import { mockQueue } from '@/data/mockQueue';
import {
  generateTimeSlots,
  findMergedOrderSlots,
  getAvailableTimeSlots,
  splitTimeSlot as splitSlotUtil,
  mergeTimeSlots as mergeSlotsUtil,
  isSlotOccupiedByOrder
} from '@/utils/schedule';
import {
  createQueueItem,
  handleSkip,
  reorderSkippedItems,
  getNextCallNumber
} from '@/utils/queue';

const STORAGE_KEY = 'auto_repair_schedule_data_v1';

const initialConfig = {
  maxSkipCount: 3,
  businessHours: {
    start: '08:00',
    end: '18:00'
  },
  timeSlotDuration: 30,
  autoMergeEnabled: true
};

const loadFromStorage = () => {
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        stations: parsed.stations || mockStations,
        repairOrders: parsed.repairOrders || mockRepairs,
        queue: parsed.queue || mockQueue,
        config: parsed.config || initialConfig,
        selectedDate: parsed.selectedDate || dayjs().format('YYYY-MM-DD'),
        currentCallingNumber: parsed.currentCallingNumber ?? 1
      };
    }
  } catch (e) {
    console.warn('[Storage] 读取本地数据失败:', e);
  }
  return null;
};

const saveToStorage = (state: Partial<AppState>) => {
  try {
    const existing = loadFromStorage() || {};
    const toSave = { ...existing, ...state };
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('[Storage] 保存本地数据失败:', e);
  }
};

const persistedInitial = loadFromStorage();

const useAppStore = create<AppState & AppActions>((set, get) => ({
  stations: persistedInitial?.stations || mockStations,
  repairOrders: persistedInitial?.repairOrders || mockRepairs,
  queue: persistedInitial?.queue || mockQueue,
  config: persistedInitial?.config || initialConfig,
  selectedDate: persistedInitial?.selectedDate || dayjs().format('YYYY-MM-DD'),
  currentCallingNumber: persistedInitial?.currentCallingNumber ?? 1,

  addStation: (station) => {
    const newStation: Station = {
      ...station,
      id: `station-${Date.now()}`,
      createdAt: dayjs().toISOString()
    };
    set((state) => {
      const newStations = [...state.stations, newStation];
      saveToStorage({ stations: newStations });
      return { stations: newStations };
    });
    console.log('[Station] 新增工位:', newStation);
  },

  updateStation: (id, updates) => {
    set((state) => {
      const newStations = state.stations.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      saveToStorage({ stations: newStations });
      return { stations: newStations };
    });
    console.log('[Station] 更新工位:', id, updates);
  },

  deleteStation: (id) => {
    set((state) => {
      const newStations = state.stations.filter((s) => s.id !== id);
      saveToStorage({ stations: newStations });
      return { stations: newStations };
    });
    console.log('[Station] 删除工位:', id);
  },

  createRepairOrder: (order) => {
    const state = get();
    const newOrder: RepairOrder = {
      ...order,
      id: `repair-${Date.now()}`,
      orderNumber: `WX${dayjs().format('YYYYMMDDHHmmss')}`,
      scheduleDate: order.scheduleDate || state.selectedDate,
      skipCount: 0,
      isSkipped: false,
      createdAt: dayjs().toISOString()
    };
    set((s) => {
      const newRepairOrders = [...s.repairOrders, newOrder];
      saveToStorage({ repairOrders: newRepairOrders });
      return { repairOrders: newRepairOrders };
    });
    console.log('[Repair] 创建维修单:', newOrder.orderNumber, '预约日期:', newOrder.scheduleDate);
  },

  updateRepairOrder: (id, updates) => {
    set((state) => {
      const newRepairOrders = state.repairOrders.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      );
      saveToStorage({ repairOrders: newRepairOrders });
      return { repairOrders: newRepairOrders };
    });
    console.log('[Repair] 更新维修单:', id, updates);
  },

  splitTimeSlot: (orderId, splitTime): boolean => {
    const state = get();
    const order = state.repairOrders.find((o) => o.id === orderId);
    if (!order) return false;

    const date = order.scheduleDate;
    const allOccupiedSlots = order.mergedSlot
      ? [order.mergedSlot]
      : order.timeSlots;

    if (allOccupiedSlots.length === 0) return false;

    const overallStart = allOccupiedSlots[0].startTime;
    const overallEnd = allOccupiedSlots[allOccupiedSlots.length - 1].endTime;

    const overallSlot = {
      id: 'overall',
      startTime: overallStart,
      endTime: overallEnd
    };

    const splitResult = splitSlotUtil(overallSlot, splitTime, date);
    if (!splitResult) {
      console.warn('[Schedule] 无效拆分点:', splitTime, '有效范围:', overallStart, '-', overallEnd);
      return false;
    }

    const { before, after } = splitResult;

    set((prev) => {
      const newRepairOrders = prev.repairOrders.map((o) => {
        if (o.id === orderId) {
          const keptSlots = order.timeSlots.filter((slot) => {
            const slotEnd = dayjs(`${date} ${slot.endTime}`);
            const splitPoint = dayjs(`${date} ${splitTime}`);
            return slotEnd.isBefore(splitPoint) || slotEnd.isSame(splitPoint);
          });

          const finalBefore: TimeSlot = keptSlots.length > 0
            ? keptSlots.length === 1
              ? keptSlots[0]
              : {
                  id: `kept-${Date.now()}`,
                  startTime: keptSlots[0].startTime,
                  endTime: before.endTime
                }
            : before;

          return {
            ...o,
            timeSlots: keptSlots.length > 0 ? keptSlots : [finalBefore],
            mergedSlot: undefined,
            status: 'completed' as const,
            actualEndTime: dayjs().toISOString()
          };
        }
        return o;
      });
      saveToStorage({ repairOrders: newRepairOrders });
      return { repairOrders: newRepairOrders };
    });

    console.log('[Schedule] 拆分时段成功:', orderId, '在', splitTime, '释放时间已空闲');
    return true;
  },

  mergeTimeSlots: (orderIds) => {
    const state = get();
    const orders = state.repairOrders.filter((o) => orderIds.includes(o.id));
    if (orders.length < 2) return;

    const allSlots = orders.flatMap((o) => o.timeSlots);
    const mergedSlot = mergeSlotsUtil(allSlots, state.selectedDate);
    if (!mergedSlot) return;

    const primaryOrder = orders[0];
    const otherOrderIds = orders.slice(1).map((o) => o.id);

    set((prev) => {
      const newRepairOrders = prev.repairOrders
        .filter((o) => !otherOrderIds.includes(o.id))
        .map((o) => {
          if (o.id === primaryOrder.id) {
            return {
              ...o,
              timeSlots: allSlots,
              mergedSlot,
              estimatedDuration: orders.reduce((sum, ord) => sum + ord.estimatedDuration, 0)
            };
          }
          return o;
        });
      saveToStorage({ repairOrders: newRepairOrders });
      return { repairOrders: newRepairOrders };
    });

    console.log('[Schedule] 合并时段:', orderIds);
  },

  addQueueItem: (repairOrderId) => {
    const state = get();
    const repairOrder = state.repairOrders.find((o) => o.id === repairOrderId);
    if (!repairOrder) return;

    const newQueueItem = createQueueItem(repairOrder, state.queue, state.config);
    set((prev) => {
      const newQueue = [...prev.queue, newQueueItem];
      saveToStorage({ queue: newQueue });
      return { queue: newQueue };
    });

    get().updateRepairOrder(repairOrderId, {
      status: 'queuing',
      queueNumber: newQueueItem.queueNumber
    });

    console.log('[Queue] 加入排队:', newQueueItem.queueNumber);
  },

  callNextNumber: () => {
    const state = get();
    const nextItem = getNextCallNumber(state.queue);
    if (!nextItem) {
      console.log('[Queue] 没有待叫号的车辆');
      return;
    }

    set((prev) => {
      const newQueue = prev.queue.map((item) => {
        if (item.id === nextItem.id) {
          return {
            ...item,
            status: 'called',
            calledAt: dayjs().toISOString()
          };
        }
        return item;
      });
      saveToStorage({ queue: newQueue, currentCallingNumber: nextItem.queueNumber });
      return {
        queue: newQueue,
        currentCallingNumber: nextItem.queueNumber
      };
    });

    get().updateRepairOrder(nextItem.repairOrderId, { status: 'queuing' });

    console.log('[Queue] 叫号:', nextItem.queueNumber, nextItem.vehicle.plateNumber);
  },

  markAsSkipped: (queueItemId) => {
    const state = get();
    const queueItem = state.queue.find((q) => q.id === queueItemId);
    if (!queueItem) return;

    const skippedItem = handleSkip(queueItem, state.config);

    set((prev) => {
      let newQueue = prev.queue.map((item) =>
        item.id === queueItemId ? skippedItem : item
      );

      if (skippedItem.status === 'cancelled') {
        get().updateRepairOrder(skippedItem.repairOrderId, { status: 'cancelled' });
        console.log('[Queue] 连续过号，自动作废:', skippedItem.queueNumber);
      } else {
        newQueue = reorderSkippedItems(newQueue);
      }

      saveToStorage({ queue: newQueue });
      return { queue: newQueue };
    });

    get().updateRepairOrder(skippedItem.repairOrderId, {
      skipCount: skippedItem.skipCount,
      isSkipped: true
    });

    console.log('[Queue] 过号处理:', skippedItem.queueNumber, '过号次数:', skippedItem.skipCount);
  },

  cancelQueueItem: (queueItemId) => {
    const state = get();
    const queueItem = state.queue.find((q) => q.id === queueItemId);
    if (!queueItem) return;

    set((prev) => {
      const newQueue = prev.queue.map((item) =>
        item.id === queueItemId ? { ...item, status: 'cancelled' } : item
      );
      saveToStorage({ queue: newQueue });
      return { queue: newQueue };
    });

    get().updateRepairOrder(queueItem.repairOrderId, { status: 'cancelled' });

    console.log('[Queue] 取消排队:', queueItem.queueNumber);
  },

  completeService: (queueItemId) => {
    const state = get();
    const queueItem = state.queue.find((q) => q.id === queueItemId);
    if (!queueItem) return;

    set((prev) => {
      const newQueue = prev.queue.map((item) =>
        item.id === queueItemId ? { ...item, status: 'completed' } : item
      );
      saveToStorage({ queue: newQueue });
      return { queue: newQueue };
    });

    get().updateRepairOrder(queueItem.repairOrderId, {
      status: 'completed',
      actualEndTime: dayjs().toISOString()
    });

    console.log('[Queue] 完成服务:', queueItem.queueNumber);
  },

  addPart: (repairOrderId, part) => {
    const newPart: PartItem = {
      ...part,
      id: `part-${Date.now()}`
    };

    set((prev) => {
      const newRepairOrders = prev.repairOrders.map((o) => {
        if (o.id === repairOrderId) {
          return {
            ...o,
            parts: [...o.parts, newPart]
          };
        }
        return o;
      });
      saveToStorage({ repairOrders: newRepairOrders });
      return { repairOrders: newRepairOrders };
    });

    console.log('[Parts] 添加配件:', repairOrderId, newPart.name);
  },

  setSelectedDate: (date) => {
    set((prev) => {
      saveToStorage({ selectedDate: date });
      return { selectedDate: date };
    });
    console.log('[Schedule] 切换日期:', date);
  },

  updateConfig: (config) => {
    set((prev) => {
      const newConfig = { ...prev.config, ...config };
      saveToStorage({ config: newConfig });
      return { config: newConfig };
    });
    console.log('[Config] 更新配置:', config);
  },

  getStationSchedule: (stationId, date) => {
    const state = get();
    const station = state.stations.find((s) => s.id === stationId);
    if (!station) {
      return {
        date,
        stationId,
        stationName: '',
        timeSlots: []
      };
    }

    const allSlots = generateTimeSlots(state.config, date);
    const stationOrders = state.repairOrders.filter(
      (o) => o.stationId === stationId
        && o.status !== 'cancelled'
        && o.scheduleDate === date
    );

    const mergedOrders = findMergedOrderSlots(state.repairOrders, stationId, date);

    const scheduleSlots = allSlots.map((slot) => {
      const occupiedOrder = stationOrders.find((order) =>
        isSlotOccupiedByOrder(slot, order, date)
      );

      const mergedOrder = mergedOrders.find((order) =>
        order.mergedSlot && isSlotOccupiedByOrder(slot, order, date)
      );

      return {
        slot,
        repairOrder: occupiedOrder || mergedOrder,
        isAvailable: !occupiedOrder && !mergedOrder && station.status === 'available',
        isMerged: !!(mergedOrder && mergedOrder.mergedSlot)
      };
    });

    return {
      date,
      stationId,
      stationName: station.name,
      timeSlots: scheduleSlots
    };
  },

  getAvailableSlots: (stationId, date) => {
    const state = get();
    const allSlots = generateTimeSlots(state.config, date);
    const stationOrders = state.repairOrders.filter(
      (o) => o.stationId === stationId && o.status !== 'cancelled'
    );
    return getAvailableTimeSlots(allSlots, stationOrders, date);
  }
}));

export default useAppStore;
