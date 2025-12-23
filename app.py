from flask import Flask, render_template, jsonify, send_file, request, redirect, url_for, session, flash
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from pathlib import Path
import os
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your-secret-key-here-change-this-in-production'

# --- IMPORTANT: CONFIGURE YOUR DATABASE CONNECTION ---
SERVER = 'localhost\\SQLEXPRESS'
DATABASE = 'calmflow_db'

app.config['SQLALCHEMY_DATABASE_URI'] = f'mssql+pyodbc://@{SERVER}/{DATABASE}?driver=ODBC+Driver+18+for+SQL+Server&Trusted_Connection=yes&TrustServerCertificate=yes'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- DATA MODELS ---

# Use the existing table name 'playlist_sound' instead of 'sound_group'
playlist_sound_association = db.Table('playlist_sound',
    db.Column('playlist_id', db.Integer, db.ForeignKey('playlists.id'), primary_key=True),
    db.Column('sound_id', db.Integer, db.ForeignKey('sounds.id'), primary_key=True)
)

# Sound Group association (your existing 'sound_group' table)
sound_group_association = db.Table('sound_group',
    db.Column('sound_id', db.Integer, db.ForeignKey('sounds.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True)
)

# User Model - updated to match existing schema
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=True)  # Make nullable since it doesn't exist yet
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_premium = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=True)  # Make nullable

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Sound(db.Model):
    __tablename__ = 'sounds'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(50), nullable=False)
    icon = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    default_volume = db.Column(db.Float, default=0.5)
    category = db.Column(db.String(50))
    is_premium = db.Column(db.Boolean, default=False)
    
    # Both relationships for compatibility
    groups = db.relationship("Group", secondary=sound_group_association, back_populates="sounds")
    playlists = db.relationship("Playlist", secondary=playlist_sound_association, back_populates="sounds")

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'icon': self.icon,
            'file_path': f'/sounds/{self.file_path}',
            'default_volume': self.default_volume,
            'category': self.category,
            'is_premium': self.is_premium,
            'groups': [group.id for group in self.groups]
        }

class Group(db.Model):
    __tablename__ = 'groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    playlist_icon = db.Column(db.String(255))
    sounds = db.relationship("Sound", secondary=sound_group_association, back_populates="groups")

class Playlist(db.Model):
    __tablename__ = 'playlists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    playlist_icon = db.Column(db.String(255))
    sounds = db.relationship("Sound", secondary=playlist_sound_association, back_populates="playlists")

def add_missing_columns():
    """Add missing columns to existing tables"""
    with app.app_context():
        from sqlalchemy import text
        
        try:
            # Check if username column exists in users table
            result = db.session.execute(text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'username'
            """))
            
            if not result.fetchone():
                print("Adding username column to users table...")
                db.session.execute(text("ALTER TABLE users ADD username NVARCHAR(80)"))
            
            # Check if created_at column exists in users table
            result = db.session.execute(text("""
                SELECT COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'created_at'
            """))
            
            if not result.fetchone():
                print("Adding created_at column to users table...")
                db.session.execute(text("ALTER TABLE users ADD created_at DATETIME DEFAULT GETDATE()"))
            
            db.session.commit()
            print("Database schema updated successfully!")
        except Exception as e:
            print(f"Error updating schema: {e}")
            db.session.rollback()

def seed_data():
    with app.app_context():
        print("=" * 50)
        print("Starting database check...")
        
        # --- 1. Check and seed Groups ---
        groups_data = {
            'nature': ('Nature', 'static/icons/leaf.png'),
            'sleep': ('Sleep', 'static/icons/night.png'),
            'focus': ('Focus', 'static/icons/productive.png'),
            'relax': ('Relax', 'static/icons/relax.png'),
            'city': ('City', 'static/icons/train.png')
        }
        
        groups_dict = {}
        existing_groups_count = 0
        new_groups_count = 0
        
        for key, (name, icon) in groups_data.items():
            group = Group.query.filter_by(name=name).first()
            if not group:
                group = Group(name=name, playlist_icon=icon)
                db.session.add(group)
                new_groups_count += 1
                print(f"✓ Created new group: {name}")
            else:
                existing_groups_count += 1
                print(f"✓ Group exists: {name}")
            groups_dict[key] = group
        
        if new_groups_count > 0:
            db.session.commit()
            print(f"Committed {new_groups_count} new groups to database.")
        
        # --- 2. Check and seed Sounds ---
        sounds_data = [
            {'name': 'rain', 'display_name': 'Rain', 'icon': 'static/icons/rain.png', 
             'file_path': 'rain.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'forest', 'display_name': 'Forest', 'icon': 'static/icons/forest.png', 
             'file_path': 'Forest.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'fire', 'display_name': 'Fire', 'icon': 'static/icons/fire.png', 
             'file_path': 'fire.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'cafe', 'display_name': 'Cafe', 'icon': 'static/icons/cafe.png', 
             'file_path': 'cafe.mp3', 'category': 'ambient', 'is_premium': False},
            {'name': 'fan', 'display_name': 'Fan', 'icon': 'static/icons/fan.png', 
             'file_path': 'fan.mp3', 'category': 'objects', 'is_premium': False},
            {'name': 'leaves', 'display_name': 'Leaves', 'icon': 'static/icons/leaf.png', 
             'file_path': 'leaf.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'night', 'display_name': 'Night', 'icon': 'static/icons/night.png', 
             'file_path': 'night.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'riverstream', 'display_name': 'River Stream', 'icon': 'static/icons/riverstream.png', 
             'file_path': 'riverstream.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'seaside', 'display_name': 'Seaside', 'icon': 'static/icons/wave.png', 
             'file_path': 'seaside.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'snowing', 'display_name': 'Snowing', 'icon': 'static/icons/snowing.png', 
             'file_path': 'snowing.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'thunder', 'display_name': 'Thunder', 'icon': 'static/icons/thunder.png', 
             'file_path': 'thunder.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'train', 'display_name': 'Train', 'icon': 'static/icons/train.png', 
             'file_path': 'train.mp3', 'category': 'ambient', 'is_premium': False},
            {'name': 'underwater', 'display_name': 'Underwater', 'icon': 'static/icons/underwater.png', 
             'file_path': 'underwater.mp3', 'category': 'ambient', 'is_premium': False},
            {'name': 'washingmachine', 'display_name': 'Washing Machine', 'icon': 'static/icons/washingmachine.png', 
             'file_path': 'washingmachine.mp3', 'category': 'objects', 'is_premium': False},
            {'name': 'wind', 'display_name': 'Wind', 'icon': 'static/icons/wind.png', 
             'file_path': 'wind.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'windchime', 'display_name': 'Wind Chime', 'icon': 'static/icons/windchime.png', 
             'file_path': 'windchime.mp3', 'category': 'objects', 'is_premium': False}
        ]
        
        # Dictionary to store sound objects for relationship mapping
        sounds_dict = {}
        existing_sounds_count = 0
        new_sounds_count = 0
        
        for sound_data in sounds_data:
            sound = Sound.query.filter_by(name=sound_data['name']).first()
            if not sound:
                sound = Sound(**sound_data)
                db.session.add(sound)
                new_sounds_count += 1
                print(f"✓ Created new sound: {sound_data['display_name']}")
            else:
                existing_sounds_count += 1
                print(f"✓ Sound exists: {sound_data['display_name']}")
            sounds_dict[sound_data['name']] = sound
        
        if new_sounds_count > 0:
            db.session.commit()
            print(f"Committed {new_sounds_count} new sounds to database.")
        
        # --- 3. Create relationships ONLY for NEW sounds ---
        if new_sounds_count > 0:
            print("Setting up relationships for new sounds...")
            relationships = {
                'rain': ['nature', 'sleep', 'relax'],
                'forest': ['nature', 'relax'],
                'fire': ['nature', 'relax'],
                'cafe': ['city', 'focus'],
                'fan': ['sleep', 'focus'],
                'leaves': ['nature'],
                'night': ['sleep', 'nature'],
                'riverstream': ['nature', 'relax', 'focus'],
                'seaside': ['nature', 'relax'],
                'snowing': ['nature', 'sleep'],
                'thunder': ['nature'],
                'train': ['city', 'focus'],
                'underwater': ['relax'],
                'washingmachine': ['sleep'],
                'wind': ['nature', 'sleep'],
                'windchime': ['relax']
            }
            
            # Apply relationships only to new sounds
            for sound_name, group_names in relationships.items():
                if sound_name in sounds_dict:
                    sound = sounds_dict[sound_name]
                    # Only add relationships if sound is new (has no groups)
                    if not sound.groups:
                        for group_name in group_names:
                            if group_name in groups_dict:
                                sound.groups.append(groups_dict[group_name])
                                print(f"  Added {sound.display_name} to {group_name} group")
            
            db.session.commit()
        
        # --- 4. Summary ---
        print("=" * 50)
        print("DATABASE CHECK COMPLETE")
        print("=" * 50)
        print(f"Groups: {existing_groups_count} existing, {new_groups_count} new")
        print(f"Sounds: {existing_sounds_count} existing, {new_sounds_count} new")
        
        if new_groups_count == 0 and new_sounds_count == 0:
            print("✓ All data already exists in database.")
        else:
            print("✓ Database updated with missing data.")
        print("=" * 50)

# --- ROUTES ---

@app.route('/')
def index():
    # User can access without login
    sounds = Sound.query.all()  # Changed from filter_by(is_premium=False).all()
    groups = Group.query.all()
    sound_dicts = [sound.to_dict() for sound in sounds]
    
    # Check if user is logged in
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    
    return render_template('index.html', 
                         sounds=sound_dicts, 
                         groups=groups,
                         user=user)

@app.route('/login', methods=['GET', 'POST'])
def login():
    # If user is already logged in, redirect to home
    if 'user_id' in session:
        flash('You are already logged in', 'info')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            session['user_id'] = user.id
            flash('Login successful!', 'success')
            return redirect(url_for('index'))
        else:
            flash('Invalid email or password', 'error')
    
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    # If user is already logged in, redirect to home
    if 'user_id' in session:
        flash('You are already logged in', 'info')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        
        # Check if user already exists
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
        elif User.query.filter_by(username=username).first():
            flash('Username already taken', 'error')
        else:
            # Create new user
            new_user = User(username=username, email=email)
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.commit()
            
            session['user_id'] = new_user.id
            flash('Account created successfully!', 'success')
            return redirect(url_for('index'))
    
    return render_template('signup.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    flash('You have been logged out', 'info')
    return redirect(url_for('index'))

@app.route('/user-profile')
def user_profile():
    if 'user_id' not in session:
        flash('Please login to view your profile', 'info')
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    if not user:
        flash('User not found', 'error')
        return redirect(url_for('logout'))
    
    return render_template('user_profile.html', user=user)

@app.route('/api/sounds')
def get_sounds():
    sounds = Sound.query.all()  # Changed from filter_by(is_premium=False).all()
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
        # Add missing columns to existing tables
        add_missing_columns()
        
        # Create tables if they don't exist (won't affect existing tables)
        db.create_all()
        
        # Seed data if needed
        seed_data()
        
    app.run(debug=True)