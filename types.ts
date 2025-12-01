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

export enum AuthType {
  PASSWORD = 'PASSWORD',
  KEY = 'KEY'
}

export interface NetconfDeviceConfig {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  password?: string;
  authType?: AuthType;
  sshKey?: string;
  type: DeviceType;
}

export interface Device extends NetconfDeviceConfig {
  status: DeviceStatus;
  uptime: string;
  cpuLoad: number;
  memoryUsage: number;
}

export interface Link {
  source: string;
  target: string;
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