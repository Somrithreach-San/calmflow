# app.py
from flask import Flask, render_template, jsonify, send_file, request, redirect, url_for, session, flash
from pathlib import Path
import os
from datetime import datetime
from models import db, User, Sound, Group, Playlist

app = Flask(__name__)
app.secret_key = 'calmflow-secret-key-change-in-production'

# --- DATABASE CONFIGURATION ---
SERVER = 'localhost\\SQLEXPRESS'
DATABASE = 'calmflow_db'

app.config['SQLALCHEMY_DATABASE_URI'] = f'mssql+pyodbc://@{SERVER}/{DATABASE}?driver=ODBC+Driver+18+for+SQL+Server&Trusted_Connection=yes&TrustServerCertificate=yes'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

# --- ROUTES ---

@app.route('/')
def index():
    # Get all sounds
    sounds = Sound.query.all()
    
    # Get ONLY the 5 groups we want: Nature, Sleep, Focus, Relax, City
    allowed_groups = ['Nature', 'Sleep', 'Focus', 'Relax', 'City']
    groups = Group.query.filter(Group.name.in_(allowed_groups)).order_by(Group.id).all()
    
    # Debug output - shows what's actually being sent to template
    print("\n" + "="*50)
    print("DEBUG: Groups being sent to template:")
    for group in groups:
        sound_names = [s.display_name for s in group.sounds[:3]]
        premium_count = sum(1 for s in group.sounds if s.is_premium)
        free_count = len(group.sounds) - premium_count
        print(f"  {group.id}. {group.name}: {len(group.sounds)} sounds ({free_count} free, {premium_count} premium)")
        if group.sounds:
            print(f"     Example sounds: {', '.join(sound_names)}" + ("..." if len(group.sounds) > 3 else ""))
    print("="*50 + "\n")
    
    # Check if user is logged in
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    
    # Prepare sound data with access permissions
    sound_dicts = []
    for sound in sounds:
        sound_dict = sound.to_dict()
        sound_dict['user_can_access'] = (user is not None) or (not sound.is_premium)
        sound_dicts.append(sound_dict)
    
    return render_template('index.html', 
                         sounds=sound_dicts, 
                         groups=groups,
                         user=user)

@app.route('/login', methods=['GET', 'POST'])
def login():
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
    if 'user_id' in session:
        flash('You are already logged in', 'info')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered', 'error')
        elif User.query.filter_by(username=username).first():
            flash('Username already taken', 'error')
        else:
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

@app.route('/delete-account', methods=['POST'])
def delete_account():
    if 'user_id' not in session:
        flash('You must be logged in to delete your account', 'error')
        return redirect(url_for('login'))
    
    user = User.query.get(session['user_id'])
    if not user:
        flash('User not found', 'error')
        return redirect(url_for('logout'))
    
    password = request.form.get('password')
    if not password or not user.check_password(password):
        flash('Incorrect password', 'error')
        return redirect(url_for('user_profile'))
    
    try:
        db.session.delete(user)
        db.session.commit()
        session.pop('user_id', None)
        flash('Your account has been deleted successfully', 'success')
        return redirect(url_for('index'))
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting account: {str(e)}', 'error')
        return redirect(url_for('user_profile'))

@app.route('/api/sounds')
def get_sounds():
    user = None
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
    
    sounds = Sound.query.all()
    sound_list = []
    for sound in sounds:
        sound_dict = sound.to_dict()
        sound_dict['user_can_access'] = (user is not None) or (not sound.is_premium)
        sound_list.append(sound_dict)
    
    return jsonify(sound_list)

@app.route('/sounds/<path:filename>')
def serve_sound(filename):
    sound_path = os.path.join(app.root_path, 'static', 'sounds', filename)
    try:
        return send_file(sound_path, mimetype='audio/mpeg')
    except FileNotFoundError:
        return jsonify({'error': 'Sound file not found'}), 404

@app.route('/reset-db')
def reset_db_route():
    """Development only: Reset the database"""
    if not app.debug:
        return "Reset only allowed in debug mode", 403
    
    try:
        # Run the reset function directly
        from sqlalchemy import text
        
        with app.app_context():
            print("=" * 60)
            print("RESETTING DATABASE...")
            print("=" * 60)
            
            # Disable foreign key constraints
            print("Disabling foreign key constraints...")
            db.session.execute(text("EXEC sp_MSforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL'"))
            
            # Clear all data
            print("Deleting all data...")
            db.session.execute(text("DELETE FROM playlist_sound"))
            db.session.execute(text("DELETE FROM sound_group"))
            db.session.execute(text("DELETE FROM playlists"))
            db.session.execute(text("DELETE FROM sounds"))
            db.session.execute(text("DELETE FROM groups"))
            db.session.execute(text("DELETE FROM users"))
            
            # Reset identity columns
            print("Resetting identity columns...")
            tables = ['users', 'sounds', 'groups', 'playlists']
            for table in tables:
                try:
                    db.session.execute(text(f"DBCC CHECKIDENT ('{table}', RESEED, 0)"))
                except:
                    pass
            
            # Enable foreign key constraints
            print("Enabling foreign key constraints...")
            db.session.execute(text("EXEC sp_MSforeachtable 'ALTER TABLE ? CHECK CONSTRAINT ALL'"))
            
            db.session.commit()
            print("✓ Database cleared")
            
            # Now seed fresh data with ONLY 5 groups
            seed_fresh_data()
        
        return "Database reset successfully with 5 playlists! <a href='/'>Go to homepage</a>"
    except Exception as e:
        return f"Error: {str(e)}"
    
# app.py - Add these routes after existing routes

@app.route('/api/playlists', methods=['GET'])
def get_user_playlists():
    """Get all playlists for the current user"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(session['user_id'])
    playlists = Playlist.query.filter_by(user_id=user.id).all()
    
    playlist_list = []
    for playlist in playlists:
        playlist_list.append({
            'id': playlist.id,
            'name': playlist.name,
            'icon': playlist.playlist_icon,
            'sound_count': len(playlist.sounds)
        })
    
    return jsonify(playlists=playlist_list)

@app.route('/api/playlists/create', methods=['POST'])
def create_playlist():
    """Create a new playlist for the current user"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Playlist name required'}), 400
    
    user = User.query.get(session['user_id'])
    
    # Check if playlist with same name already exists for this user
    existing = Playlist.query.filter_by(
        user_id=user.id, 
        name=data['name']
    ).first()
    
    if existing:
        return jsonify({'error': 'You already have a playlist with this name'}), 400
    
    # Create new playlist
    new_playlist = Playlist(
        name=data['name'],
        user_id=user.id,
        playlist_icon=data.get('icon', 'static/icons/add.png')
    )
    
    db.session.add(new_playlist)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'playlist': {
            'id': new_playlist.id,
            'name': new_playlist.name,
            'icon': new_playlist.playlist_icon
        }
    })

@app.route('/api/playlists/<int:playlist_id>', methods=['GET'])
def get_playlist(playlist_id):
    """Get specific playlist with its sounds"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    playlist = Playlist.query.get_or_404(playlist_id)
    
    # Check if playlist belongs to current user
    if playlist.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    sounds_list = []
    for sound in playlist.sounds:
        sound_dict = sound.to_dict()
        sound_dict['user_can_access'] = True  # User is logged in
        sounds_list.append(sound_dict)
    
    return jsonify({
        'id': playlist.id,
        'name': playlist.name,
        'icon': playlist.playlist_icon,
        'sounds': sounds_list
    })

@app.route('/api/playlists/<int:playlist_id>/add-sound', methods=['POST'])
def add_sound_to_playlist(playlist_id):
    """Add a sound to a playlist"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    if not data or 'sound_id' not in data:
        return jsonify({'error': 'Sound ID required'}), 400
    
    playlist = Playlist.query.get_or_404(playlist_id)
    
    # Check if playlist belongs to current user
    if playlist.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    sound = Sound.query.get_or_404(data['sound_id'])
    
    # Check if sound is already in playlist
    if sound in playlist.sounds:
        return jsonify({'error': 'Sound already in playlist'}), 400
    
    # Add sound to playlist
    playlist.sounds.append(sound)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Added {sound.display_name} to {playlist.name}'
    })

@app.route('/api/playlists/<int:playlist_id>/remove-sound', methods=['POST'])
def remove_sound_from_playlist(playlist_id):
    """Remove a sound from a playlist"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    if not data or 'sound_id' not in data:
        return jsonify({'error': 'Sound ID required'}), 400
    
    playlist = Playlist.query.get_or_404(playlist_id)
    
    # Check if playlist belongs to current user
    if playlist.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    sound = Sound.query.get_or_404(data['sound_id'])
    
    # Remove sound from playlist
    if sound in playlist.sounds:
        playlist.sounds.remove(sound)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': f'Removed {sound.display_name} from {playlist.name}'
        })
    
    return jsonify({'error': 'Sound not in playlist'}), 404

@app.route('/api/playlists/<int:playlist_id>/delete', methods=['DELETE'])
def delete_playlist(playlist_id):
    """Delete a playlist"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    
    playlist = Playlist.query.get_or_404(playlist_id)
    
    # Check if playlist belongs to current user
    if playlist.user_id != session['user_id']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(playlist)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': f'Playlist "{playlist.name}" deleted'
    })

@app.route('/cleanup-unwanted-groups')
def cleanup_unwanted_groups():
    """Remove unwanted groups from existing database"""
    if not app.debug:
        return "Cleanup only allowed in debug mode", 403
    
    try:
        from sqlalchemy import text
        
        # Groups to remove
        unwanted_groups = ['Transport', 'Animals', 'Ambient', 'Objects']
        
        with app.app_context():
            # First, remove relationships
            for group_name in unwanted_groups:
                group = Group.query.filter_by(name=group_name).first()
                if group:
                    # Delete sound-group relationships
                    db.session.execute(
                        text("DELETE FROM sound_group WHERE group_id = :group_id"),
                        {"group_id": group.id}
                    )
                    # Delete the group
                    db.session.delete(group)
                    print(f"Removed group: {group_name}")
            
            db.session.commit()
            
        return "Unwanted groups removed successfully! <a href='/'>Go to homepage</a>"
    except Exception as e:
        return f"Error: {str(e)}"

# --- DATABASE SEEDING FUNCTIONS ---

def seed_fresh_data():
    """Seed fresh data with ONLY 5 groups"""
    try:
        print("\nSeeding fresh data with 5 playlists...")
        
        # --- 1. Create Groups (ONLY 5 GROUPS) ---
        print("Creating 5 groups: Nature, Sleep, Focus, Relax, City")
        groups_data = [
            ('Nature', 'static/icons/leaf.png'),
            ('Sleep', 'static/icons/night.png'),
            ('Focus', 'static/icons/productive.png'),
            ('Relax', 'static/icons/relax.png'),
            ('City', 'static/icons/train.png'),
        ]
        
        groups_dict = {}
        for name, icon in groups_data:
            group = Group(name=name, playlist_icon=icon)
            db.session.add(group)
            groups_dict[name.lower()] = group
        
        db.session.commit()
        print(f"✓ Created {len(groups_data)} groups")
        
        # --- 2. Create Sounds ---
        print("\nCreating sounds...")
        sounds_data = [
            # FREE SOUNDS (16)
            {'name': 'rain', 'display_name': 'Rain', 'icon': 'static/icons/rain.png', 
             'file_path': 'rain.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'forest', 'display_name': 'Forest', 'icon': 'static/icons/forest.png', 
             'file_path': 'Forest.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'fire', 'display_name': 'Fire', 'icon': 'static/icons/fire.png', 
             'file_path': 'fire.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'cafe', 'display_name': 'Cafe', 'icon': 'static/icons/cafe.png', 
             'file_path': 'cafe.mp3', 'category': 'city', 'is_premium': False},
            {'name': 'fan', 'display_name': 'Fan', 'icon': 'static/icons/fan.png', 
             'file_path': 'fan.mp3', 'category': 'focus', 'is_premium': False},
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
             'file_path': 'train.mp3', 'category': 'city', 'is_premium': False},
            {'name': 'underwater', 'display_name': 'Underwater', 'icon': 'static/icons/underwater.png', 
             'file_path': 'underwater.mp3', 'category': 'relax', 'is_premium': False},
            {'name': 'washingmachine', 'display_name': 'Washing Machine', 'icon': 'static/icons/washingmachine.png', 
             'file_path': 'washingmachine.mp3', 'category': 'sleep', 'is_premium': False},
            {'name': 'wind', 'display_name': 'Wind', 'icon': 'static/icons/wind.png', 
             'file_path': 'wind.mp3', 'category': 'nature', 'is_premium': False},
            {'name': 'windchime', 'display_name': 'Wind Chime', 'icon': 'static/icons/windchime.png', 
             'file_path': 'windchime.mp3', 'category': 'relax', 'is_premium': False},
            
            # PREMIUM SOUNDS (8)
            {'name': 'airplane', 'display_name': 'Airplane', 'icon': 'static/icons/airplane.png', 
             'file_path': 'airplane.mp3', 'category': 'city', 'is_premium': True},
            {'name': 'bird', 'display_name': 'Bird', 'icon': 'static/icons/bird.png', 
             'file_path': 'bird.mp3', 'category': 'nature', 'is_premium': True},
            {'name': 'cat', 'display_name': 'Cat', 'icon': 'static/icons/cat.png', 
             'file_path': 'cat.mp3', 'category': 'relax', 'is_premium': True},
            {'name': 'classroom', 'display_name': 'Classroom', 'icon': 'static/icons/classroom.png', 
             'file_path': 'classroom.mp3', 'category': 'focus', 'is_premium': True},
            {'name': 'library', 'display_name': 'Library', 'icon': 'static/icons/library.png', 
             'file_path': 'library.mp3', 'category': 'focus', 'is_premium': True},
            {'name': 'rain_on_umbrella', 'display_name': 'Rain on Umbrella', 'icon': 'static/icons/umbrella.png', 
             'file_path': 'umbrella.mp3', 'category': 'nature', 'is_premium': True},
            {'name': 'ship', 'display_name': 'Ship', 'icon': 'static/icons/ship.png', 
             'file_path': 'ship.mp3', 'category': 'relax', 'is_premium': True},
            {'name': 'white_noise', 'display_name': 'White Noise', 'icon': 'static/icons/white_noise.png', 
             'file_path': 'white_noise.mp3', 'category': 'sleep', 'is_premium': True},
        ]
        
        sounds_dict = {}
        for sound_data in sounds_data:
            sound = Sound(**sound_data)
            db.session.add(sound)
            sounds_dict[sound_data['name']] = sound
        
        db.session.commit()
        print(f"✓ Created {len(sounds_data)} sounds (16 free, 8 premium)")
        
        # --- 3. Create Relationships ---
        print("\nCreating sound-group relationships...")
        relationships = {
            # FREE SOUNDS
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
            'windchime': ['relax'],
            
            # PREMIUM SOUNDS
            'airplane': ['city'],
            'bird': ['nature', 'relax'],
            'cat': ['relax'],
            'classroom': ['focus'],
            'library': ['focus', 'relax'],
            'rain_on_umbrella': ['nature', 'relax'],
            'ship': ['relax'],
            'white_noise': ['sleep', 'focus']
        }
        
        relationship_count = 0
        for sound_name, group_names in relationships.items():
            if sound_name in sounds_dict:
                sound = sounds_dict[sound_name]
                for group_name in group_names:
                    if group_name in groups_dict:
                        sound.groups.append(groups_dict[group_name])
                        relationship_count += 1
        
        db.session.commit()
        print(f"✓ Created {relationship_count} sound-group relationships")
        
        # --- 4. Create a test user ---
        print("\nCreating test user...")
        test_user = User(
            username='testuser',
            email='test@example.com',
            is_premium=True
        )
        test_user.set_password('password123')
        db.session.add(test_user)
        db.session.commit()
        print("✓ Created test user: test@example.com / password123")
        
        print("\n" + "=" * 60)
        print("✅ DATABASE SEEDED SUCCESSFULLY!")
        print("Playlists: Nature, Sleep, Focus, Relax, City")
        print("No Transport, Animals, Ambient, or Objects playlists created.")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.session.rollback()
        return False

def cleanup_existing_unwanted_groups():
    """Clean up any unwanted groups in existing database"""
    unwanted_groups = ['Transport', 'Animals', 'Ambient', 'Objects']
    for group_name in unwanted_groups:
        group = Group.query.filter_by(name=group_name).first()
        if group:
            print(f"⚠ Warning: Found unwanted group '{group_name}' in database")
            print("You can remove it by visiting: http://localhost:5000/cleanup-unwanted-groups")

# --- INITIALIZATION ---

def initialize_database():
    """Initialize database on startup"""
    with app.app_context():
        # Create tables if they don't exist
        db.create_all()
        
        # Check if we need to seed data
        if Group.query.count() == 0:
            print("Database is empty. Seeding initial data with 5 playlists...")
            seed_fresh_data()
        else:
            # Remove any unwanted groups that might exist
            cleanup_existing_unwanted_groups()
            
            group_count = Group.query.count()
            sound_count = Sound.query.count()
            print(f"Database already has {group_count} groups and {sound_count} sounds")

if __name__ == '__main__':
    initialize_database()
    app.run(debug=True, port=5000)