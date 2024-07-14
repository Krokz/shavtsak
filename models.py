from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Soldier(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    is_mag_certified = db.Column(db.Boolean, default=False)
    index = db.Column(db.Integer, nullable=False, default=0)

class Station(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    required_soldiers = db.Column(db.Integer, nullable=False, default=1)
    requires_mag = db.Column(db.Boolean, nullable=False, default=False)

class GuardDuty(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    station_id = db.Column(db.Integer, db.ForeignKey('station.id'), nullable=False)
    soldier_id = db.Column(db.Integer, db.ForeignKey('soldier.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    station = db.relationship('Station', backref=db.backref('duties', lazy=True))
    soldier = db.relationship('Soldier', backref=db.backref('duties', lazy=True))

