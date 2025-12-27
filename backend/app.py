import os
import json
import pandas as pd
import sqlite3 # Required for SQLite database switching
from flask import Flask, jsonify, request, send_from_directory
from geopy.distance import geodesic
from datetime import datetime, timedelta

# --- Configuration & File Paths ---
app = Flask(__name__)

# File paths based on user uploads
DB_FILES = {
    'india_db': 'india_db.txt',
    'cg_db': 'cg_db.txt',
}
DB_SQLITE_FILES = {
    'india_db': 'india_train.db',
    'cg_db': 'cg_train.db',
}
SCENARIO_FILES = ['Scenario_Hackbios.csv', 'Scenario_Hackbio.txt'] # Prioritize CSV as it was the latest upload

# Simulated Coordinates (for BSP-Akaltara section)
BSP_COORD = (22.09, 82.15) 
AKALTARA_COORD = (22.05, 82.00) 

# --- Global In-Memory Data Store ---
DATA_CACHE = {
    'india_db': None,
    'cg_db': None,
    'scenarios': None,
    'active_db': 'cg_db', # Start with Chhattisgarh view
    'train_sim_state': {}, # Tracks live position/delay for simulation
}

# --- Data Parsing & Loading (Part 1 & SQLite Compatibility) ---

def parse_txt_to_json(filepath, sep='\t'):
    """Reads TXT/CSV using pandas for performance and UTF-8 safety."""
    if not os.path.exists(filepath):
        return []
    
    try:
        # Use pandas to handle large files and structured parsing
        df = pd.read_csv(filepath, sep=sep, encoding='utf-8')
        # Clean up column names (lowercase and replace non-alphanumeric for consistency)
        df.columns = df.columns.str.lower().str.replace('[^a-zA-Z0-9_]', '', regex=True)
        return df.to_dict('records')
    except Exception as e:
        print(f"Error parsing TXT/CSV file {filepath}: {e}")
        return []

def parse_sqlite_to_json(filepath, table_name='trains'):
    """Loads data from the SQLite files (.db)."""
    if not os.path.exists(filepath):
        return []
    
    conn = None
    try:
        conn = sqlite3.connect(filepath)
        # Attempt to read data from common table names for flexibility
        query = f"SELECT * FROM {table_name}"
        try:
             df = pd.read_sql_query(query, conn)
        except pd.io.sql.DatabaseError:
             df = pd.read_sql_query("SELECT * FROM train_data", conn) # Fallback 
             
        df.columns = df.columns.str.lower().str.replace('[^a-zA-Z0-9_]', '', regex=True)
        return df.to_dict('records')
    except Exception as e:
        print(f"Error reading SQLite file {filepath}: {e}")
        return []
    finally:
        if conn:
            conn.close()

def load_all_data():
    """Load data using TXT priority, falling back to SQLite."""
    print("Loading Railway DBs and Scenarios...")
    
    for key in ['india_db', 'cg_db']:
        txt_filepath = DB_FILES[key]
        sqlite_filepath = DB_SQLITE_FILES[key]
        data = []
        
        # 1. Try loading from TXT file (Prioritized)
        if os.path.exists(txt_filepath):
            data = parse_txt_to_json(txt_filepath, sep='\t')
        
        # 2. Fallback to SQLite if TXT failed or was empty
        if not data and os.path.exists(sqlite_filepath):
            print(f"TXT file failed/empty for {key}. Falling back to SQLite...")
            data = parse_sqlite_to_json(sqlite_filepath)
            
        DATA_CACHE[key] = data if data else []
        print(f"Loaded {len(DATA_CACHE[key])} records for {key}.")
    
    # 3. Load Scenario File (Robust to TXT or CSV)
    scenarios_data = []
    for s_file in SCENARIO_FILES:
        if os.path.exists(s_file):
            sep = ',' if s_file.endswith('.csv') else '\t'
            scenarios_data = parse_txt_to_json(s_file, sep=sep)
            if scenarios_data:
                print(f"Loaded Scenarios from {s_file}.")
                break
    
    DATA_CACHE['scenarios'] = scenarios_data
    print(f"Total Scenarios Loaded: {len(scenarios_data)}.")

    # Initialize simulation state (starting with CG data)
    initialize_simulation_state(DATA_CACHE['cg_db'])

def initialize_simulation_state(train_data):
    """Sets initial train positions and state for the simulation engine."""
    state = {}
    if not train_data: return
    
    # Use a maximum of 20 trains for efficient simulation if the DB is huge
    sim_trains = train_data[:20] 

    for i, train in enumerate(sim_trains):
        train_no = train.get('train_no') or train.get('trainid') # Handle both column names
        if not train_no: continue

        # Assign initial position between BSP and AKALTARA
        lat = BSP_COORD[0] + (AKALTARA_COORD[0] - BSP_COORD[0]) * (i / len(sim_trains))
        lon = BSP_COORD[1] + (AKALTARA_COORD[1] - BSP_COORD[1]) * (i / len(sim_trains))
        
        state[train_no] = {
            'lat': lat,
            'lon': lon,
            'speed_kmph': 80,
            'status': 'Running',
            'recommended_action': 'None',
            'delay_minutes': train.get('delay', 0),
        }
    DATA_CACHE['train_sim_state'] = state
    print(f"Initialized simulation state for {len(state)} trains.")


# --- AI Engines and Simulation Logic (Same as before) ---
# NOTE: The AI/Scenario/Simulation logic functions (ai_priority_engine, ai_weather_engine,
# ai_scenario_engine, run_simulation_step) remain structurally the same as they 
# operate on the standardized in-memory JSON data provided by the loading functions.

# [ ... AI PRIORITY ENGINE, AI WEATHER ENGINE, SCENARIO ENGINE, and RUN SIMULATION STEP CODE ... ]
# --- AI Engines (Part 5 & 6) ---

def ai_priority_engine(train_list):
    """
    AI-Powered Train Priority Engine (Part 5)
    Continuously: Read delays, sort, assign priority.
    """
    if not train_list:
        return []
    
    trains_with_delay = []
    for train in train_list:
        train_no = train.get('train_no') or train.get('trainid') 
        if train_no in DATA_CACHE['train_sim_state']:
            delay = DATA_CACHE['train_sim_state'][train_no]['delay_minutes']
            trains_with_delay.append({**train, 'delay': delay, 'train_no': train_no})
    
    sorted_trains = sorted(trains_with_delay, key=lambda x: x['delay'])
    
    if not sorted_trains:
        return []

    num_trains = len(sorted_trains)
    for i, train in enumerate(sorted_trains):
        rank = i / num_trains
        if rank < 0.2:
            train['priority'] = 'High (🟢)' 
        elif rank < 0.7:
            train['priority'] = 'Medium (🟡)'
        else:
            train['priority'] = 'Low (🔴)' 
            
        if train['train_no'] in DATA_CACHE['train_sim_state']:
             DATA_CACHE['train_sim_state'][train['train_no']]['priority'] = train['priority']
             
    return sorted_trains

def ai_weather_engine(train_list):
    """AI-Powered Weather Module (Part 6) - Simulated with location zones."""
    
    current_time = datetime.now().time()
    
    if current_time.hour in [13, 14, 15]: # Simulate peak afternoon storm risk
        condition = 'Storm'
    elif current_time.hour in [6, 7]:
        condition = 'Fog'
    else:
        condition = 'Clear'
        
    weather_map = {
        'Clear': {'icon': '☀️', 'level': 'GREEN'},
        'Cloudy': {'icon': '☁️', 'level': 'GREEN'},
        'Rain': {'icon': '🌧️', 'level': 'YELLOW'},
        'Storm': {'icon': '⛈️', 'level': 'RED'},
        'Fog': {'icon': '🌫️', 'level': 'YELLOW'},
        'Wind': {'icon': '🌬️', 'level': 'YELLOW'},
    }
    
    weather = weather_map.get(condition, weather_map['Clear'])
    
    alerts = []
    if condition in ['Storm', 'Fog']:
        alerts.append({
            'timestamp': datetime.now().strftime("%H:%M:%S"),
            'severity': 'MEDIUM',
            'description': f"Weather Alert: {condition} detected in the Bilaspur-Akaltara section. Reduce visibility.",
            'isWeather': True,
            'icon': weather['icon']
        })
        
    return {
        'current_condition': condition,
        'icon': weather['icon'],
        'alert_level': weather['level'],
        'alerts': alerts
    }

# --- Scenario Engine (Part 8) ---

def ai_scenario_engine(trains):
    """
    Loads scenarios from Scenario_Hackbio.txt/csv and applies them dynamically.
    """
    scenarios = DATA_CACHE['scenarios']
    if not scenarios:
        return {'status': 'error', 'message': 'Scenario data not loaded.', 'actions': [], 'alerts': []}
    
    actions = []
    alerts = []
    
    active_train_states = list(DATA_CACHE['train_sim_state'].items())
    
    for i in range(len(active_train_states)):
        train_no_main, main_state = active_train_states[i]
        
        for j in range(i + 1, len(active_train_states)):
            train_no_conflicting, conflicting_state = active_train_states[j]
            
            # 1. Location proximity check (within 5 km)
            dist = geodesic((main_state['lat'], main_state['lon']), (conflicting_state['lat'], conflicting_state['lon'])).km
            
            if dist < 5: 
                
                # Determine which train is lower priority (Higher delay or Lower priority rank)
                main_priority = main_state.get('priority', 'Medium (🟡)')
                conflicting_priority = conflicting_state.get('priority', 'Medium (🟡)')
                
                # Simple Overtake/Hold Rule: Hold the one with lower priority or higher delay
                if main_priority == 'Low (🔴)' or (main_priority == conflicting_priority and main_state.get('delay_minutes', 0) > conflicting_state.get('delay_minutes', 0)):
                    held_train_no = train_no_main
                    overtake_train_no = train_no_conflicting
                else:
                    held_train_no = train_no_conflicting
                    overtake_train_no = train_no_main
                
                # Check for an explicit scenario match (using the scenario file data)
                # This is a simplification; in a real system, scenario matching is complex
                
                # 3. Apply decisions (hold, overtake, re-route)
                action_main = {'train_no': held_train_no, 'action': 'Hold', 'hold_location': 'Nearest Loop Line'}
                action_conflicting = {'train_no': overtake_train_no, 'action': 'Overtake', 'use_third_track': True}
                
                actions.extend([action_main, action_conflicting])
                
                alerts.append({
                    'timestamp': datetime.now().strftime("%H:%M:%S"),
                    'severity': 'CRITICAL',
                    'description': f"Collision Warning: {held_train_no} HOLD at loop for {overtake_train_no} overtake.",
                    'isWeather': False,
                    'icon': '🚨'
                })
                
    # Update simulation state based on actions
    for action in actions:
        train_no = action['train_no']
        if train_no in DATA_CACHE['train_sim_state']:
            if action['action'] == 'Hold':
                DATA_CACHE['train_sim_state'][train_no]['status'] = 'Held'
                DATA_CACHE['train_sim_state'][train_no]['recommended_action'] = f"Hold at {action.get('hold_location', 'Loop')}"
                DATA_CACHE['train_sim_state'][train_no]['speed_kmph'] = 0
            elif action['action'] == 'Overtake':
                DATA_CACHE['train_sim_state'][train_no]['recommended_action'] = 'Overtake via Track 3'
                DATA_CACHE['train_sim_state'][train_no]['speed_kmph'] = 120 
                DATA_CACHE['train_sim_state'][train_no]['status'] = 'Running'
    
    return {'status': 'success', 'actions': actions, 'alerts': alerts}

# --- Simulation Logic (Part 10) ---

def run_simulation_step(trains):
    """Updates train positions and runs AI/Scenario engines."""
    
    priority_trains = ai_priority_engine(trains)
    scenario_result = ai_scenario_engine(priority_trains)
    
    # Update Positions (Realtime Logic)
    for train in priority_trains:
        train_no = train.get('train_no') or train.get('trainid')
        if train_no in DATA_CACHE['train_sim_state']:
            state = DATA_CACHE['train_sim_state'][train_no]
            
            # Speed control based on state and delay
            speed = state['speed_kmph'] 
            
            distance_travelled_km = speed * (5 / 3600) # Distance traveled in 5 seconds
            
            LAT_PER_KM = 1/111
            LON_PER_KM = 1/105 
            
            # Simulate movement from BSP towards AKALTARA
            if train.get('direction', 'down') == 'down':
                state['lon'] -= distance_travelled_km * LON_PER_KM 
            else:
                state['lon'] += distance_travelled_km * LON_PER_KM

            # Update the full train object
            train['current_lat'] = state['lat']
            train['current_lon'] = state['lon']
            train['priority'] = state['priority']
            train['status'] = state['status']
            train['recommended_action'] = state['recommended_action']
            train['delay'] = state['delay_minutes']
            
    return priority_trains, scenario_result['alerts']

# --- Flask Routes (Part 9) ---

# Flask 2.x me before_first_request hota hai, Flask 3.x me hata diya gaya hai.
# Dono cases ko handle karne ke liye yeh safe fallback use karte hain.

if hasattr(app, "before_first_request"):
    @app.before_first_request
    def setup():
        load_all_data()
else:
    # Flask 3.x ke liye: app start hote hi data load kar do
    load_all_data()


@app.route('/api/db/switch', methods=['GET'])
def switch_db():
    source = request.args.get('source')
    if source in DATA_CACHE and DATA_CACHE[source] is not None:
        DATA_CACHE['active_db'] = source
        initialize_simulation_state(DATA_CACHE[source])
        return jsonify({'status': 'success', 'active_db': source, 'message': f"Switched to {source}"})
    return jsonify({'status': 'error', 'message': 'Invalid or unloaded DB source.'}), 400

@app.route('/api/trains/active', methods=['GET'])
def get_active_trains():
    active_data = DATA_CACHE[DATA_CACHE['active_db']]
    if not active_data:
        return jsonify({'trains': [], 'alerts': [], 'weather': {}}), 200
    
    updated_trains, scenario_alerts = run_simulation_step(active_data)
    weather_data = ai_weather_engine(updated_trains)
    
    alerts = weather_data['alerts'] + scenario_alerts
    
    output_trains = [{
        **t, 
        'current_lat': DATA_CACHE['train_sim_state'].get(t.get('train_no') or t.get('trainid'), {}).get('lat'),
        'current_lon': DATA_CACHE['train_sim_state'].get(t.get('train_no') or t.get('trainid'), {}).get('lon'),
    } for t in updated_trains]

    return jsonify({
        'trains': output_trains,
        'alerts': alerts,
        'weather': weather_data
    })

@app.route('/api/map/india_image', methods=['GET'])
def get_india_map():
    # Placeholder for serving the uploaded India map image
    return send_from_directory('.', 'image_b3ebcd.jpg', mimetype='image/jpeg') 
    
@app.route('/api/map/cg_image', methods=['GET'])
def get_cg_map():
    # Placeholder for serving the uploaded Chhattisgarh map image
    return send_from_directory('.', 'image_b3ebe6.jpg', mimetype='image/jpeg')

@app.route('/api/map/section/bsp-akaltara', methods=['GET'])
def get_bsp_akaltara_section():
    """Returns GeoJSON for detailed track rendering (Simulated)"""
    geojson_data = {
        'map_mode': 'detailed_section',
        'features': [
            {'type': 'LineString', 'coordinates': [BSP_COORD, [22.07, 82.07], AKALTARA_COORD], 'track': 1, 'color': '#4F46E5'},
            {'type': 'LineString', 'coordinates': [BSP_COORD, [22.06, 82.06], AKALTARA_COORD], 'track': 2, 'color': '#F97316'},
            {'type': 'LineString', 'coordinates': [[22.08, 82.10], [22.07, 82.09]], 'track': 3, 'color': '#10B981', 'type': 'loop'},
        ]
    }
    return jsonify(geojson_data)


# --- Run Flask ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)