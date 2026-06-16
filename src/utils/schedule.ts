import dayjs from 'dayjs';
import type { TimeSlot, RepairOrder, AppConfig } from '@/types';

export const generateTimeSlots = (config: AppConfig, date: string): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const { start, end } = config.businessHours;
  const duration = config.timeSlotDuration;

  let currentTime = dayjs(`${date} ${start}`);
  const endTime = dayjs(`${date} ${end}`);
  let index = 0;

  while (currentTime.isBefore(endTime)) {
    const slotEnd = currentTime.add(duration, 'minute');
    slots.push({
      id: `slot-${date}-${index}`,
      startTime: currentTime.format('HH:mm'),
      endTime: slotEnd.format('HH:mm')
    });
    currentTime = slotEnd;
    index++;
  }

  return slots;
};

export const isTimeOverlap = (slot1: TimeSlot, slot2: TimeSlot, date: string): boolean => {
  const start1 = dayjs(`${date} ${slot1.startTime}`);
  const end1 = dayjs(`${date} ${slot1.endTime}`);
  const start2 = dayjs(`${date} ${slot2.startTime}`);
  const end2 = dayjs(`${date} ${slot2.endTime}`);

  return start1.isBefore(end2) && end1.isAfter(start2);
};

export const isAdjacentSlot = (slot1: TimeSlot, slot2: TimeSlot, date: string): boolean => {
  const end1 = dayjs(`${date} ${slot1.endTime}`);
  const start2 = dayjs(`${date} ${slot2.startTime}`);
  const end2 = dayjs(`${date} ${slot2.endTime}`);
  const start1 = dayjs(`${date} ${slot1.startTime}`);

  return end1.isSame(start2) || end2.isSame(start1);
};

export const mergeTimeSlots = (slots: TimeSlot[], date: string): TimeSlot | null => {
  if (slots.length === 0) return null;
  if (slots.length === 1) return slots[0];

  const sortedSlots = [...slots].sort((a, b) => {
    return dayjs(`${date} ${a.startTime}`).valueOf() - dayjs(`${date} ${b.startTime}`).valueOf();
  });

  let canMerge = true;
  for (let i = 0; i < sortedSlots.length - 1; i++) {
    if (!isAdjacentSlot(sortedSlots[i], sortedSlots[i + 1], date)) {
      canMerge = false;
      break;
    }
  }

  if (!canMerge) return null;

  return {
    id: `merged-${Date.now()}`,
    startTime: sortedSlots[0].startTime,
    endTime: sortedSlots[sortedSlots.length - 1].endTime
  };
};

export const splitTimeSlot = (
  originalSlot: TimeSlot,
  splitTime: string,
  date: string
): { before: TimeSlot; after: TimeSlot } | null => {
  const start = dayjs(`${date} ${originalSlot.startTime}`);
  const end = dayjs(`${date} ${originalSlot.endTime}`);
  const split = dayjs(`${date} ${splitTime}`);

  if (split.isBefore(start) || split.isAfter(end) || split.isSame(start) || split.isSame(end)) {
    return null;
  }

  return {
    before: {
      id: `slot-before-${Date.now()}`,
      startTime: originalSlot.startTime,
      endTime: splitTime
    },
    after: {
      id: `slot-after-${Date.now()}`,
      startTime: splitTime,
      endTime: originalSlot.endTime
    }
  };
};

export const findMergedOrderSlots = (
  orders: RepairOrder[],
  stationId: string,
  date: string
): RepairOrder[] => {
  const stationOrders = orders.filter(
    (o) => o.stationId === stationId
      && o.status !== 'cancelled'
      && o.timeSlots.length > 0
      && o.scheduleDate === date
  );

  const sortedOrders = [...stationOrders].sort((a, b) => {
    const aStart = dayjs(`${date} ${a.timeSlots[0].startTime}`);
    const bStart = dayjs(`${date} ${b.timeSlots[0].startTime}`);
    return aStart.valueOf() - bStart.valueOf();
  });

  const result: RepairOrder[] = [];
  let i = 0;

  while (i < sortedOrders.length) {
    const current = sortedOrders[i];
    const currentVehicle = current.vehicle.plateNumber;
    const mergeCandidates: RepairOrder[] = [current];
    let j = i + 1;

    while (j < sortedOrders.length) {
      const next = sortedOrders[j];
      const lastCandidate = mergeCandidates[mergeCandidates.length - 1];

      if (
        next.vehicle.plateNumber === currentVehicle &&
        next.status !== 'completed' &&
        next.status !== 'cancelled'
      ) {
        const lastEnd = lastCandidate.timeSlots[lastCandidate.timeSlots.length - 1];
        const nextStart = next.timeSlots[0];
        if (isAdjacentSlot(lastEnd, nextStart, date)) {
          mergeCandidates.push(next);
          j++;
          continue;
        }
      }
      break;
    }

    if (mergeCandidates.length > 1) {
      const allSlots = mergeCandidates.flatMap((o) => o.timeSlots);
      const merged = mergeTimeSlots(allSlots, date);
      if (merged) {
        result.push({
          ...current,
          timeSlots: allSlots,
          mergedSlot: merged,
          id: `merged-${current.id}`,
          orderNumber: `合并单-${current.orderNumber}`
        });
      } else {
        result.push(current);
      }
    } else {
      result.push(current);
    }

    i = j;
  }

  return result;
};

export const isSlotOccupiedByOrder = (
  slot: TimeSlot,
  order: RepairOrder,
  date: string
): boolean => {
  if (order.scheduleDate !== date) return false;

  const allOrderSlots = order.mergedSlot
    ? [order.mergedSlot]
    : order.timeSlots;

  return allOrderSlots.some((orderSlot) => isTimeOverlap(slot, orderSlot, date));
};

export const getAvailableTimeSlots = (
  allSlots: TimeSlot[],
  occupiedOrders: RepairOrder[],
  date: string
): TimeSlot[] => {
  const validOrders = occupiedOrders.filter(
    (o) => o.status !== 'cancelled' && o.scheduleDate === date
  );

  return allSlots.filter((slot) => {
    return !validOrders.some((order) => isSlotOccupiedByOrder(slot, order, date));
  });
};

export const formatTimeDisplay = (startTime: string, endTime: string): string => {
  return `${startTime} - ${endTime}`;
};

export const calculateDuration = (startTime: string, endTime: string, date: string): number => {
  const start = dayjs(`${date} ${startTime}`);
  const end = dayjs(`${date} ${endTime}`);
  return end.diff(start, 'minute');
};
