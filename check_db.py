from app import app, db
from sqlalchemy import inspect

with app.app_context():
    inspector = inspect(db.engine)
    
    print("Tables in database:")
    for table_name in inspector.get_table_names():
        print(f"\n{table_name} table:")
        columns = inspector.get_columns(table_name)
        for col in columns:
            print(f"  - {col['name']} ({col['type']})")
    
    print("\n" + "="*50)
    print("Checking if users table exists and has correct columns...")
    
    if 'users' in inspector.get_table_names():
        print("users table exists")
        columns = [col['name'] for col in inspector.get_columns('users')]
        print(f"Columns: {columns}")
        
        required_columns = ['id', 'username', 'email', 'password_hash', 'created_at']
        missing = [col for col in required_columns if col not in columns]
        
        if missing:
            print(f"Missing columns: {missing}")
        else:
            print("All required columns are present!")
    else:
        print("users table does NOT exist!")