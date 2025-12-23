from app import app, db, User, Sound, Group
import os

print("WARNING: This will DELETE ALL DATA from your database!")
print("Type 'YES' to continue, or anything else to cancel.")
confirmation = input("Are you sure? ")

if confirmation == 'YES':
    with app.app_context():
        # Drop all tables
        print("Dropping all tables...")
        db.drop_all()
        
        # Create all tables with new schema
        print("Creating tables with updated schema...")
        db.create_all()
        
        print("Database recreated successfully!")
        print("Now restart your Flask app to seed the data.")
else:
    print("Operation cancelled.")