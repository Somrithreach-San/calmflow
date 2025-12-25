# models.py
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# --- DATA MODELS ---

playlist_sound_association = db.Table('playlist_sound',
    db.Column('playlist_id', db.Integer, db.ForeignKey('playlists.id'), primary_key=True),
    db.Column('sound_id', db.Integer, db.ForeignKey('sounds.id'), primary_key=True)
)

sound_group_association = db.Table('sound_group',
    db.Column('sound_id', db.Integer, db.ForeignKey('sounds.id'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True)
)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_premium = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

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
    name = db.Column(db.String(50), nullable=False, unique=True)
    playlist_icon = db.Column(db.String(255))
    sounds = db.relationship("Sound", secondary=sound_group_association, back_populates="groups")

class Playlist(db.Model):
    __tablename__ = 'playlists'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    playlist_icon = db.Column(db.String(255))
    sounds = db.relationship("Sound", secondary=playlist_sound_association, back_populates="playlists")
    
    # Add this relationship
    user = db.relationship("User", backref="playlists")