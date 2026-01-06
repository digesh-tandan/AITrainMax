import React, { useState, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import Dashboard from './components/Dashboard';
import { TrainData, Alert, WeatherData } from './types/types';
import './index.css';

interface LiveData {
  trains: TrainData[];
  alerts: Alert[];
  weather: WeatherData;
}

const DEFAULT_LIVE_DATA: LiveData = {
  trains: [],
  alerts: [],
  weather: {
    current_condition: 'Clear',
    icon: '☀️',
    alert_level: 'GREEN',
    alerts: [],
  },
};

const App: React.FC = () => {
  const [liveData, setLiveData] = useState<LiveData>(DEFAULT_LIVE_DATA);
  const [activeDB, setActiveDB] = useState<'india_db' | 'cg_db'>('cg_db');

  const selectedTrain: TrainData =
    liveData.trains.length > 0
      ? liveData.trains.reduce((prev, current) =>
          prev.delay < current.delay ? prev : current
        )
      : ({
          train_no: 'N/A',
          train_name: 'No Active Trains',
          train_type: 'N/A',
          schedule_ar: '00:00',
          schedule_dep: '00:00',
          actual_ar: '00:00',
          actual_dep: '00:00',
          delay: 0,
          track: '1',
          direction: 'up',
          priority: 'Medium (🟡)',
          status: 'Scheduled',
          current_lat: 0,
          current_lon: 0,
          recommended_action: 'None',
        } as TrainData);

  // Real-time data fetch
  useEffect(() => {
    const fetchRealtimeData = async () => {
      try {
        const response = await fetch('/api/trains/active');
        const raw = await response.json();

        const safeWeather: WeatherData = {
          current_condition: raw.weather?.current_condition ?? 'Clear',
          icon: raw.weather?.icon ?? '☀️',
          alert_level: raw.weather?.alert_level ?? 'GREEN',
          alerts: Array.isArray(raw.weather?.alerts) ? raw.weather.alerts : [],
        };

        const safeData: LiveData = {
          trains: Array.isArray(raw.trains) ? raw.trains : [],
          alerts: Array.isArray(raw.alerts) ? raw.alerts : [],
          weather: safeWeather,
        };

        setLiveData(safeData);
      } catch (error) {
        console.error(
          'Error fetching live data from Flask API. Ensure the backend is running on port 5000:',
          error
        );
      }
    };

    const intervalId = setInterval(fetchRealtimeData, 5000);
    fetchRealtimeData();

    return () => clearInterval(intervalId);
  }, [activeDB]);

  const handleDbSwitch = async (db: 'india_db' | 'cg_db') => {
    try {
      const response = await fetch(`/api/db/switch?source=${db}`);
      const data = await response.json();

      if (data.status === 'success') {
        setActiveDB(db);
        setLiveData(DEFAULT_LIVE_DATA);
        console.log(data.message);
      }
    } catch (error) {
      console.error('Error switching database:', error);
    }
  };

  const combinedAlerts: Alert[] = [
    ...(Array.isArray(liveData.weather.alerts) ? liveData.weather.alerts : []),
    ...(Array.isArray(liveData.alerts) ? liveData.alerts : []),
  ];

  return (
    <div className="flex flex-col h-screen bg-rail-dark text-white font-mono">
      <header className="p-4 bg-rail-mid shadow-2xl border-b border-rail-accent/80">
        <h1 className="text-3xl font-extrabold text-rail-accent">
          RAILWAY TRAFFIC COMMAND CENTER{' '}
          <span className="text-xl text-gray-400">
            | {activeDB === 'cg_db' ? 'CHHATTISGARH' : 'INDIA'} VIEW
          </span>
        </h1>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Map side */}
        <section className="flex-grow bg-rail-dark relative">
          <MapComponent
            trains={liveData.trains}
            weather={liveData.weather}
            activeDB={activeDB}
          />
        </section>

        {/* Dashboard side – widened */}
        <aside className="w-[520px] flex-shrink-0 bg-rail-mid border-l border-rail-light overflow-y-auto">
          <Dashboard
            trains={liveData.trains}
            alerts={combinedAlerts}
            selectedTrain={selectedTrain}
            onDbSwitch={handleDbSwitch}
            activeDB={activeDB}
          />
        </aside>
      </main>

      <footer className="p-2 bg-rail-mid text-xs text-gray-500 border-t border-rail-light flex justify-between">
        <span className="text-rail-accent">© Created by Team Junoon</span>
        <span>Digesh Kumar Tandan , Harsh Kumar Sahani , Nandini Malviya , Prakriti Choudhary , Yagini Sahu</span>
        <span>Version: v1.0.0</span>
      </footer>
    </div>
  );
};

export default App;
