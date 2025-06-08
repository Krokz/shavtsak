from flask_sqlalchemy import SQLAlchemy

# Initialize SQLAlchemy
# You can import this db in app.py

db = SQLAlchemy()

# Association tables for many-to-many relationships
soldier_functionalities = db.Table(
    'soldier_functionalities',
    db.Column('soldier_id', db.Integer, db.ForeignKey('soldier.id'), primary_key=True),
    db.Column('functionality_id', db.Integer, db.ForeignKey('functionality.id'), primary_key=True)
)

soldier_restrictions = db.Table(
    'soldier_restrictions',
    db.Column('soldier_id', db.Integer, db.ForeignKey('soldier.id'), primary_key=True),
    db.Column('restriction_id', db.Integer, db.ForeignKey('restriction.id'), primary_key=True)
)

position_conditions = db.Table(
    'position_conditions',
    db.Column('position_id', db.Integer, db.ForeignKey('position.id'), primary_key=True),
    db.Column('condition_id', db.Integer, db.ForeignKey('condition.id'), primary_key=True)
)

position_restrictions = db.Table(
    'position_restrictions',
    db.Column('position_id', db.Integer, db.ForeignKey('position.id'), primary_key=True),
    db.Column('restriction_id', db.Integer, db.ForeignKey('restriction.id'), primary_key=True)
)

position_functionalities = db.Table(
  'position_functionalities',
  db.Column('position_id',      db.Integer, db.ForeignKey('position.id'),      primary_key=True),
  db.Column('functionality_id', db.Integer, db.ForeignKey('functionality.id'), primary_key=True),
)

soldier_incompatibility = db.Table(
    'soldier_incompatibility',
    db.Column('soldier_id', db.Integer, db.ForeignKey('soldier.id'), primary_key=True),
    db.Column('incompatible_id', db.Integer, db.ForeignKey('soldier.id'), primary_key=True)
)
incompatible_soldiers = db.relationship(
    'Soldier', secondary=soldier_incompatibility,
    primaryjoin=id==soldier_incompatibility.c.soldier_id,
    secondaryjoin=id==soldier_incompatibility.c.incompatible_id,
    backref='incompatible_with'
)

class Functionality(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)

class Restriction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)

class Condition(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)

class Soldier(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(50), nullable=False)
    last_name  = db.Column(db.String(50), nullable=False)

    # new personal ID field
    personal_id = db.Column(db.String(50), nullable=True)

    index = db.Column(db.Integer, nullable=False, default=0)

    # existing many-to-many
    functionalities = db.relationship(
        'Functionality', secondary=soldier_functionalities,
        backref=db.backref('soldiers', lazy='dynamic')
    )
    restrictions = db.relationship(
        'Restriction', secondary=soldier_restrictions,
        backref=db.backref('soldiers', lazy='dynamic')
    )

    # new self-referential many-to-many for incompatibilities
    incompatible_soldiers = db.relationship(
        'Soldier',
        secondary=soldier_incompatibility,
        primaryjoin=id==soldier_incompatibility.c.soldier_id,
        secondaryjoin=id==soldier_incompatibility.c.incompatible_id,
        backref='incompatible_with'
    )
class Position(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    required_count = db.Column(db.Integer, nullable=False, default=1)

    # Whether position requires at least one Negev-certified functionality (example)
    requires_functionality_id = db.Column(db.Integer, db.ForeignKey('functionality.id'), nullable=True)
    requires_functionality = db.relationship('Functionality')

    # Conditions restrictions and functionalities
    conditions = db.relationship(
        'Condition', secondary=position_conditions,
        backref=db.backref('positions', lazy='dynamic')
    )
    restrictions = db.relationship(
        'Restriction', secondary=position_restrictions,
        backref=db.backref('positions', lazy='dynamic')
    )
    functionalities = db.relationship(
        'Functionality',
        secondary=position_functionalities,
        backref=db.backref('positions', lazy='dynamic')
    )

class GuardDuty(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    soldier_id = db.Column(db.Integer, db.ForeignKey('soldier.id'), nullable=False)
    position_id = db.Column(db.Integer, db.ForeignKey('position.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)

    soldier = db.relationship('Soldier', backref=db.backref('duties', lazy=True))
    position = db.relationship('Position', backref=db.backref('duties', lazy=True))

# Utility function for indexing
def get_next_index():
    all_soldiers = Soldier.query.order_by(Soldier.index).all()
    if not all_soldiers:
        return 1
    all_indexes = [s.index for s in all_soldiers]
    for i in range(1, len(all_indexes) + 2):
        if i not in all_indexes:
            return i

