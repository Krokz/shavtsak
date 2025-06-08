import random
import logging
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
from models import db, Soldier, Station, GuardDuty

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///guard_management.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
CORS(app)

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# Create the database and tables if they don't exist
with app.app_context():
    db.create_all()

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

def get_next_index():
    all_soldiers = Soldier.query.order_by(Soldier.index).all()
    if not all_soldiers:
        return 1
    all_indexes = [s.index for s in all_soldiers]
    for i in range(1, len(all_indexes) + 2):
        if i not in all_indexes:
            return i

@app.route('/soldiers', methods=['GET', 'POST'])
def manage_soldiers():
    if request.method == 'POST':
        data = request.json
        next_index = get_next_index()
        soldier = Soldier(name=data['name'], is_mag_certified=data['is_mag_certified'], index=next_index)
        db.session.add(soldier)
        db.session.commit()
        return jsonify({'message': 'Soldier added successfully'}), 201
    soldiers = Soldier.query.order_by(Soldier.index).all()
    return jsonify([{'id': s.id, 'name': s.name, 'is_mag_certified': s.is_mag_certified, 'index': s.index} for s in soldiers])

@app.route('/soldiers/<int:id>', methods=['DELETE'])
def delete_soldier(id):
    soldier = Soldier.query.get_or_404(id)
    db.session.delete(soldier)
    db.session.commit()
    return jsonify({'message': 'Soldier deleted successfully'}), 200

@app.route('/stations', methods=['GET', 'POST'])
def manage_stations():
    if request.method == 'POST':
        data = request.json
        station = Station(name=data['name'], required_soldiers=data['required_soldiers'], requires_mag=data['requires_mag'])
        db.session.add(station)
        db.session.commit()
        return jsonify({'message': 'Station added successfully'}), 201
    stations = Station.query.all()
    return jsonify([{'id': s.id, 'name': s.name, 'required_soldiers': s.required_soldiers, 'requires_mag': s.requires_mag} for s in stations])

@app.route('/stations/<int:id>', methods=['DELETE'])
def delete_station(id):
    station = Station.query.get_or_404(id)
    db.session.delete(station)
    db.session.commit()
    return jsonify({'message': 'Station deleted successfully'}), 200

@app.route('/guard_duties', methods=['GET', 'POST'])
def manage_guard_duties():
    if request.method == 'POST':
        data = request.json
        duty = GuardDuty(
            station_id=data['station_id'],
            soldier_id=data['soldier_id'],
            start_time=datetime.fromisoformat(data['start_time']),
            end_time=datetime.fromisoformat(data['end_time'])
        )
        db.session.add(duty)
        db.session.commit()
        return jsonify({'message': 'Guard duty added successfully'}), 201
    duties = GuardDuty.query.all()
    return jsonify([{
        'id': d.id,
        'station_id': d.station_id,
        'soldier_id': d.soldier_id,
        'start_time': d.start_time.isoformat(),
        'end_time': d.end_time.isoformat()
    } for d in duties])

@app.route('/generate_shifts', methods=['POST'])
def generate_shifts():
    try:
        data = request.json
        logging.debug(f"Received shift generation request with data: {data}")
        stations = Station.query.all()
        soldiers = Soldier.query.order_by(Soldier.index).all()
        shift_times = data['shift_times']

        if not stations or not soldiers or not shift_times:
            logging.error("Missing stations, soldiers, or shift times")
            return jsonify({'error': 'Missing stations, soldiers, or shift times'}), 400

        # Shuffle soldiers to randomize their order
        random.shuffle(soldiers)
        warnings = []
        generated_shifts = []
        current_soldier_index = 0
        soldier_last_shift_end = {soldier.id: datetime.min for soldier in soldiers}
        shift_duration = (datetime.strptime(shift_times[0]['end'], "%H:%M") - datetime.strptime(shift_times[0]['start'], "%H:%M")).seconds // 3600

        for shift_time in shift_times:
            start_time = datetime.strptime(shift_time['start'], "%H:%M").replace(year=datetime.now().year, month=datetime.now().month, day=datetime.now().day)
            end_time = datetime.strptime(shift_time['end'], "%H:%M").replace(year=datetime.now().year, month=datetime.now().month, day=datetime.now().day)
            if end_time < start_time:
                end_time += timedelta(days=1)

            for station in stations:
                required_soldiers = station.required_soldiers
                assigned_soldiers = []

                available_soldiers = [s for s in soldiers if (start_time - soldier_last_shift_end[s.id]).total_seconds() >= shift_duration * 3600 * 2]
                logging.debug(f"Station: {station.name}, Available soldiers with full rest: {len(available_soldiers)}")

                if not available_soldiers:
                    available_soldiers = [s for s in soldiers if (start_time - soldier_last_shift_end[s.id]).total_seconds() >= shift_duration * 3600]
                    logging.debug(f"Station: {station.name}, Available soldiers with reduced rest: {len(available_soldiers)}")

                while required_soldiers > 0 and available_soldiers:
                    soldier = available_soldiers.pop(0)
                    if station.requires_mag and not any(s.is_mag_certified for s in assigned_soldiers) and soldier.is_mag_certified:
                        assigned_soldiers.append(soldier)
                        required_soldiers -= 1
                    elif not station.requires_mag or (station.requires_mag and any(s.is_mag_certified for s in assigned_soldiers)):
                        assigned_soldiers.append(soldier)
                        required_soldiers -= 1
                    soldier_last_shift_end[soldier.id] = end_time

                if required_soldiers > 0:
                    # Fallback to reduce rest time
                    fallback_available_soldiers = [s for s in soldiers if (start_time - soldier_last_shift_end[s.id]).total_seconds() >= shift_duration * 3600 and s not in assigned_soldiers]
                    logging.debug(f"Station: {station.name}, Fallback available soldiers: {len(fallback_available_soldiers)}")

                    while required_soldiers > 0 and fallback_available_soldiers:
                        soldier = fallback_available_soldiers.pop(0)
                        if station.requires_mag and not any(s.is_mag_certified for s in assigned_soldiers) and soldier.is_mag_certified:
                            assigned_soldiers.append(soldier)
                            required_soldiers -= 1
                        elif not station.requires_mag or (station.requires_mag and any(s.is_mag_certified for s in assigned_soldiers)):
                            assigned_soldiers.append(soldier)
                            required_soldiers -= 1

                        soldier_last_shift_end[soldier.id] = end_time

                if assigned_soldiers:
                    shift = {
                        'station': station.name,
                        'soldiers': [{'name': s.name, 'is_mag_certified': s.is_mag_certified} for s in assigned_soldiers],
                        'start_time': start_time.isoformat(),
                        'end_time': end_time.isoformat()
                    }
                    generated_shifts.append(shift)
                else:
                    warnings.append(f"Not enough soldiers to fill the required shifts for station: {station.name}")

        logging.debug(f"Generated shifts: {generated_shifts}")
        return jsonify({'generated_shifts': generated_shifts, 'warnings': warnings})
    except Exception as e:
        logging.error(f"Error generating shifts: {e}")
        return jsonify({'error': 'Failed to generate shifts'}), 500

if __name__ == '__main__':
    app.run(debug=True)
