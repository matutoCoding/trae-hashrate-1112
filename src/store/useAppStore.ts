import { create } from 'zustand';
import dayjs from 'dayjs';
import type { AppState, AppActions, Station, RepairOrder, QueueItem, PartItem, TimeSlot } from '@/types';
import { mockStations } from '@/data/mockStations';
import { mockRepairs } from '@/data/mockRepairs';
import { mockQueue } from '@/data/mockQueue';
import {
  generateTimeSlots,
  findMergedOrderSlots,
  getAvailableTimeSlots,
  splitTimeSlot as splitSlotUtil,
  mergeTimeSlots as mergeSlotsUtil
} from '@/utils/schedule';
import {
  createQueueItem,
  handleSkip,
  reorderSkippedItems,
  getNextCallNumber
} from '@/utils/queue';

const initialConfig = {
  maxSkipCount: 3,
  businessHours: {
    start: '08:00',
    end: '18:00'
  },
  timeSlotDuration: 30,
  autoMergeEnabled: true
};

const useAppStore = create<AppState & AppActions>((set, get) => ({
  stations: mockStations,
  repairOrders: mockRepairs,
  queue: mockQueue,
  config: initialConfig,
  selectedDate: dayjs().format('YYYY-MM-DD'),
  currentCallingNumber: 1,

  addStation: (station) => {
    const newStation: Station = {
      ...station,
      id: `station-${Date.now()}`,
      createdAt: dayjs().toISOString()
    };
    set((state) => ({ stations: [...state.stations, newStation] }));
    console.log('[Station] 新增工位:', newStation);
  },

  updateStation: (id, updates) => {
    set((state) => ({
      stations: state.stations.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      )
    }));
    console.log('[Station] 更新工位:', id, updates);
  },

  deleteStation: (id) => {
    set((state) => ({
      stations: state.stations.filter((s) => s.id !== id)
    }));
    console.log('[Station] 删除工位:', id);
  },

  createRepairOrder: (order) => {
    const newOrder: RepairOrder = {
      ...order,
      id: `repair-${Date.now()}`,
      orderNumber: `WX${dayjs().format('YYYYMMDDHHmmss')}`,
      skipCount: 0,
      isSkipped: false,
      createdAt: dayjs().toISOString()
    };
    set((state) => ({ repairOrders: [...state.repairOrders, newOrder] }));
    console.log('[Repair] 创建维修单:', newOrder.orderNumber);
  },

  updateRepairOrder: (id, updates) => {
    set((state) => ({
      repairOrders: state.repairOrders.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      )
    }));
    console.log('[Repair] 更新维修单:', id, updates);
  },

  splitTimeSlot: (orderId, splitTime) => {
    const state = get();
    const order = state.repairOrders.find((o) => o.id === orderId);
    if (!order) return;

    const displaySlot = order.mergedSlot || order.timeSlots[0];
    if (!displaySlot) return;

    const splitResult = splitSlotUtil(displaySlot, splitTime, state.selectedDate);
    if (!splitResult) return;

    const { before, after } = splitResult;

    set((prev) => ({
      repairOrders: prev.repairOrders.map((o) => {
        if (o.id === orderId) {
          const newOrder: RepairOrder = {
            ...o,
            timeSlots: [before],
            mergedSlot: undefined,
            actualEndTime: dayjs().toISOString()
          };

          const continuationOrder: RepairOrder = {
            ...o,
            id: `repair-${Date.now()}`,
            orderNumber: `WX${dayjs().format('YYYYMMDDHHmmss')}`,
            timeSlots: [after],
            mergedSlot: undefined,
            status: 'pending',
            actualStartTime: undefined,
            actualEndTime: undefined,
            parts: [],
            createdAt: dayjs().toISOString(),
            notes: '中途拆分，待继续维修'
          };

          setTimeout(() => {
            set((s) => ({ repairOrders: [...s.repairOrders, continuationOrder] }));
          }, 0);

          return newOrder;
        }
        return o;
      })
    }));

    console.log('[Schedule] 拆分时段:', orderId, '在', splitTime);
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

    set((prev) => ({
      repairOrders: prev.repairOrders
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
        })
    }));

    console.log('[Schedule] 合并时段:', orderIds);
  },

  addQueueItem: (repairOrderId) => {
    const state = get();
    const repairOrder = state.repairOrders.find((o) => o.id === repairOrderId);
    if (!repairOrder) return;

    const newQueueItem = createQueueItem(repairOrder, state.queue, state.config);
    set((prev) => ({ queue: [...prev.queue, newQueueItem] }));

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

    set((prev) => ({
      queue: prev.queue.map((item) => {
        if (item.id === nextItem.id) {
          return {
            ...item,
            status: 'called',
            calledAt: dayjs().toISOString()
          };
        }
        return item;
      }),
      currentCallingNumber: nextItem.queueNumber
    }));

    get().updateRepairOrder(nextItem.repairOrderId, { status: 'queuing' });

    console.log('[Queue] 叫号:', nextItem.queueNumber, nextItem.vehicle.plateNumber);
  },

  markAsSkipped: (queueItemId) => {
    const state = get();
    const queueItem = state.queue.find((q) => q.id === queueItemId);
    if (!queueItem) return;

    const skippedItem = handleSkip(queueItem, state.config);

    set((prev) => {
      const newQueue = prev.queue.map((item) =>
        item.id === queueItemId ? skippedItem : item
      );

      if (skippedItem.status === 'cancelled') {
        get().updateRepairOrder(skippedItem.repairOrderId, { status: 'cancelled' });
        console.log('[Queue] 连续过号，自动作废:', skippedItem.queueNumber);
        return { queue: newQueue };
      }

      return { queue: reorderSkippedItems(newQueue) };
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

    set((prev) => ({
      queue: prev.queue.map((item) =>
        item.id === queueItemId ? { ...item, status: 'cancelled' } : item
      )
    }));

    get().updateRepairOrder(queueItem.repairOrderId, { status: 'cancelled' });

    console.log('[Queue] 取消排队:', queueItem.queueNumber);
  },

  completeService: (queueItemId) => {
    const state = get();
    const queueItem = state.queue.find((q) => q.id === queueItemId);
    if (!queueItem) return;

    set((prev) => ({
      queue: prev.queue.map((item) =>
        item.id === queueItemId ? { ...item, status: 'completed' } : item
      )
    }));

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

    set((prev) => ({
      repairOrders: prev.repairOrders.map((o) => {
        if (o.id === repairOrderId) {
          return {
            ...o,
            parts: [...o.parts, newPart]
          };
        }
        return o;
      })
    }));

    console.log('[Parts] 添加配件:', repairOrderId, newPart.name);
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    console.log('[Schedule] 切换日期:', date);
  },

  updateConfig: (config) => {
    set((prev) => ({ config: { ...prev.config, ...config } }));
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
    const stationOrders = findMergedOrderSlots(state.repairOrders, stationId, date);

    const scheduleSlots = allSlots.map((slot) => {
      const occupiedOrder = stationOrders.find((order) => {
        const displaySlot = order.mergedSlot || order.timeSlots[0];
        return displaySlot && displaySlot.startTime <= slot.startTime && displaySlot.endTime >= slot.endTime;
      });

      return {
        slot,
        repairOrder: occupiedOrder,
        isAvailable: !occupiedOrder && station.status === 'available',
        isMerged: !!(occupiedOrder && occupiedOrder.mergedSlot)
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
