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

export interface DiskInfo {
  id: string;
  size: string;
  status: string;
}

export interface InterfaceInfo {
  id: string;
  mac: string;
  connectedSwitch?: string;
  connectedPort?: string;
}

export interface SwitchPortInfo {
  id: string;
  status: string;
  speed: string;
  connectedDevice?: string;
}

export interface DeviceDetails {
  disks?: DiskInfo[];
  interfaces?: InterfaceInfo[];
  ports?: SwitchPortInfo[];
}

export interface Device extends NetconfDeviceConfig {
  status: DeviceStatus;
  uptime: string;
  cpuLoad: number;
  memoryUsage: number;
  details?: DeviceDetails;
}

export interface Link {
  source: string;
  target: string;
  bandwidth: string;
  status: 'UP' | 'DOWN';
  label?: string;
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
