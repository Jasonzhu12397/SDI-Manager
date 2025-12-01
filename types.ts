export enum DeviceType {
  ROUTER = 'ROUTER',
  SWITCH = 'SWITCH',
  SERVER = 'SERVER',
  FIREWALL = 'FIREWALL'
}

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  WARNING = 'WARNING'
}

export interface NetconfDeviceConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  password?: string; // Optional in frontend display
  type: DeviceType;
}

export interface Device extends NetconfDeviceConfig {
  status: DeviceStatus;
  uptime: string;
  cpuLoad: number; // 0-100
  memoryUsage: number; // 0-100
}

export interface Link {
  source: string; // Device ID
  target: string; // Device ID
  bandwidth: string;
  status: 'UP' | 'DOWN';
}

export enum AlarmSeverity {
  CRITICAL = 'CRITICAL',
  MAJOR = 'MAJOR',
  MINOR = 'MINOR',
  WARNING = 'WARNING'
}

export interface Alarm {
  id: string;
  deviceId: string;
  deviceName: string;
  severity: AlarmSeverity;
  message: string;
  timestamp: string;
}

export interface TopologyData {
  nodes: Device[];
  links: Link[];
}

export interface ConfigDiff {
  filename: string;
  original: string;
  modified: string;
}