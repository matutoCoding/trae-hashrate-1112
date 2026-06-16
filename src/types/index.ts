export type StationStatus = 'available' | 'occupied' | 'maintenance';

export interface Station {
  id: string;
  name: string;
  number: string;
  type: string;
  status: StationStatus;
  capacity: number;
  description: string;
  createdAt: string;
}

export type RepairStatus = 'pending' | 'queuing' | 'in_progress' | 'completed' | 'cancelled';

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
}

export interface VehicleInfo {
  plateNumber: string;
  brand: string;
  model: string;
  color: string;
  ownerName: string;
  ownerPhone: string;
}

export interface PartItem {
  id: string;
  name: string;
  partNumber: string;
  quantity: number;
  unit: string;
  price: number;
  pickupTime: string;
  operator: string;
}

export interface RepairOrder {
  id: string;
  orderNumber: string;
  stationId: string;
  stationName: string;
  vehicle: VehicleInfo;
  status: RepairStatus;
  serviceType: string;
  description: string;
  scheduleDate: string;
  timeSlots: TimeSlot[];
  mergedSlot?: TimeSlot;
  estimatedDuration: number;
  actualStartTime?: string;
  actualEndTime?: string;
  parts: PartItem[];
  queueNumber?: number;
  skipCount: number;
  isSkipped: boolean;
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export type QueueStatus = 'waiting' | 'called' | 'skipped' | 'serving' | 'completed' | 'cancelled';

export interface QueueItem {
  id: string;
  repairOrderId: string;
  orderNumber: string;
  vehicle: VehicleInfo;
  queueNumber: number;
  status: QueueStatus;
  calledAt?: string;
  skipCount: number;
  maxSkipCount: number;
  estimatedWaitTime: number;
  serviceType: string;
  createdAt: string;
}

export interface ScheduleDay {
  date: string;
  stationId: string;
  stationName: string;
  timeSlots: {
    slot: TimeSlot;
    repairOrder?: RepairOrder;
    isAvailable: boolean;
    isMerged: boolean;
  }[];
}

export interface AppConfig {
  maxSkipCount: number;
  businessHours: {
    start: string;
    end: string;
  };
  timeSlotDuration: number;
  autoMergeEnabled: boolean;
}

export interface AppState {
  stations: Station[];
  repairOrders: RepairOrder[];
  queue: QueueItem[];
  config: AppConfig;
  selectedDate: string;
  currentCallingNumber: number | null;
}

export interface AppActions {
  addStation: (station: Omit<Station, 'id' | 'createdAt'>) => void;
  updateStation: (id: string, updates: Partial<Station>) => void;
  deleteStation: (id: string) => void;
  createRepairOrder: (order: Omit<RepairOrder, 'id' | 'orderNumber' | 'skipCount' | 'isSkipped' | 'createdAt' | 'scheduleDate'> & { scheduleDate?: string }) => void;
  updateRepairOrder: (id: string, updates: Partial<RepairOrder>) => void;
  splitTimeSlot: (orderId: string, splitTime: string) => boolean;
  mergeTimeSlots: (orderIds: string[]) => void;
  addQueueItem: (repairOrderId: string) => void;
  callNextNumber: () => void;
  markAsSkipped: (queueItemId: string) => void;
  cancelQueueItem: (queueItemId: string) => void;
  completeService: (queueItemId: string) => void;
  assignStationAndStart: (queueItemId: string, stationId: string, stationName: string, date: string, timeSlots: TimeSlot[], mergedSlot?: TimeSlot) => void;
  addPart: (repairOrderId: string, part: Omit<PartItem, 'id'>) => void;
  setSelectedDate: (date: string) => void;
  updateConfig: (config: Partial<AppConfig>) => void;
  getStationSchedule: (stationId: string, date: string) => ScheduleDay;
  getAvailableSlots: (stationId: string, date: string) => TimeSlot[];
}
