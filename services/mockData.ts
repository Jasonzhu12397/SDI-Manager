import { Alarm, AlarmSeverity, Device, DeviceStatus, Link, NetconfDeviceConfig, TopologyData } from '../types';

// Helper to generate random status/stats for a configured device
export const generateDeviceStatus = (config: NetconfDeviceConfig): Device => {
  const isOffline = Math.random() > 0.9; // 10% chance offline
  const isWarning = !isOffline && Math.random() > 0.8; // 20% chance warning if online

  let status = DeviceStatus.ONLINE;
  if (isOffline) status = DeviceStatus.OFFLINE;
  else if (isWarning) status = DeviceStatus.WARNING;

  return {
    ...config,
    status,
    uptime: isOffline ? '0d' : `${Math.floor(Math.random() * 100)}d ${Math.floor(Math.random() * 24)}h`,
    cpuLoad: isOffline ? 0 : Math.floor(Math.random() * (isWarning ? 100 : 60)),
    memoryUsage: isOffline ? 0 : Math.floor(Math.random() * 90),
  };
};

export const generateTopologyFromConfig = (configs: NetconfDeviceConfig[]): TopologyData => {
  // 1. Generate Device Status
  const nodes: Device[] = configs.map(generateDeviceStatus);

  // 2. Generate Random Links between devices if there are enough devices
  const links: Link[] = [];
  
  if (nodes.length > 1) {
    // Ensure at least a ring or some connectivity
    for (let i = 0; i < nodes.length; i++) {
      const source = nodes[i];
      // Connect to the next node (ring topology base)
      const targetIndex = (i + 1) % nodes.length;
      const target = nodes[targetIndex];

      links.push({
        source: source.id,
        target: target.id,
        bandwidth: Math.random() > 0.5 ? '10Gbps' : '1Gbps',
        status: source.status === DeviceStatus.OFFLINE || target.status === DeviceStatus.OFFLINE ? 'DOWN' : 'UP'
      });

      // Randomly add mesh connections
      if (nodes.length > 3 && Math.random() > 0.7) {
         const randomTarget = nodes[Math.floor(Math.random() * nodes.length)];
         if (randomTarget.id !== source.id && randomTarget.id !== target.id) {
            links.push({
                source: source.id,
                target: randomTarget.id,
                bandwidth: '40Gbps',
                status: 'UP'
            });
         }
      }
    }
  }

  return { nodes, links };
};

export const generateMockAlarms = (devices: Device[]): Alarm[] => {
  const alarms: Alarm[] = [];
  
  devices.forEach(device => {
    if (device.status === DeviceStatus.OFFLINE) {
      alarms.push({
        id: `alm-${Math.random().toString(36).substr(2, 9)}`,
        deviceId: device.id,
        deviceName: device.name,
        severity: AlarmSeverity.CRITICAL,
        message: 'NETCONF Connection Failed: Host Unreachable',
        timestamp: new Date().toISOString()
      });
    } else if (device.status === DeviceStatus.WARNING || device.cpuLoad > 80) {
      alarms.push({
        id: `alm-${Math.random().toString(36).substr(2, 9)}`,
        deviceId: device.id,
        deviceName: device.name,
        severity: AlarmSeverity.MAJOR,
        message: `High CPU Utilization (${device.cpuLoad}%)`,
        timestamp: new Date().toISOString()
      });
    }
  });

  return alarms;
};

// Initial default config if local storage is empty
export const DEFAULT_DEVICES: NetconfDeviceConfig[] = [
    { id: 'core-01', name: 'Core-Router-01', ip: '192.168.10.1', port: 830, username: 'admin', type: 'ROUTER' as any },
    { id: 'sw-01', name: 'Dist-Switch-01', ip: '192.168.10.2', port: 830, username: 'admin', type: 'SWITCH' as any },
    { id: 'sw-02', name: 'Access-Switch-01', ip: '192.168.10.3', port: 830, username: 'admin', type: 'SWITCH' as any },
];