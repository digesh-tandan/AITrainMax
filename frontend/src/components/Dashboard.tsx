// src/components/Dashboard.tsx

import React from 'react';
import { TrainData, Alert } from '../types/types';
import BspAkaltaraSimulation from './BspAkaltaraSimulation';

interface DashboardProps {
  trains: TrainData[];
  alerts: Alert[];
  selectedTrain: TrainData;
  onDbSwitch: (db: 'india_db' | 'cg_db') => void;
  activeDB: 'india_db' | 'cg_db';
}

const Dashboard: React.FC<DashboardProps> = ({
  trains,
  alerts,
  selectedTrain,
  onDbSwitch,
  activeDB,
}) => {
  return (
    <div className="flex flex-col h-full bg-rail-mid p-4 space-y-4 overflow-y-auto">
      {/* Database Switcher */}
      <div className="p-3 bg-rail-light rounded-lg shadow-inner flex justify-between items-center border-b border-rail-accent/50">
        <h2 className="text-lg font-bold text-white">DB Source</h2>
        <select
          onChange={(e) => onDbSwitch(e.target.value as 'india_db' | 'cg_db')}
          value={activeDB}
          className="bg-rail-dark text-rail-accent p-1 rounded border border-rail-accent/50 text-sm cursor-pointer focus:ring-1 focus:ring-rail-accent"
        >
          <option value="india_db">Use India DB</option>
          <option value="cg_db">Use Chhattisgarh DB</option>
        </select>
      </div>

      {/* Train Monitoring Panel */}
      <TrainMonitoringPanel selectedTrain={selectedTrain} />

      {/* Alert Panel */}
      <AlertPanel alerts={alerts} />

      {/* Existing textual Track View Panel */}
      <TrackViewPanel trains={trains} />

      {/* NEW: BSP–Akaltara Overtake Simulation */}
      <BspAkaltaraSimulation />
    </div>
  );
};

// ====================================================================
// --- Sub-Component 1: Train Monitoring Panel ---
// ====================================================================

const TrainMonitoringPanel: React.FC<{ selectedTrain: TrainData }> = ({ selectedTrain: t }) => {
  const priorityColorClass =
    t.priority === 'High (🟢)'
      ? 'bg-priority-high'
      : t.priority === 'Low (🔴)'
      ? 'bg-priority-low'
      : 'bg-priority-medium';

  const DataRow = ({
    label,
    value,
    valueClass = 'text-white',
  }: {
    label: string;
    value: string | number;
    valueClass?: string;
  }) => (
    <p className="flex justify-between">
      <span className="text-gray-400">{label}:</span>
      <span className={valueClass}>{value}</span>
    </p>
  );

  return (
    <div className="p-4 bg-rail-light rounded-lg shadow-lg border border-gray-700">
      <h2 className="text-xl font-bold mb-3 text-rail-accent border-b border-rail-mid pb-2">
        Train Monitoring Panel
      </h2>
      <div className="space-y-2 text-sm text-gray-300">
        {/* Train Name + Priority */}
        <div className="flex justify-between items-center pb-2 border-b border-gray-700">
          <span className="font-semibold text-white text-base">
            {t.train_no} {t.train_name}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityColorClass}`}>
            {t.priority?.split(' ')[0]} Priority
          </span>
        </div>

        <DataRow label="train_type" value={t.train_type} valueClass="text-rail-accent" />

        <div className="grid grid-cols-2 gap-x-4">
          <DataRow label="schedule_ar" value={t.schedule_ar} />
          <DataRow label="schedule_dep" value={t.schedule_dep} />
          <DataRow label="actual_ar" value={t.actual_ar} />
          <DataRow label="actual_dep" value={t.actual_dep} />
        </div>

        <DataRow
          label="delay"
          value={`${t.delay} min`}
          valueClass="text-priority-low font-bold"
        />
        <DataRow
          label="status"
          value={t.status}
          valueClass={
            t.status === 'Delayed' || t.status === 'Held'
              ? 'text-priority-low font-bold'
              : 'text-priority-high font-bold'
          }
        />
        <DataRow label="track" value={String(t.track)} />
        <DataRow label="direction" value={t.direction?.toString().toUpperCase()} />
        <DataRow label="priority" value={t.priority} valueClass="text-white" />

        <div className="pt-2 border-t border-rail-mid mt-2 space-y-1">
          <p className="font-semibold text-white flex justify-between">
            <span>Recommended Action:</span>
            <span className="text-rail-accent">{t.recommended_action}</span>
          </p>
          <p className="font-semibold text-white flex justify-between">
            <span>Tracks Occupied →</span>
            <span className="text-rail-accent font-extrabold">3/3</span>
          </p>
        </div>
      </div>
    </div>
  );
};

// ====================================================================
// --- Sub-Component 2: Alert Panel ---
// ====================================================================

const AlertPanel: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  return (
    <div className="p-4 bg-rail-light rounded-lg shadow-lg flex-1 overflow-y-auto min-h-[250px] border border-gray-700">
      <h2 className="text-xl font-bold mb-3 text-rail-accent border-b border-rail-mid pb-2">
        Alert Panel
      </h2>
      <div className="space-y-2">
        {alerts.map((alert, index) => {
          const severityMap =
            {
              CRITICAL: {
                border: 'border-priority-low',
                bg: 'bg-red-900/30',
                text: 'text-priority-low',
              },
              MEDIUM: {
                border: 'border-priority-medium',
                bg: 'bg-yellow-900/30',
                text: 'text-priority-medium',
              },
              LOW: {
                border: 'border-priority-high',
                bg: 'bg-green-900/30',
                text: 'text-priority-high',
              },
            }[alert.severity] || {
              border: 'border-priority-medium',
              bg: 'bg-rail-dark',
              text: 'text-priority-medium',
            };

          return (
            <div
              key={index}
              className={`p-3 border-l-4 ${severityMap.border} ${severityMap.bg} rounded text-sm transition-all duration-300 hover:shadow-md`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`font-semibold ${severityMap.text}`}>
                  {alert.icon} {alert.severity}
                </span>
                <span className="text-xs text-gray-500">{alert.timestamp}</span>
              </div>
              <p className="text-white mb-2">{alert.description}</p>

              <div className="space-x-2">
                <button className="text-xs text-white bg-rail-dark hover:bg-gray-800 px-2 py-1 rounded border border-gray-700">
                  Acknowledge
                </button>
                <button className="text-xs text-white bg-rail-dark hover:bg-gray-800 px-2 py-1 rounded border border-gray-700">
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && (
          <p className="text-gray-500 italic">No active alerts.</p>
        )}
      </div>
    </div>
  );
};

// ====================================================================
// --- Sub-Component 3: Track View Panel (textual list) ---
// ====================================================================

const TrackViewPanel: React.FC<{ trains: TrainData[] }> = ({ trains }) => {
  const tracks: Record<string, TrainData[]> = {
    'Track 1 → UP': trains
      .filter((t) => String(t.track) === '1')
      .sort((a, b) => b.delay - a.delay),
    'Track 2 → DOWN': trains
      .filter((t) => String(t.track) === '2')
      .sort((a, b) => b.delay - a.delay),
    'Track 3 → LOOP/BIDIRECTIONAL': trains
      .filter((t) => String(t.track) === '3')
      .sort((a, b) => b.delay - a.delay),
  };

  return (
    <div className="p-4 bg-rail-light rounded-lg shadow-lg border border-gray-700">
      <h2 className="text-xl font-bold mb-3 text-rail-accent border-b border-rail-mid pb-2">
        Track View Panel (Timeline Style)
      </h2>

      {Object.entries(tracks).map(([trackName, trackTrains]) => (
        <div key={trackName} className="mb-4">
          <h3 className="text-md font-semibold text-white mt-2 border-l-4 pl-2 border-rail-accent">
            {trackName}
          </h3>
          <div className="flex flex-col space-y-1 mt-1">
            {trackTrains.length > 0 ? (
              trackTrains.map((t) => {
                const statusClass =
                  t.status === 'Held'
                    ? 'bg-priority-low animate-pulse'
                    : t.priority === 'High (🟢)'
                    ? 'bg-priority-high'
                    : 'bg-gray-500';

                return (
                  <div
                    key={t.train_no}
                    className="p-2 bg-rail-dark rounded flex justify-between items-center border-l-4 border-rail-accent/50 hover:bg-gray-800 transition-colors"
                  >
                    <div>
                      <p className="text-white text-sm font-bold">
                        {t.train_no} - {t.train_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        Delay:{' '}
                        <span className="text-priority-low">{t.delay}m</span> | Action:{' '}
                        <span className="text-rail-accent">
                          {t.recommended_action}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Schedule: {t.schedule_ar} / {t.schedule_dep} | Actual:{' '}
                        {t.actual_ar} / {t.actual_dep}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusClass} text-rail-dark`}
                      >
                        {t.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {t.direction?.toString().toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 text-sm italic">Track clear.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
