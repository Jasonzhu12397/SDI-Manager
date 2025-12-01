import { Device, Link, Alarm, NetconfDeviceConfig } from '../types';

// Dynamically determine the backend URL.
// If the app is accessed via 10.33.4.36, it uses http://10.33.4.36:5000/api
const API_URL = `${window.location.protocol}//${window.location.hostname}:5000/api`;

export const api = {
  // Get full dashboard snapshot (nodes, links, alarms)
  getSnapshot: async (): Promise<{ nodes: Device[], links: Link[], alarms: Alarm[] }> => {
    try {
      const res = await fetch(`${API_URL}/snapshot`);
      if (!res.ok) throw new Error('Failed to fetch snapshot');
      return await res.json();
    } catch (e) {
      console.error(e);
      return { nodes: [], links: [], alarms: [] };
    }
  },

  // Trigger manual NETCONF fetch (backend saves to DB)
  triggerFetch: async (): Promise<void> => {
    await fetch(`${API_URL}/fetch`, { method: 'POST' });
  },

  // Get Configured Devices
  getDevices: async (): Promise<NetconfDeviceConfig[]> => {
    try {
      const res = await fetch(`${API_URL}/devices`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  // Add Device
  addDevice: async (device: NetconfDeviceConfig): Promise<void> => {
    await fetch(`${API_URL}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });
  },

  // Remove Device
  removeDevice: async (id: string): Promise<void> => {
    await fetch(`${API_URL}/devices?id=${id}`, { method: 'DELETE' });
  },

  // Clear specific alarm
  clearAlarm: async (id: string): Promise<void> => {
    await fetch(`${API_URL}/alarms/${id}`, { method: 'DELETE' });
  },

  // --- Auth & User ---
  
  login: async (username: string, password: string): Promise<{success: boolean, error?: string}> => {
    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (res.ok) {
            return { success: true };
        }
        return { success: false, error: 'Invalid username or password' };
    } catch (e) {
        return { success: false, error: 'Connection Error: Backend unreachable' };
    }
  },

  register: async (username: string, password: string): Promise<{success: boolean, message?: string}> => {
    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        if (res.ok) {
            return { success: true };
        } else {
            const data = await res.json();
            return { success: false, message: data.error };
        }
    } catch (e) {
        return { success: false, message: 'Connection Error' };
    }
  },

  changePassword: async (username: string, oldPass: string, newPass: string): Promise<{success: boolean, message?: string}> => {
    try {
        const res = await fetch(`${API_URL}/change_password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, oldPassword: oldPass, newPassword: newPass })
        });
        if (res.ok) {
            return { success: true };
        } else {
            const data = await res.json();
            return { success: false, message: data.error };
        }
    } catch (e) {
        return { success: false, message: 'Connection Error' };
    }
  }
};