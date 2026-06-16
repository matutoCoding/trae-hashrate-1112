import type { Station } from '@/types';

export const mockStations: Station[] = [
  {
    id: 'station-001',
    name: '举升机1号',
    number: 'JSJ-001',
    type: '双柱举升机',
    status: 'available',
    capacity: 3500,
    description: '适用于小型轿车、SUV常规维修保养',
    createdAt: '2024-01-15T08:00:00.000Z'
  },
  {
    id: 'station-002',
    name: '举升机2号',
    number: 'JSJ-002',
    type: '四柱举升机',
    status: 'available',
    capacity: 5000,
    description: '适用于大型车辆、四轮定位作业',
    createdAt: '2024-01-15T08:00:00.000Z'
  },
  {
    id: 'station-003',
    name: '举升机3号',
    number: 'JSJ-003',
    type: '剪式举升机',
    status: 'available',
    capacity: 4000,
    description: '超薄设计，适用于低底盘车辆',
    createdAt: '2024-02-20T10:30:00.000Z'
  },
  {
    id: 'station-004',
    name: '举升机4号',
    number: 'JSJ-004',
    type: '双柱举升机',
    status: 'maintenance',
    capacity: 3500,
    description: '设备维护中，预计明日恢复使用',
    createdAt: '2024-01-15T08:00:00.000Z'
  },
  {
    id: 'station-005',
    name: '举升机5号',
    number: 'JSJ-005',
    type: '地藏式举升机',
    status: 'available',
    capacity: 4500,
    description: '隐藏式设计，节省空间，适合快修',
    createdAt: '2024-03-10T14:00:00.000Z'
  }
];
