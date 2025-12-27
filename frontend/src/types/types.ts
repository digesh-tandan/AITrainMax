// src/types/types.ts

// --- Core Enumerations ---

export type TrainPriority = 'High (🟢)' | 'Medium (🟡)' | 'Low (🔴)';
export type TrainStatus = 'Arrived' | 'Running' | 'Scheduled' | 'Delayed' | 'Held';

// --- 1. Train Data Model ---

export interface TrainData {
  // Required Attributes (from DBs / backend JSON)
  train_no: string;
  train_name: string;
  train_type: string;
  schedule_ar: string;
  schedule_dep: string;
  actual_ar: string;
  actual_dep: string;
  delay: number; // delay in minutes

  // Backend sends track as number (1/2/3), but we also allow string for safety
  track: number | '1' | '2' | '3';

  // Backend likely uses 'Up' / 'Down', but we also allow lowercase
  direction: 'up' | 'down' | 'Up' | 'Down';

  // Dynamic Simulation / AI Attributes (backend sets these)
  priority: TrainPriority;
  status: TrainStatus;
  recommended_action: string;

  // GIS/Position Data (backend sets for /api/trains/active)
  current_lat: number;
  current_lon: number;

  // Optional (depending on DB schema)
  train_id?: string;
  zone?: string;
}

// --- 2. Alert Data Model ---

export interface Alert {
  timestamp: string;
  severity: 'CRITICAL' | 'MEDIUM' | 'LOW';
  description: string;
  isWeather: boolean;
  icon: string; // e.g., ⛈️, 🚨
}

// --- 3. Weather Data Model ---

export interface WeatherData {
  current_condition: 'Clear' | 'Cloudy' | 'Rain' | 'Storm' | 'Fog' | 'Wind';
  icon: string;
  alert_level: 'RED' | 'YELLOW' | 'GREEN';
  alerts: Alert[];
}
