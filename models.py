from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Column, Integer, String

# This will be initialized in app.py
db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    employee_id = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    team = Column(String(50), nullable=False, default='ramp')
    
    def __repr__(self):
        return f'<User {self.employee_id}>'
