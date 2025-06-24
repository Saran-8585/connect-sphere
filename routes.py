from flask import session, render_template, request, jsonify, redirect, url_for, flash
from flask_login import current_user, login_user, logout_user
from sqlalchemy import or_, and_, desc
from textblob import TextBlob
from datetime import datetime
import logging

from app import app, db
from simple_auth import require_login, create_demo_users
from models import User, Message, Conversation, Group, GroupMessage, group_members

# Make session permanent
@app.before_request
def make_session_permanent():
    session.permanent = True

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('chat'))
    return render_template('landing.html')

@app.route('/login')
def login():
    # Create demo users if they don't exist
    create_demo_users()
    
    # Get all users for selection
    users = User.query.all()
    return render_template('login.html', users=users)

@app.route('/login/<user_id>')
def login_as(user_id):
    user = User.query.get(user_id)
    if user:
        login_user(user)
        flash(f'Logged in as {user.display_name}', 'success')
        return redirect(url_for('chat'))
    else:
        flash('User not found', 'error')
        return redirect(url_for('login'))

@app.route('/logout')
def logout():
    logout_user()
    flash('Logged out successfully', 'info')
    return redirect(url_for('index'))

@app.route('/signup')
def signup():
    return render_template('signup.html')

@app.route('/register', methods=['POST'])
def register():
    try:
        # Get form data
        first_name = request.form.get('first_name', '').strip()
        last_name = request.form.get('last_name', '').strip()
        email = request.form.get('email', '').strip()
        
        # Validate required fields
        if not first_name or not email:
            flash('First name and email are required', 'error')
            return redirect(url_for('signup'))
        
        # Generate user ID from email
        user_id = email.split('@')[0].lower().replace('.', '_')
        
        # Check if user already exists
        existing_user = User.query.filter((User.id == user_id) | (User.email == email)).first()
        if existing_user:
            flash('A user with this email already exists', 'error')
            return redirect(url_for('signup'))
        
        # Generate profile image URL
        display_name = f"{first_name} {last_name}".strip()
        profile_image_url = f"https://ui-avatars.com/api/?name={display_name.replace(' ', '+')}&background=random&color=fff"
        
        # Create new user
        new_user = User(
            id=user_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            profile_image_url=profile_image_url,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Log the user in automatically
        login_user(new_user)
        flash(f'Welcome {display_name}! Your account has been created.', 'success')
        return redirect(url_for('chat'))
        
    except Exception as e:
        logging.error(f"Error creating user: {str(e)}")
        db.session.rollback()
        flash('An error occurred while creating your account. Please try again.', 'error')
        return redirect(url_for('signup'))

@app.route('/chat')
@require_login
def chat():
    # Get all users for the user list (excluding current user)
    users = User.query.filter(User.id != current_user.id).all()
    
    # Get conversations for current user
    conversations = db.session.query(Conversation).filter(
        or_(
            Conversation.user1_id == current_user.id,
            Conversation.user2_id == current_user.id
        )
    ).order_by(desc(Conversation.updated_at)).all()
    
    # Get groups for current user
    groups = current_user.groups
    
    return render_template('chat.html', users=users, conversations=conversations, groups=groups, current_user=current_user)

@app.route('/api/send_message', methods=['POST'])
@require_login
def send_message():
    try:
        data = request.get_json()
        content = data.get('content', '').strip()
        receiver_id = data.get('receiver_id')
        
        if not content or not receiver_id:
            return jsonify({'error': 'Content and receiver_id are required'}), 400
        
        # Check if receiver exists
        receiver = User.query.get(receiver_id)
        if not receiver:
            return jsonify({'error': 'Receiver not found'}), 404
        
        # Analyze sentiment using TextBlob
        blob = TextBlob(content)
        sentiment_score = blob.sentiment.polarity
        
        if sentiment_score > 0.1:
            sentiment = 'positive'
        elif sentiment_score < -0.1:
            sentiment = 'negative'
        else:
            sentiment = 'neutral'
        
        # Create new message
        message = Message(
            content=content,
            sender_id=current_user.id,
            receiver_id=receiver_id,
            sentiment=sentiment,
            sentiment_score=sentiment_score
        )
        
        db.session.add(message)
        db.session.flush()  # Get the message ID
        
        # Create or update conversation
        conversation = db.session.query(Conversation).filter(
            or_(
                and_(Conversation.user1_id == current_user.id, Conversation.user2_id == receiver_id),
                and_(Conversation.user1_id == receiver_id, Conversation.user2_id == current_user.id)
            )
        ).first()
        
        if not conversation:
            conversation = Conversation(
                user1_id=current_user.id,
                user2_id=receiver_id,
                last_message_id=message.id
            )
            db.session.add(conversation)
        else:
            conversation.last_message_id = message.id
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message.to_dict()
        })
        
    except Exception as e:
        logging.error(f"Error sending message: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to send message'}), 500

@app.route('/api/get_messages')
@require_login
def get_messages():
    try:
        other_user_id = request.args.get('user_id')
        last_message_id = request.args.get('last_message_id', 0, type=int)
        
        if not other_user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        # Get messages between current user and other user
        query = db.session.query(Message).filter(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == other_user_id),
                and_(Message.sender_id == other_user_id, Message.receiver_id == current_user.id)
            )
        )
        
        if last_message_id > 0:
            query = query.filter(Message.id > last_message_id)
        
        messages = query.order_by(Message.timestamp).all()
        
        # Mark messages as read if they were sent to current user
        unread_messages = [m for m in messages if m.receiver_id == current_user.id and not m.read]
        for message in unread_messages:
            message.read = True
        
        if unread_messages:
            db.session.commit()
        
        return jsonify({
            'messages': [message.to_dict() for message in messages]
        })
        
    except Exception as e:
        logging.error(f"Error getting messages: {str(e)}")
        return jsonify({'error': 'Failed to get messages'}), 500

@app.route('/api/get_conversations')
@require_login
def get_conversations():
    try:
        conversations = db.session.query(Conversation).filter(
            or_(
                Conversation.user1_id == current_user.id,
                Conversation.user2_id == current_user.id
            )
        ).order_by(desc(Conversation.updated_at)).all()
        
        return jsonify({
            'conversations': [conv.to_dict(current_user.id) for conv in conversations]
        })
        
    except Exception as e:
        logging.error(f"Error getting conversations: {str(e)}")
        return jsonify({'error': 'Failed to get conversations'}), 500

@app.route('/api/get_users')
@require_login
def get_users():
    try:
        users = User.query.filter(User.id != current_user.id).all()
        return jsonify({
            'users': [{
                'id': user.id,
                'name': user.display_name,
                'email': user.email,
                'profile_image_url': user.profile_image_url
            } for user in users]
        })
        
    except Exception as e:
        logging.error(f"Error getting users: {str(e)}")
        return jsonify({'error': 'Failed to get users'}), 500

@app.route('/api/get_chats')
@require_login
def get_chats():
    try:
        # Get direct conversations
        conversations = db.session.query(Conversation).filter(
            or_(
                Conversation.user1_id == current_user.id,
                Conversation.user2_id == current_user.id
            )
        ).order_by(desc(Conversation.updated_at)).all()
        
        # Get groups
        groups = current_user.groups
        
        # Combine and format
        chats = []
        
        # Add conversations
        for conv in conversations:
            chats.append(conv.to_dict(current_user.id))
        
        # Add groups
        for group in groups:
            chats.append(group.to_dict(current_user.id))
        
        # Sort by updated_at
        chats.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
        
        return jsonify({'chats': chats})
        
    except Exception as e:
        logging.error(f"Error getting chats: {str(e)}")
        return jsonify({'error': 'Failed to get chats'}), 500

@app.route('/api/create_group', methods=['POST'])
@require_login
def create_group():
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        member_ids = data.get('member_ids', [])
        
        if not name:
            return jsonify({'error': 'Group name is required'}), 400
        
        if len(member_ids) < 1:
            return jsonify({'error': 'At least one other member is required'}), 400
        
        # Create group
        group = Group(
            name=name,
            description=description,
            created_by=current_user.id
        )
        
        db.session.add(group)
        db.session.flush()  # Get the group ID
        
        # Add creator as member
        group.members.append(current_user)
        
        # Add other members
        for member_id in member_ids:
            user = User.query.get(member_id)
            if user and user != current_user:
                group.members.append(user)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'group': group.to_dict(current_user.id)
        })
        
    except Exception as e:
        logging.error(f"Error creating group: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to create group'}), 500

@app.route('/api/send_group_message', methods=['POST'])
@require_login
def send_group_message():
    try:
        data = request.get_json()
        content = data.get('content', '').strip()
        group_id = data.get('group_id')
        
        if not content or not group_id:
            return jsonify({'error': 'Content and group_id are required'}), 400
        
        # Check if group exists and user is a member
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        if current_user not in group.members:
            return jsonify({'error': 'You are not a member of this group'}), 403
        
        # Analyze sentiment
        blob = TextBlob(content)
        sentiment_score = blob.sentiment.polarity
        
        if sentiment_score > 0.1:
            sentiment = 'positive'
        elif sentiment_score < -0.1:
            sentiment = 'negative'
        else:
            sentiment = 'neutral'
        
        # Create group message
        message = GroupMessage(
            content=content,
            sender_id=current_user.id,
            group_id=group_id,
            sentiment=sentiment,
            sentiment_score=sentiment_score
        )
        
        db.session.add(message)
        
        # Update group timestamp
        group.updated_at = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': message.to_dict()
        })
        
    except Exception as e:
        logging.error(f"Error sending group message: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to send group message'}), 500

@app.route('/api/get_group_messages')
@require_login
def get_group_messages():
    try:
        group_id = request.args.get('group_id')
        last_message_id = request.args.get('last_message_id', 0, type=int)
        
        if not group_id:
            return jsonify({'error': 'group_id is required'}), 400
        
        # Check if group exists and user is a member
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        if current_user not in group.members:
            return jsonify({'error': 'You are not a member of this group'}), 403
        
        # Get messages
        query = GroupMessage.query.filter(GroupMessage.group_id == group_id)
        
        if last_message_id > 0:
            query = query.filter(GroupMessage.id > last_message_id)
        
        messages = query.order_by(GroupMessage.timestamp).all()
        
        return jsonify({
            'messages': [message.to_dict() for message in messages]
        })
        
    except Exception as e:
        logging.error(f"Error getting group messages: {str(e)}")
        return jsonify({'error': 'Failed to get group messages'}), 500

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('500.html'), 500
