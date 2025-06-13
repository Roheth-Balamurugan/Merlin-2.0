import logging
from werkzeug.security import generate_password_hash
from models import User, db

def init_db():
    """Initialize database with default users if they don't exist"""
    try:
        # Check if admin user exists
        admin = User.query.filter_by(employee_id='admin').first()
        if not admin:
            admin_user = User(
                employee_id='admin',
                password_hash=generate_password_hash('admin123'),
                team='admin'
            )
            db.session.add(admin_user)
            logging.info("Created default admin user")
        
        # Check if ramp user exists
        ramp = User.query.filter_by(employee_id='ramp001').first()
        if not ramp:
            ramp_user = User(
                employee_id='ramp001',
                password_hash=generate_password_hash('ramp123'),
                team='ramp'
            )
            db.session.add(ramp_user)
            logging.info("Created default ramp user")
        
        # Check if towing user exists
        towing_user = User.query.filter_by(employee_id='towing001').first()
        if not towing_user:
            towing_user = User(
                employee_id='towing001',
                password_hash=generate_password_hash('towing123'),
                team='towing'
            )
            db.session.add(towing_user)
            logging.info("Created default towing user")
        
        db.session.commit()
        
    except Exception as e:
        logging.error(f"Database initialization error: {str(e)}")
        db.session.rollback()

def get_user_by_employee_id(employee_id):
    """Get user by employee ID"""
    try:
        return User.query.filter_by(employee_id=employee_id).first()
    except Exception as e:
        logging.error(f"Error getting user: {str(e)}")
        return None

def create_user(employee_id, password, team='ramp'):
    """Create a new user"""
    try:
        user = User(
            employee_id=employee_id,
            password_hash=generate_password_hash(password),
            team=team
        )
        db.session.add(user)
        db.session.commit()
        return user
    except Exception as e:
        logging.error(f"Error creating user: {str(e)}")
        db.session.rollback()
        return None
