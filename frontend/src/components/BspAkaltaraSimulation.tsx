// src/components/BspAkaltaraSimulation.tsx

import React, { useEffect, useState } from 'react';

type TrainId = 'MEMU_LOCAL' | 'RAJDHANI' | 'JANSHATABDI' | 'UTKAL_EXP';

interface TrainSimConfig {
  id: TrainId;
  name: string;
  colorClass: string; // Tailwind bg color
}

// Distance model (km)
const TOTAL_DISTANCE = 65; // BSP (0) -> Akaltara (40) -> Champa (65)

// Simulation time: minutes from 12:00
//  0  = 12:00
// 10  = 12:10, etc.

const trainsConfig: TrainSimConfig[] = [
  {
    id: 'MEMU_LOCAL',
    name: 'MEMU Local (On Time)',
    colorClass: 'bg-emerald-400',
  },
  {
    id: 'RAJDHANI',
    name: 'Rajdhani Express (+15m)',
    colorClass: 'bg-yellow-400',
  },
  {
    id: 'JANSHATABDI',
    name: 'Janshatabdi (+30m)',
    colorClass: 'bg-red-400',
  },
  {
    id: 'UTKAL_EXP',
    name: 'Utkal Express (+15m)',
    colorClass: 'bg-sky-400',
  },
];

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Position (km from BSP) for a train at given simulation time (minutes since 12:00)
 *
 * Timeline (same as pehle wali explanation):
 *
 * MEMU Local:
 *  12:00–12:10   -> BSP (0 km)
 *  12:10–12:50   -> BSP -> Akaltara (0 -> 40)
 *  12:50–13:00   -> hold at Akaltara (40)
 *  13:00–13:25   -> Akaltara -> Champa (40 -> 65)
 *
 * Rajdhani:
 *  12:25–12:30   -> BSP (0)
 *  12:30–12:50   -> BSP -> Akaltara (0 -> 40)
 *  12:50–13:10   -> Akaltara -> Champa (40 -> 65) [overtakes MEMU]
 *
 * Janshatabdi:
 *  12:50–13:00   -> Champa (65)
 *  13:00–13:35   -> Champa -> Akaltara (65 -> 40)
 *  13:35–13:45   -> hold at Akaltara (40)
 *  13:45–14:15   -> Akaltara -> BSP (40 -> 0)
 *
 * Utkal Express:
 *  13:00–13:05   -> Champa (65)
 *  13:05–13:35   -> Champa -> Akaltara (65 -> 40)
 *  13:35–14:05   -> Akaltara -> BSP (40 -> 0) [overtakes Janshatabdi]
 */
function getPositionKm(trainId: TrainId, tMin: number): number {
  // MEMU Local
  if (trainId === 'MEMU_LOCAL') {
    if (tMin < 10) return 0;
    if (tMin < 50) {
      const dt = tMin - 10; // 0–40 min -> 0–40 km
      return clamp(dt, 0, 40);
    }
    if (tMin < 60) return 40; // hold at Akaltara
    if (tMin <= 85) {
      const dt = tMin - 60; // 0–25 -> 40–65
      return clamp(40 + (dt * 25) / 25, 40, 65);
    }
    return 65;
  }

  // Rajdhani
  if (trainId === 'RAJDHANI') {
    if (tMin < 25) return 0;
    if (tMin < 30) return 0; // at BSP
    if (tMin < 50) {
      const dt = tMin - 30; // 0–20 -> 0–40
      return clamp((dt * 40) / 20, 0, 40);
    }
    if (tMin <= 70) {
      const dt = tMin - 50; // 0–20 -> 40–65
      return clamp(40 + (dt * 25) / 20, 40, 65);
    }
    return 65;
  }

  // Janshatabdi
  if (trainId === 'JANSHATABDI') {
    if (tMin < 50) return 65;
    if (tMin < 60) return 65; // at Champa
    if (tMin < 95) {
      const dt = tMin - 60; // 0–35 -> 65–40 (towards BSP)
      return clamp(65 - (dt * 25) / 35, 40, 65);
    }
    if (tMin < 105) return 40; // hold at Akaltara
    if (tMin <= 135) {
      const dt = tMin - 105; // 0–30 -> 40–0
      return clamp(40 - (dt * 40) / 30, 0, 40);
    }
    return 0;
  }

  // Utkal Express
  if (trainId === 'UTKAL_EXP') {
    if (tMin < 60) return 65;
    if (tMin < 65) return 65; // at Champa
    if (tMin < 95) {
      const dt = tMin - 65; // 0–30 -> 65–40
      return clamp(65 - (dt * 25) / 30, 40, 65);
    }
    if (tMin <= 125) {
      const dt = tMin - 95; // 0–30 -> 40–0
      return clamp(40 - (dt * 40) / 30, 0, 40);
    }
    return 0;
  }

  return 0;
}

/**
 * Dynamic TRACK index (0/1/2) for each train as per latest logic:
 *
 * MEMU Local:
 *   - Always Track 1 (index 0), BSP -> Akaltara hold -> Champa
 *
 * Rajdhani:
 *   - Comes on Track 2 (index 1) from BSP towards Akaltara
 *   - Jaise hi Akaltara (40 km) cross karti hai, Track 1 (index 0) pe shift ho jati hai
 *     -> Overtake MEMU shown on same track 1, MEMU still hold at Akaltara
 *
 * Janshatabdi:
 *   - Always Track 3 (index 2), Champa -> Akaltara hold -> BSP
 *
 * Utkal Express:
 *   - Champa se Track 2 (index 1) par aati hai
 *   - Akaltara (40 km) ke paas pahuchte hi Track 3 (index 2) par shift
 *     -> Track 3 par Janshatabdi ko overtake karti hai
 */
function getTrackIndex(trainId: TrainId, tMin: number): number {
  if (trainId === 'MEMU_LOCAL') {
    return 0; // Track 1
  }

  if (trainId === 'RAJDHANI') {
    const km = getPositionKm('RAJDHANI', tMin);
    // 40 km se pehle Track 2, uske baad Track 1
    return km < 40 ? 1 : 0;
  }

  if (trainId === 'JANSHATABDI') {
    return 2; // Track 3 always
  }

  if (trainId === 'UTKAL_EXP') {
    const km = getPositionKm('UTKAL_EXP', tMin);
    // Champa se aate hue 40 km tak Track 2, phir Track 3 (overtake)
    return km > 40 ? 1 : 2;
  }

  return 0;
}

/**
 * BSP–Akaltara–Champa 3-track animated simulation
 */
const BspAkaltaraSimulation: React.FC = () => {
  const [simTime, setSimTime] = useState<number>(0); // minutes since 12:00
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(5); // simulation minutes per real second

  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSimTime((prev) => {
        const next = prev + speed * 0.2; // every 200ms -> 0.2s
        // Loop after 150 minutes
        if (next > 150) return 0;
        return next;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  const startTimeLabel = '12:00';
  const currentClock = (() => {
    const totalMinutes = 12 * 60 + simTime;
    const h = Math.floor(totalMinutes / 60);
    const m = Math.floor(totalMinutes % 60)
      .toString()
      .padStart(2, '0');
    return `${h}:${m}`;
  })();

  return (
    <div className="mt-4 p-4 bg-rail-light rounded-lg shadow-lg border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold text-rail-accent flex items-center gap-2">
          🚆 BSP–Akaltara Overtake Simulation
        </h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">Sim Time:</span>
          <span className="text-white font-mono">{currentClock}</span>

          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="ml-3 px-2 py-1 rounded bg-rail-dark border border-rail-accent/60 text-rail-accent hover:bg-rail-mid"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={() => setSimTime(0)}
            className="px-2 py-1 rounded bg-rail-dark border border-gray-500 text-gray-300 hover:bg-rail-mid"
          >
            Reset
          </button>

          <div className="ml-3 flex items-center gap-1">
            <span className="text-gray-400">Speed:</span>
            {[1, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded border text-xs ${
                  speed === s
                    ? 'bg-rail-accent text-rail-dark border-rail-accent'
                    : 'bg-rail-dark text-gray-300 border-gray-600 hover:bg-rail-mid'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Station labels */}
      <div className="flex justify-between text-xs text-gray-400 mb-1 px-3">
        <span>BSP (0 km) – {startTimeLabel}</span>
        <span>Akaltara (40 km)</span>
        <span>Champa (65 km)</span>
      </div>

      {/* Track Area */}
      <div className="relative w-full space-y-3 pt-2 pb-1">
        {[0, 1, 2].map((trackIdx) => (
          <div key={trackIdx} className="relative">
            {/* Track line */}
            <div className="h-3 rounded-full bg-rail-mid border border-rail-accent/40" />

            {/* Track label */}
            <span className="absolute -left-2 -top-4 text-[10px] text-gray-300">
              Track {trackIdx + 1}
            </span>

            {/* Trains currently on this track */}
            {trainsConfig.map((t) => {
              const km = getPositionKm(t.id, simTime);
              const currentTrack = getTrackIndex(t.id, simTime);
              if (currentTrack !== trackIdx) return null;

              const leftPercent = (km / TOTAL_DISTANCE) * 100;

              return (
                <div
                  key={t.id}
                  className="absolute -top-3"
                  style={{ left: `${clamp(leftPercent, 0, 100)}%` }}
                >
                  <div
                    className={`px-2 py-1 rounded-full shadow-lg border border-black/40 text-[10px] text-rail-dark ${t.colorClass}`}
                  >
                    <div className="font-bold">{t.name.split(' ')[0]}</div>
                    <div className="text-[9px]">
                      {t.name.includes('+')
                        ? t.name.split(' ').slice(1).join(' ')
                        : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-gray-300">
        <div>
          <div className="font-semibold text-white mb-1">Scenario Summary</div>
          <ul className="list-disc list-inside space-y-1">
            <li>MEMU Local Track 1 par BSP → Akaltara → Champa.</li>
            <li>
              Rajdhani Track 2 se aakar Akaltara par MEMU ko overtake karke Track 1
              par aa jati hai.
            </li>
            <li>
              Janshatabdi Track 3 par Akaltara pe hold, Utkal Track 2 se aakar
              Akaltara par Track 3 pe shift hokar usko overtake karti hai.
            </li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white mb-1">Color Legend</div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400" /> MEMU Local
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-400" /> Rajdhani Express
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-400" /> Janshatabdi
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-400" /> Utkal Express
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BspAkaltaraSimulation;
