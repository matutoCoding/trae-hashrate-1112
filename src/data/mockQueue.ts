import dayjs from 'dayjs';
import type { QueueItem } from '@/types';

const today = dayjs().format('YYYY-MM-DD');

export const mockQueue: QueueItem[] = [
  {
    id: 'queue-001',
    repairOrderId: 'repair-002',
    orderNumber: 'WX20250617002',
    vehicle: {
      plateNumber: '京B67890',
      brand: '丰田',
      model: '凯美瑞',
      color: '白色',
      ownerName: '李女士',
      ownerPhone: '139****5678'
    },
    queueNumber: 1,
    status: 'called',
    calledAt: `${today} 09:55:00`,
    skipCount: 0,
    maxSkipCount: 3,
    estimatedWaitTime: 0,
    serviceType: '四轮定位',
    createdAt: `${today} 08:15:00`
  },
  {
    id: 'queue-002',
    repairOrderId: 'repair-006',
    orderNumber: 'WX20250617006',
    vehicle: {
      plateNumber: '京E33333',
      brand: '本田',
      model: '雅阁',
      color: '灰色',
      ownerName: '陈女士',
      ownerPhone: '135****7890'
    },
    queueNumber: 3,
    status: 'waiting',
    skipCount: 0,
    maxSkipCount: 3,
    estimatedWaitTime: 60,
    serviceType: '空调维修',
    createdAt: `${today} 09:00:00`
  },
  {
    id: 'queue-003',
    repairOrderId: 'repair-007',
    orderNumber: 'WX20250617007',
    vehicle: {
      plateNumber: '京F44444',
      brand: '奔驰',
      model: 'E300L',
      color: '黑色',
      ownerName: '孙先生',
      ownerPhone: '134****1234'
    },
    queueNumber: 4,
    status: 'skipped',
    calledAt: `${today} 09:30:00`,
    skipCount: 1,
    maxSkipCount: 3,
    estimatedWaitTime: 90,
    serviceType: '变速箱保养',
    createdAt: `${today} 09:15:00`
  },
  {
    id: 'queue-004',
    repairOrderId: 'repair-005',
    orderNumber: 'WX20250617005',
    vehicle: {
      plateNumber: '京D22222',
      brand: '奥迪',
      model: 'A6L',
      color: '银色',
      ownerName: '赵先生',
      ownerPhone: '136****3456'
    },
    queueNumber: 5,
    status: 'waiting',
    skipCount: 0,
    maxSkipCount: 3,
    estimatedWaitTime: 120,
    serviceType: '发动机维修',
    createdAt: `${today} 09:30:00`
  }
];
