// src/components/MapComponent.tsx

import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TrainData, WeatherData } from '../types/types';

mapboxgl.accessToken =
  'pk.eyJ1IjoiZGlnZXNoOTIiLCJhIjoiY21pM3o5N3d6MHVwMDJqcXI0M3N4MWJxMSJ9.yX4uDG2ZK_uLyUc_Ol_Shg';

interface Props {
  trains: TrainData[];
  weather: WeatherData;
  activeDB: 'india_db' | 'cg_db';
}

const INDIA_CENTER: [number, number] = [77.0, 23.0];
const CG_CENTER: [number, number] = [82.0, 21.5];
const BSP_AKALTARA_CENTER: [number, number] = [82.075, 22.07];

type Region = 'india' | 'cg' | 'bsp';

const MapComponent: React.FC<Props> = ({ trains, weather, activeDB }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [isLightMap, setIsLightMap] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region>('india');

  // ----------------- MAP INIT -----------------
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: activeDB === 'cg_db' ? CG_CENTER : INDIA_CENTER,
      zoom: activeDB === 'cg_db' ? 6 : 4,
    });

    mapRef.current = map;

    // Debug: log any Mapbox errors in browser console
    map.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.error('Mapbox error:', e.error);
    });

    map.on('load', () => {
      // Make sure map gets correct size
      map.resize();

      // Source for trains
      map.addSource('trains-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Train circles
      map.addLayer({
        id: 'trains-layer',
        type: 'circle',
        source: 'trains-source',
        paint: {
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-color': [
            'match',
            ['get', 'priority'],
            'High (🟢)',
            '#34D399',
            'Medium (🟡)',
            '#FBBF24',
            '#EF4444',
          ],
          'circle-opacity': 1,
        },
      });

      // Train labels
      map.addLayer({
        id: 'trains-labels',
        type: 'symbol',
        source: 'trains-source',
        layout: {
          'text-field': ['get', 'train_label'],
          'text-size': 12,
          'text-offset': [0, -1.6],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        },
      });

      // Region highlight source + layers
      map.addSource('region-highlight', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'region-highlight-fill',
        type: 'fill',
        source: 'region-highlight',
        paint: {
          'fill-color': '#00ffc8',
          'fill-opacity': 0.08,
        },
      });

      map.addLayer({
        id: 'region-highlight-outline',
        type: 'line',
        source: 'region-highlight',
        paint: {
          'line-color': '#00ffc8',
          'line-width': 2,
        },
      });
    });

    // Handle window resize (important in flex layouts)
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeDB]);

  // ----------------- UPDATE TRAINS -----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let src: mapboxgl.GeoJSONSource | undefined;
    try {
      src = map.getSource('trains-source') as mapboxgl.GeoJSONSource;
    } catch {
      return;
    }
    if (!src) return;

    const features: any[] = trains
      .filter((t) => t.current_lat && t.current_lon)
      .map((t) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [t.current_lon, t.current_lat],
        },
        properties: {
          ...t,
          train_label: `${t.train_no} ${t.train_name}`,
        },
      }));

    src.setData({
      type: 'FeatureCollection',
      features,
    } as any);
  }, [trains]);

  // ----------------- BLINK HELD TRAINS -----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let visible = true;
    const id = window.setInterval(() => {
      const m = mapRef.current;
      if (!m || !m.getLayer('trains-layer')) return;

      const opacityExpr: any = [
        'case',
        ['==', ['get', 'status'], 'Held'],
        visible ? 1 : 0.2,
        1,
      ];

      m.setPaintProperty('trains-layer', 'circle-opacity', opacityExpr);
      visible = !visible;
    }, 500);

    return () => window.clearInterval(id);
  }, []);

  // ----------------- REGION HIGHLIGHT -----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let src: mapboxgl.GeoJSONSource | undefined;
    try {
      src = map.getSource('region-highlight') as mapboxgl.GeoJSONSource;
    } catch {
      return;
    }
    if (!src) return;

    let coords: [number, number][];

    if (activeRegion === 'india') {
      coords = [
        [68, 6],
        [97, 6],
        [97, 37],
        [68, 37],
        [68, 6],
      ];
    } else if (activeRegion === 'cg') {
      coords = [
        [80, 17],
        [84.5, 17],
        [84.5, 24.5],
        [80, 24.5],
        [80, 17],
      ];
    } else {
      // BSP–Akaltara small box
      coords = [
        [81.4, 21.4],
        [82.75, 21.4],
        [82.75, 22.7],
        [81.4, 22.7],
        [81.4, 21.4],
      ];
    }

    src.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [coords] },
          properties: {},
        } as any,
      ],
    } as any);
  }, [activeRegion]);

  // ----------------- MAP BACKGROUND THEME -----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      map.setPaintProperty(
        'background',
        'background-color',
        isLightMap ? '#f4f4f5' : '#000000'
      );
    } catch {
      // background layer missing -> ignore
    }
  }, [isLightMap]);

  // ----------------- DB CHANGE -> FLY -----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const center = activeDB === 'cg_db' ? CG_CENTER : INDIA_CENTER;
    const zoom = activeDB === 'cg_db' ? 6 : 4;
    map.flyTo({ center, zoom, essential: true });

    setActiveRegion(activeDB === 'cg_db' ? 'cg' : 'india');
  }, [activeDB]);

  // ----------------- NAVIGATION HANDLERS -----------------
  const navigateToIndia = () => {
    const map = mapRef.current;
    if (!map) return;
    setActiveRegion('india');
    map.flyTo({ center: INDIA_CENTER, zoom: 4, essential: true });
  };

  const navigateToCG = () => {
    const map = mapRef.current;
    if (!map) return;
    setActiveRegion('cg');
    map.flyTo({ center: CG_CENTER, zoom: 6, essential: true });
  };

  const navigateToBSPSection = () => {
    const map = mapRef.current;
    if (!map) return;
    setActiveRegion('bsp');
    map.flyTo({ center: BSP_AKALTARA_CENTER, zoom: 10, essential: true });
  };

  return (
    <div className="h-full w-full relative">
      <div ref={mapContainer} className="h-full w-full map-container" />

      {/* Map Navigation Controls */}
      <div className="absolute top-4 left-4 z-10 space-y-2 flex flex-col">
        <button
          onClick={navigateToIndia}
          className="p-2 bg-rail-light hover:bg-rail-mid text-white rounded shadow-lg border border-rail-accent/50 text-sm"
        >
          1. India Level
        </button>
        <button
          onClick={navigateToCG}
          className="p-2 bg-rail-light hover:bg-rail-mid text-white rounded shadow-lg border border-rail-accent/50 text-sm"
        >
          2. Chhattisgarh Level
        </button>
        <button
          onClick={navigateToBSPSection}
          className="p-2 bg-rail-light hover:bg-rail-mid text-white rounded shadow-lg border border-rail-accent text-sm"
        >
          3. BSP-Akaltara Section
        </button>
      </div>

      {/* Weather / Theme Toggle Icon */}
      <button
        className={`absolute top-4 right-4 z-10 p-3 rounded-full shadow-xl text-3xl border-2 transition-colors duration-300 cursor-pointer
          ${
            weather.alert_level === 'RED'
              ? 'text-priority-low border-priority-low bg-rail-light'
              : weather.alert_level === 'YELLOW'
              ? 'text-priority-medium border-priority-medium bg-rail-light'
              : 'text-priority-high border-priority-high bg-rail-light'
          }`}
        title={isLightMap ? 'Switch to dark map' : 'Switch to light map'}
        onClick={() => setIsLightMap((prev) => !prev)}
      >
        <span role="img" aria-label={weather.current_condition}>
          {weather.icon}
        </span>
      </button>
    </div>
  );
};

export default MapComponent;
