from functools import wraps
from flask import session, request, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, current_user
from app import app, db
from models import User
from datetime import datetime

login_manager = LoginManager(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

def require_login(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated: 
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def create_demo_users():
    """Create demo users if they don't exist"""
    demo_users = [
        {
            'id': 'user1',
            'email': 'alice@example.com',
            'first_name': 'Alice',
            'last_name': 'Johnson',
            'profile_image_url': 'https://ui-avatars.com/api/?name=Alice+Johnson&background=0d6efd&color=fff'
        },
        {
            'id': 'user2', 
            'email': 'bob@example.com',
            'first_name': 'Bob',
            'last_name': 'Smith',
            'profile_image_url': 'https://ui-avatars.com/api/?name=Bob+Smith&background=198754&color=fff'
        },
        {
            'id': 'user3',
            'email': 'carol@example.com', 
            'first_name': 'Carol',
            'last_name': 'Davis',
            'profile_image_url': 'https://ui-avatars.com/api/?name=Carol+Davis&background=dc3545&color=fff'
        }
    ]
    
    for user_data in demo_users:
        existing_user = User.query.get(user_data['id'])
        if not existing_user:
            user = User(
                id=user_data['id'],
                email=user_data['email'],
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                profile_image_url=user_data['profile_image_url'],
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(user)
    
    db.session.commit()