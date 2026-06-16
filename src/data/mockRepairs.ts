import dayjs from 'dayjs';
import type { RepairOrder } from '@/types';

const today = dayjs().format('YYYY-MM-DD');

export const mockRepairs: RepairOrder[] = [
  {
    id: 'repair-001',
    orderNumber: 'WX20250617001',
    stationId: 'station-001',
    stationName: '举升机1号',
    vehicle: {
      plateNumber: '京A12345',
      brand: '大众',
      model: '帕萨特',
      color: '黑色',
      ownerName: '张先生',
      ownerPhone: '138****1234'
    },
    status: 'in_progress',
    serviceType: '常规保养',
    description: '更换机油机滤、空气滤芯、空调滤芯，全车检查',
    timeSlots: [
      { id: 'slot-1', startTime: '08:30', endTime: '09:00' },
      { id: 'slot-2', startTime: '09:00', endTime: '09:30' },
      { id: 'slot-3', startTime: '09:30', endTime: '10:00' }
    ],
    mergedSlot: { id: 'merged-1', startTime: '08:30', endTime: '10:00' },
    estimatedDuration: 90,
    actualStartTime: `${today} 08:32:00`,
    parts: [
      {
        id: 'part-001',
        name: '全合成机油 5W-40',
        partNumber: 'OIL-001',
        quantity: 4.5,
        unit: 'L',
        price: 480,
        pickupTime: `${today} 08:35:00`,
        operator: '李师傅'
      },
      {
        id: 'part-002',
        name: '机油滤清器',
        partNumber: 'FIL-001',
        quantity: 1,
        unit: '个',
        price: 45,
        pickupTime: `${today} 08:35:00`,
        operator: '李师傅'
      }
    ],
    skipCount: 0,
    isSkipped: false,
    createdAt: `${today} 08:00:00`,
    createdBy: '王主管'
  },
  {
    id: 'repair-002',
    orderNumber: 'WX20250617002',
    stationId: 'station-002',
    stationName: '举升机2号',
    vehicle: {
      plateNumber: '京B67890',
      brand: '丰田',
      model: '凯美瑞',
      color: '白色',
      ownerName: '李女士',
      ownerPhone: '139****5678'
    },
    status: 'queuing',
    serviceType: '四轮定位',
    description: '车辆行驶跑偏，需要做四轮定位调整',
    timeSlots: [
      { id: 'slot-4', startTime: '10:00', endTime: '10:30' },
      { id: 'slot-5', startTime: '10:30', endTime: '11:00' }
    ],
    estimatedDuration: 60,
    parts: [],
    queueNumber: 2,
    skipCount: 0,
    isSkipped: false,
    createdAt: `${today} 08:15:00`,
    createdBy: '王主管'
  },
  {
    id: 'repair-003',
    orderNumber: 'WX20250617003',
    stationId: 'station-001',
    stationName: '举升机1号',
    vehicle: {
      plateNumber: '京A12345',
      brand: '大众',
      model: '帕萨特',
      color: '黑色',
      ownerName: '张先生',
      ownerPhone: '138****1234'
    },
    status: 'pending',
    serviceType: '刹车系统检修',
    description: '检查刹车片磨损情况，必要时更换前刹车片',
    timeSlots: [
      { id: 'slot-6', startTime: '10:00', endTime: '10:30' },
      { id: 'slot-7', startTime: '10:30', endTime: '11:00' },
      { id: 'slot-8', startTime: '11:00', endTime: '11:30' }
    ],
    estimatedDuration: 90,
    parts: [],
    skipCount: 0,
    isSkipped: false,
    createdAt: `${today} 08:30:00`,
    createdBy: '王主管',
    notes: '同一辆车，保养完成后继续检修刹车'
  },
  {
    id: 'repair-004',
    orderNumber: 'WX20250617004',
    stationId: 'station-003',
    stationName: '举升机3号',
    vehicle: {
      plateNumber: '京C11111',
      brand: '宝马',
      model: '325Li',
      color: '蓝色',
      ownerName: '王先生',
      ownerPhone: '137****9012'
    },
    status: 'in_progress',
    serviceType: '底盘维修',
    description: '过减速带时异响，检查悬挂和下摆臂',
    timeSlots: [
      { id: 'slot-9', startTime: '09:00', endTime: '09:30' },
      { id: 'slot-10', startTime: '09:30', endTime: '10:00' },
      { id: 'slot-11', startTime: '10:00', endTime: '10:30' },
      { id: 'slot-12', startTime: '10:30', endTime: '11:00' }
    ],
    estimatedDuration: 120,
    actualStartTime: `${today} 09:05:00`,
    parts: [
      {
        id: 'part-003',
        name: '前下摆臂胶套',
        partNumber: 'SUS-002',
        quantity: 2,
        unit: '个',
        price: 680,
        pickupTime: `${today} 09:45:00`,
        operator: '赵师傅'
      }
    ],
    skipCount: 0,
    isSkipped: false,
    createdAt: `${today} 08:45:00`,
    createdBy: '王主管'
  },
  {
    id: 'repair-005',
    orderNumber: 'WX20250617005',
    stationId: 'station-005',
    stationName: '举升机5号',
    vehicle: {
      plateNumber: '京D22222',
      brand: '奥迪',
      model: 'A6L',
      color: '银色',
      ownerName: '赵先生',
      ownerPhone: '136****3456'
    },
    status: 'completed',
    serviceType: '发动机维修',
    description: '发动机怠速抖动，清洗节气门、更换火花塞',
    timeSlots: [
      { id: 'slot-13', startTime: '08:00', endTime: '08:30' },
      { id: 'slot-14', startTime: '08:30', endTime: '09:00' }
    ],
    estimatedDuration: 60,
    actualStartTime: `${today} 08:02:00`,
    actualEndTime: `${today} 08:55:00`,
    parts: [
      {
        id: 'part-004',
        name: '火花塞（4支装）',
        partNumber: 'SPK-003',
        quantity: 1,
        unit: '套',
        price: 520,
        pickupTime: `${today} 08:10:00`,
        operator: '刘师傅'
      }
    ],
    skipCount: 0,
    isSkipped: false,
    createdAt: `${today} 07:50:00`,
    createdBy: '王主管'
  },
  {
    id: 'repair-006',
    orderNumber: 'WX20250617006',
    stationId: 'station-001',
    stationName: '举升机1号',
    vehicle: {
      plateNumber: '京E33333',
      brand: '本田',
      model: '雅阁',
      color: '灰色',
      ownerName: '陈女士',
      ownerPhone: '135****7890'
    },
    status: 'pending',
    serviceType: '空调维修',
    description: '空调制冷效果差，检查冷媒和压缩机',
    timeSlots: [
      { id: 'slot-15', startTime: '13:00', endTime: '13:30' },
      { id: 'slot-16', startTime: '13:30', endTime: '14:00' },
      { id: 'slot-17', startTime: '14:00', endTime: '14:30' }
    ],
    estimatedDuration: 90,
    parts: [],
    skipCount: 0,
    isSkipped: false,
    createdAt: `${today} 09:00:00`,
    createdBy: '王主管'
  },
  {
    id: 'repair-007',
    orderNumber: 'WX20250617007',
    stationId: 'station-002',
    stationName: '举升机2号',
    vehicle: {
      plateNumber: '京F44444',
      brand: '奔驰',
      model: 'E300L',
      color: '黑色',
      ownerName: '孙先生',
      ownerPhone: '134****1234'
    },
    status: 'pending',
    serviceType: '变速箱保养',
    description: '更换变速箱油和滤芯',
    timeSlots: [
      { id: 'slot-18', startTime: '14:00', endTime: '14:30' },
      { id: 'slot-19', startTime: '14:30', endTime: '15:00' },
      { id: 'slot-20', startTime: '15:00', endTime: '15:30' },
      { id: 'slot-21', startTime: '15:30', endTime: '16:00' }
    ],
    estimatedDuration: 120,
    parts: [],
    skipCount: 0,
    isSkipped: false,
    createdAt: `${today} 09:15:00`,
    createdBy: '王主管'
  },
  {
    id: 'repair-008',
    orderNumber: 'WX20250616001',
    stationId: 'station-003',
    stationName: '举升机3号',
    vehicle: {
      plateNumber: '京G55555',
      brand: '别克',
      model: '君威',
      color: '红色',
      ownerName: '周女士',
      ownerPhone: '133****5678'
    },
    status: 'completed',
    serviceType: '常规保养',
    description: '5000公里小保养',
    timeSlots: [
      { id: 'slot-y1', startTime: '09:00', endTime: '09:30' },
      { id: 'slot-y2', startTime: '09:30', endTime: '10:00' }
    ],
    estimatedDuration: 60,
    actualStartTime: `${dayjs().subtract(1, 'day').format('YYYY-MM-DD')} 09:05:00`,
    actualEndTime: `${dayjs().subtract(1, 'day').format('YYYY-MM-DD')} 09:50:00`,
    parts: [
      {
        id: 'part-005',
        name: '机油滤清器',
        partNumber: 'FIL-002',
        quantity: 1,
        unit: '个',
        price: 38,
        pickupTime: `${dayjs().subtract(1, 'day').format('YYYY-MM-DD')} 09:10:00`,
        operator: '李师傅'
      }
    ],
    skipCount: 0,
    isSkipped: false,
    createdAt: `${dayjs().subtract(1, 'day').format('YYYY-MM-DD')} 08:30:00`,
    createdBy: '王主管'
  }
];
