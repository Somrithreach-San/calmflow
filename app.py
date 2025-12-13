from flask import Flask, render_template, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from pathlib import Path
import os

app = Flask(__name__)

# --- IMPORTANT: CONFIGURE YOUR DATABASE CONNECTION ---
SERVER = 'localhost\\SQLEXPRESS'
DATABASE = 'calmflow_db'

app.config['SQLALCHEMY_DATABASE_URI'] = f'mssql+pyodbc://@{SERVER}/{DATABASE}?driver=ODBC+Driver+18+for+SQL+Server&Trusted_Connection=yes&TrustServerCertificate=yes'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- DATA MODELS ---

sound_group_association = db.Table('sound_group',
    db.Column('sound_id', db.Integer, db.ForeignKey('sounds.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True)
)

class Sound(db.Model):
    __tablename__ = 'sounds'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(50), nullable=False)
    icon = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    default_volume = db.Column(db.Float, default=0.5)
    category = db.Column(db.String(50))
    groups = db.relationship("Group", secondary=sound_group_association, back_populates="sounds")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'icon': self.icon,
            'file_path': f'/sounds/{self.file_path}',
            'default_volume': self.default_volume,
            'category': self.category,
            'groups': [group.id for group in self.groups]
        }

class Group(db.Model):
    __tablename__ = 'groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    playlist_icon = db.Column(db.String(255))
    sounds = db.relationship("Sound", secondary=sound_group_association, back_populates="groups")

def seed_data():
    with app.app_context():
        # Using Sound as a proxy to check if seeding is needed.
        if db.session.query(Sound).first() is not None:
            print("Database already contains data. Skipping seeding.")
            return

        print("Database is empty. Seeding all sounds and groups...")

        # --- 1. Define and Create Groups ---
        groups = {
            'nature': Group(name='Nature', playlist_icon='static/icons/leaf.png'),
            'sleep': Group(name='Sleep', playlist_icon='static/icons/night.png'),
            'focus': Group(name='Focus', playlist_icon='static/icons/productive.png'),
            'relax': Group(name='Relax', playlist_icon='static/icons/relax.png'),
            'city': Group(name='City', playlist_icon='static/icons/train.png')
        }
        db.session.add_all(groups.values())

        # --- 2. Define and Create Sounds ---
        sounds = {
            'rain': Sound(name='rain', display_name='Rain', icon='static/icons/rain.png', file_path='rain.mp3', category='nature'),
            'forest': Sound(name='forest', display_name='Forest', icon='static/icons/forest.png', file_path='Forest.mp3', category='nature'),
            'fire': Sound(name='fire', display_name='Fire', icon='static/icons/fire.png', file_path='fire.mp3', category='nature'),
            'cafe': Sound(name='cafe', display_name='Cafe', icon='static/icons/cafe.png', file_path='cafe.mp3', category='ambient'),
            'fan': Sound(name='fan', display_name='Fan', icon='static/icons/fan.png', file_path='fan.mp3', category='objects'),
            'leaves': Sound(name='leaves', display_name='Leaves', icon='static/icons/leaf.png', file_path='leaf.mp3', category='nature'),
            'night': Sound(name='night', display_name='Night', icon='static/icons/night.png', file_path='night.mp3', category='nature'),
            'riverstream': Sound(name='riverstream', display_name='River Stream', icon='static/icons/riverstream.png', file_path='riverstream.mp3', category='nature'),
            'seaside': Sound(name='seaside', display_name='Seaside', icon='static/icons/wave.png', file_path='seaside.mp3', category='nature'),
            'snowing': Sound(name='snowing', display_name='Snowing', icon='static/icons/snowing.png', file_path='snowing.mp3', category='nature'),
            'thunder': Sound(name='thunder', display_name='Thunder', icon='static/icons/thunder.png', file_path='thunder.mp3', category='nature'),
            'train': Sound(name='train', display_name='Train', icon='static/icons/train.png', file_path='train.mp3', category='ambient'),
            'underwater': Sound(name='underwater', display_name='Underwater', icon='static/icons/underwater.png', file_path='underwater.mp3', category='ambient'),
            'washingmachine': Sound(name='washingmachine', display_name='Washing Machine', icon='static/icons/washingmachine.png', file_path='washingmachine.mp3', category='objects'),
            'wind': Sound(name='wind', display_name='Wind', icon='static/icons/wind.png', file_path='wind.mp3', category='nature'),
            'windchime': Sound(name='windchime', display_name='Wind Chime', icon='static/icons/windchime.png', file_path='windchime.mp3', category='objects')
        }
        db.session.add_all(sounds.values())
        
        # --- 3. Create the relationships ---
        sounds['rain'].groups.extend([groups['nature'], groups['sleep'], groups['relax']])
        sounds['forest'].groups.extend([groups['nature'], groups['relax']])
        sounds['fire'].groups.extend([groups['nature'], groups['relax']])
        sounds['cafe'].groups.extend([groups['city'], groups['focus']])
        sounds['fan'].groups.extend([groups['sleep'], groups['focus']])
        sounds['leaves'].groups.append(groups['nature'])
        sounds['night'].groups.extend([groups['sleep'], groups['nature']])
        sounds['riverstream'].groups.extend([groups['nature'], groups['relax'], groups['focus']])
        sounds['seaside'].groups.extend([groups['nature'], groups['relax']])
        sounds['snowing'].groups.extend([groups['nature'], groups['sleep']])
        sounds['thunder'].groups.append(groups['nature'])
        sounds['train'].groups.extend([groups['city'], groups['focus']])
        sounds['underwater'].groups.append(groups['relax'])
        sounds['washingmachine'].groups.append(groups['sleep'])
        sounds['wind'].groups.extend([groups['nature'], groups['sleep']])
        sounds['windchime'].groups.append(groups['relax'])

        # --- 4. Commit all changes ---
        db.session.commit()
        print("All sounds and groups have been seeded to the database.")

@app.route('/')
def index():
    sounds = Sound.query.all()
    groups = Group.query.all()
    sound_dicts = [sound.to_dict() for sound in sounds]
    return render_template('index.html', sounds=sound_dicts, groups=groups)

@app.route('/api/sounds')
def get_sounds():
    sounds = Sound.query.all()
    sound_list = [sound.to_dict() for sound in sounds]
    return jsonify(sound_list)

@app.route('/sounds/<path:filename>')
def serve_sound(filename):
    sound_path = os.path.join(app.root_path, 'static', 'sounds', filename)
    try:
        return send_file(sound_path, mimetype='audio/mpeg')
    except FileNotFoundError:
        return jsonify({'error': 'Sound file not found'}), 404

if __name__ == '__main__':
    with app.app_context():
        # Create tables if they don't exist
        db.create_all()
        # Only seed if database is empty
        if not Sound.query.first():
            seed_data()
        else:
            print("Database already has data. To reseed, delete the database first.")
    app.run(debug=True)