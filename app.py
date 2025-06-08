import logging
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from datetime import datetime, date, time, timedelta
from models import (
    db,
    Soldier,
    Functionality,
    Restriction,
    Condition,
    Position,
    GuardDuty,
    get_next_index
)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///guard_management.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
CORS(app)
logging.basicConfig(level=logging.DEBUG)

with app.app_context():
    # For development only – drop_all() will reset data each run
    # In production remove drop_all() and use migrations instead
    db.drop_all()
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

# --- Catalog endpoints ---
@app.route('/functionalities', methods=['GET', 'POST'])
def manage_functionalities():
    if request.method == 'POST':
        func = Functionality(name=request.json['name'])
        db.session.add(func)
        db.session.commit()
        return jsonify(message='Functionality added'), 201
    return jsonify([{'id': f.id, 'name': f.name} for f in Functionality.query.all()])

@app.route('/restrictions', methods=['GET', 'POST'])
def manage_restrictions():
    if request.method == 'POST':
        rest = Restriction(name=request.json['name'])
        db.session.add(rest)
        db.session.commit()
        return jsonify(message='Restriction added'), 201
    return jsonify([{'id': r.id, 'name': r.name} for r in Restriction.query.all()])

@app.route('/conditions', methods=['GET', 'POST'])
def manage_conditions():
    if request.method == 'POST':
        cond = Condition(name=request.json['name'])
        db.session.add(cond)
        db.session.commit()
        return jsonify(message='Condition added'), 201
    return jsonify([{'id': c.id, 'name': c.name} for c in Condition.query.all()])

# --- Soldier endpoints ---
@app.route('/soldiers', methods=['GET', 'POST'])
def manage_soldiers():
    if request.method == 'POST':
        data = request.json
        idx = get_next_index()
        soldier = Soldier(
            first_name=data['first_name'],
            last_name=data['last_name'],
            personal_id=data.get('personal_id'),
            index=idx
        )
        # attach functionality, restrictions, incompatibilities
        for fid in data.get('functionality_ids', []):
            f = Functionality.query.get(fid)
            if f: soldier.functionalities.append(f)
        for rid in data.get('restriction_ids', []):
            r = Restriction.query.get(rid)
            if r: soldier.restrictions.append(r)
        for iid in data.get('incompatible_ids', []):
            other = Soldier.query.get(iid)
            if other: soldier.incompatible_soldiers.append(other)

        db.session.add(soldier)
        db.session.commit()
        return jsonify(message='Soldier enrolled'), 201

    soldiers = Soldier.query.order_by(Soldier.index).all()
    return jsonify([{
        'id': s.id,
        'first_name': s.first_name,
        'last_name': s.last_name,
        'personal_id': s.personal_id,
        'index': s.index,
        'functionalities': [f.name for f in s.functionalities],
        'restrictions': [r.name for r in s.restrictions],
        'incompatible_ids': [o.id for o in s.incompatible_soldiers]
    } for s in soldiers])

@app.route('/soldiers/<int:id>', methods=['DELETE'])
def delete_soldier(id):
    s = Soldier.query.get_or_404(id)
    db.session.delete(s)
    db.session.commit()
    return jsonify(message='Soldier deleted'), 200

# --- Position endpoints ---
@app.route('/positions', methods=['GET', 'POST'])
def manage_positions():
    if request.method == 'POST':
        data = request.json
        p = Position(
            name=data['name'],
            required_count=data.get('required_count', 1),
            requires_functionality_id=data.get('requires_functionality_id')
        )
        for cid in data.get('condition_ids', []):
            c = Condition.query.get(cid)
            if c: p.conditions.append(c)
        for rid in data.get('restriction_ids', []):
            r = Restriction.query.get(rid)
            if r: p.restrictions.append(r)

        db.session.add(p)
        db.session.commit()
        return jsonify(message='Position added'), 201

    result = []
    for p in Position.query.all():
        result.append({
            'id': p.id,
            'name': p.name,
            'required_count': p.required_count,
            'functionalities': [f.name for f in p.functionalities],
            'conditions':      [c.name for c in p.conditions],
            'restrictions':    [r.name for r in p.restrictions],
        })
    return jsonify(result)

@app.route('/positions/<int:id>', methods=['DELETE'])
def delete_position(id):
    p = Position.query.get_or_404(id)
    db.session.delete(p)
    db.session.commit()
    return jsonify(message='Position deleted'), 200

# --- Shift generation ---
@app.route('/generate_shifts', methods=['POST'])
def generate_shifts():
    data       = request.json or {}
    shift_times= data.get('shift_times', [])
    if not shift_times:
        return jsonify(error='No shift_times provided'), 400

    stations  = Position.query.all()
    soldiers  = Soldier.query.all()
    generated, warnings = [], []

    for st in stations:
        conds = {c.name for c in st.conditions}
        incompatible_map = {
            s.id: {o.id for o in s.incompatible_soldiers}
            for s in soldiers
        }

        # 1) filter by condition ↛ restriction
        eligible = [
            s for s in soldiers
            if not (conds & {r.name for r in s.restrictions})
        ]
        if len(eligible) < st.required_count:
            warnings.append(f"Not enough eligible for '{st.name}'")
            continue

        # 2) pick non-incompatible team of size required_count
        assigned = []
        for s in eligible:
            if all(s.id not in incompatible_map[a.id] and a.id not in incompatible_map[s.id]
                   for a in assigned):
                assigned.append(s)
                if len(assigned) == st.required_count:
                    break

        if len(assigned) < st.required_count:
            warnings.append(f"Couldn’t find conflict-free team for '{st.name}'")
            continue

        # 3) for each time slot, parse HH:MM → datetime
        today = date.today()
        for slot in shift_times:
            try:
                hh, mm = slot['start'].split(':')
                start_dt = datetime.combine(today, time(int(hh), int(mm)))
                hh2, mm2 = slot['end'].split(':')
                end_dt   = datetime.combine(today, time(int(hh2), int(mm2)))
            except Exception:
                # bad format, skip this slot
                continue

            # if end is earlier → next day
            if end_dt <= start_dt:
                end_dt += timedelta(days=1)

            for s in assigned:
                generated.append({
                    'station':      st.name,
                    'soldier_id':   s.id,
                    'soldier_name': f"{s.first_name} {s.last_name}",
                    'start_time':   start_dt.isoformat(),
                    'end_time':     end_dt.isoformat()
                })

    return jsonify(generated_shifts=generated, warnings=warnings)


@app.route('/guard_duties', methods=['GET','POST'])
def manage_guard_duties():
    if request.method == 'POST':
        data = request.json or {}
        # validate soldier & position
        soldier = Soldier.query.get(data.get('soldier_id'))
        if not soldier:
            return jsonify(error='Invalid soldier_id'), 400
        position = Position.query.get(data.get('position_id'))
        if not position:
            return jsonify(error='Invalid position_id'), 400
        # parse times
        try:
            start = datetime.fromisoformat(data['start_time'])
            end   = datetime.fromisoformat(data['end_time'])
        except (KeyError, ValueError):
            return jsonify(error='Invalid ISO timestamp'), 400

        duty = GuardDuty(
            soldier_id=soldier.id,
            position_id=position.id,
            start_time=start,
            end_time=end
        )
        db.session.add(duty)
        db.session.commit()
        return jsonify(message='Guard duty added', id=duty.id), 201

    # GET: return all duties
    duties = GuardDuty.query.all()
    return jsonify([{
        'id': d.id,
        'soldier': f"{d.soldier.first_name} {d.soldier.last_name}",
        'position': d.position.name,
        'start_time': d.start_time.isoformat(),
        'end_time': d.end_time.isoformat()
    } for d in duties])

@app.route('/guard_duties/<int:id>', methods=['DELETE'])
def delete_guard_duty(id):
    duty = GuardDuty.query.get_or_404(id)
    db.session.delete(duty)
    db.session.commit()
    return jsonify(message='Guard duty deleted'), 200


if __name__ == '__main__':
    app.run(debug=True)
