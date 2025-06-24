# Messaging App

## Overview

This is a Flask-based real-time messaging application with AI-powered sentiment analysis. The app provides secure user authentication through Replit Auth, enables users to send and receive messages, and includes TextBlob integration for sentiment analysis of messages.

## System Architecture

### Backend Architecture
- **Framework**: Flask web application with SQLAlchemy ORM
- **Database**: PostgreSQL with Flask-SQLAlchemy for ORM operations
- **Authentication**: Replit OAuth integration using Flask-Dance
- **Session Management**: Flask-Login for user session handling
- **WSGI Server**: Gunicorn for production deployment

### Frontend Architecture
- **Template Engine**: Jinja2 templates with Bootstrap 5 dark theme
- **UI Framework**: Bootstrap with Replit-specific dark theme styling
- **Icons**: Feather Icons for consistent iconography
- **JavaScript**: Vanilla JavaScript for chat functionality and AJAX requests

### Database Schema
- **Users Table**: Stores user profile information (required for Replit Auth)
- **OAuth Table**: Manages OAuth tokens and sessions (required for Replit Auth)
- **Messages Table**: Stores message content with sender/receiver relationships
- **Conversations Table**: Tracks conversation metadata and updates (referenced but incomplete)

## Key Components

### Authentication System
- Implements Replit OAuth flow using Flask-Dance
- Custom UserSessionStorage for token management
- Flask-Login integration for session persistence
- Mandatory User and OAuth models for Replit Auth compatibility

### Messaging System
- RESTful API endpoints for sending/receiving messages
- Real-time message loading and display
- User-to-user direct messaging
- Message sentiment analysis using TextBlob

### User Interface
- Responsive chat interface with user list sidebar
- Message bubbles with sent/received styling
- Profile image support with fallback avatars
- Landing page for unauthenticated users

## Data Flow

1. **Authentication Flow**: User authenticates via Replit OAuth → Token stored in OAuth table → User session managed by Flask-Login
2. **Message Flow**: User sends message → API validates and stores in database → Recipient can fetch new messages via polling
3. **Sentiment Analysis**: Messages processed through TextBlob for sentiment scoring and emotion detection

## External Dependencies

### Python Packages
- **Flask Ecosystem**: flask, flask-sqlalchemy, flask-login, flask-dance
- **Database**: psycopg2-binary for PostgreSQL connection
- **Authentication**: oauthlib, pyjwt for OAuth handling
- **AI/ML**: textblob for sentiment analysis
- **Deployment**: gunicorn for WSGI serving
- **Validation**: email-validator for email format validation

### External Services
- **Replit Auth**: OAuth provider for user authentication
- **PostgreSQL**: Primary database for data persistence

## Deployment Strategy

### Development
- Local development server via `flask run`
- Hot-reload enabled for development workflow
- Debug mode with detailed error reporting

### Production
- Gunicorn WSGI server with autoscale deployment target
- Environment-based configuration for database and session secrets
- ProxyFix middleware for proper HTTPS handling behind reverse proxy
- Connection pooling with pre-ping for database reliability

### Environment Configuration
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Flask session encryption key
- Database connection pooling with 300-second recycle timeout

## Changelog
- June 24, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.