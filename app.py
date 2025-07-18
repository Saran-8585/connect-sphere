import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG) 

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# create the app
app = Flask(__name__)
app.secret_key = "super secrect key"
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1) # needed for url_for to generate with https

# configure the database - SQLite file in project directory
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///messaging_app.db"
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# initialize the app with the extension, flask-sqlalchemy >= 3.0.x
db.init_app(app)

with app.app_context():
    # Make sure to import the models here or their tables won't be created
    import models  # noqa: F401
    db.create_all()
    logging.info("Database tables created")
    
    # Import and setup simple auth
    import simple_auth  # noqa: F401
