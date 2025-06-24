from datetime import datetime
from app import db
from flask_login import UserMixin
from sqlalchemy import UniqueConstraint

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String, primary_key=True)
    email = db.Column(db.String, unique=True, nullable=True)
    first_name = db.Column(db.String, nullable=True)
    last_name = db.Column(db.String, nullable=True)
    profile_image_url = db.Column(db.String, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    sent_messages = db.relationship('Message', foreign_keys='Message.sender_id', backref='sender', lazy='dynamic')
    received_messages = db.relationship('Message', foreign_keys='Message.receiver_id', backref='receiver', lazy='dynamic')

    @property
    def display_name(self):
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.email:
            return self.email.split('@')[0]
        else:
            return f"User {self.id}"

# Simple session tracking (no OAuth needed)
class UserSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey(User.id), nullable=False)
    session_token = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    user = db.relationship(User)

class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    sender_id = db.Column(db.String, db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.String, db.ForeignKey('users.id'), nullable=False)
    sentiment = db.Column(db.String(20), nullable=True)  # positive, negative, neutral
    sentiment_score = db.Column(db.Float, nullable=True)  # -1 to 1
    timestamp = db.Column(db.DateTime, default=datetime.now, nullable=False)
    read = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'content': self.content,
            'sender_id': self.sender_id,
            'receiver_id': self.receiver_id,
            'sender_name': self.sender.display_name,
            'receiver_name': self.receiver.display_name,
            'sentiment': self.sentiment,
            'sentiment_score': self.sentiment_score,
            'timestamp': self.timestamp.isoformat(),
            'read': self.read
        }

class Group(db.Model):
    __tablename__ = 'groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.String, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    creator = db.relationship('User', backref='created_groups')
    members = db.relationship('User', secondary='group_members', backref='groups')
    messages = db.relationship('GroupMessage', backref='group', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, current_user_id):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'is_group': True,
            'member_count': len(self.members),
            'members': [{
                'id': member.id,
                'name': member.display_name,
                'profile_image_url': member.profile_image_url
            } for member in self.members],
            'created_by': self.creator.display_name,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

# Association table for group members
group_members = db.Table('group_members',
    db.Column('group_id', db.Integer, db.ForeignKey('groups.id'), primary_key=True),
    db.Column('user_id', db.String, db.ForeignKey('users.id'), primary_key=True)
)

class GroupMessage(db.Model):
    __tablename__ = 'group_messages'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    sender_id = db.Column(db.String, db.ForeignKey('users.id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    sentiment = db.Column(db.String(20), nullable=True)
    sentiment_score = db.Column(db.Float, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.now, nullable=False)
    
    sender = db.relationship('User', backref='group_messages')
    
    def to_dict(self):
        return {
            'id': self.id,
            'content': self.content,
            'sender_id': self.sender_id,
            'group_id': self.group_id,
            'sender_name': self.sender.display_name,
            'sender_profile_image': self.sender.profile_image_url,
            'sentiment': self.sentiment,
            'sentiment_score': self.sentiment_score,
            'timestamp': self.timestamp.isoformat(),
            'is_group_message': True
        }

class Conversation(db.Model):
    __tablename__ = 'conversations'
    id = db.Column(db.Integer, primary_key=True)
    user1_id = db.Column(db.String, db.ForeignKey('users.id'), nullable=False)
    user2_id = db.Column(db.String, db.ForeignKey('users.id'), nullable=False)
    last_message_id = db.Column(db.Integer, db.ForeignKey('messages.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    user1 = db.relationship('User', foreign_keys=[user1_id])
    user2 = db.relationship('User', foreign_keys=[user2_id])
    last_message = db.relationship('Message')

    __table_args__ = (UniqueConstraint('user1_id', 'user2_id', name='unique_conversation'),)

    def get_other_user(self, current_user_id):
        return self.user2 if self.user1_id == current_user_id else self.user1

    def to_dict(self, current_user_id):
        other_user = self.get_other_user(current_user_id)
        return {
            'id': self.id,
            'name': other_user.display_name,
            'profile_image_url': other_user.profile_image_url,
            'is_group': False,
            'other_user': {
                'id': other_user.id,
                'name': other_user.display_name,
                'profile_image_url': other_user.profile_image_url
            },
            'last_message': self.last_message.to_dict() if self.last_message else None,
            'updated_at': self.updated_at.isoformat()
        }
