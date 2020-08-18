# Python standard libraries
import json
import os
import sqlite3
from datetime import datetime
import time

# Third-party libraries
from flask import (
    Flask,
    redirect,
    request,
    url_for,
    render_template,
    jsonify
)
from flask_login import (
    LoginManager,
    current_user,
    login_required,
    login_user,
    logout_user,
)
from oauthlib.oauth2 import WebApplicationClient
import requests
from tinydb import TinyDB, Query

# Internal imports
from db import init_db_command
from user import User


scratch_db = TinyDB("scratch_database.json", indent=2)
# user_db = TinyDB("scratch_user.json")
logins_db = TinyDB("scratch_logins_database.json", indent=2)

# Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", None)
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", None)
GOOGLE_DISCOVERY_URL = (
    "https://accounts.google.com/.well-known/openid-configuration"
)

# Flask app setup
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(24)

# User session management setup
# https://flask-login.readthedocs.io/en/latest
login_manager = LoginManager()
login_manager.init_app(app)

# Naive database setup
try:
    init_db_command()
except sqlite3.OperationalError:
    # Assume it's already been created
    pass

# OAuth 2 client setup
client = WebApplicationClient(GOOGLE_CLIENT_ID)

# Flask-Login helper to retrieve a user from our db


@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)


@app.route("/")
def index():
    if current_user.is_authenticated:
        return render_template('index.html',
                               name=current_user.name,
                               email=current_user.email,
                               profile_pic=current_user.profile_pic)
    else:
        return render_template('index.html')
    # if current_user.is_authenticated:
    #     return (
    #         "<p>Hello, {}! You're logged in! Email: {}</p>"
    #         "<div><p>Google Profile Picture:</p>"
    #         '<img src="{}" alt="Google profile pic"></img></div>'
    #         '<a class="button" href="/logout">Logout</a>'.format(
    #             current_user.name, current_user.email, current_user.profile_pic
    #         )
    #     )
    # else:
    #     return '<a class="button" href="/login">Google Login</a>'


def get_google_provider_cfg():
    return requests.get(GOOGLE_DISCOVERY_URL).json()


@app.route("/login")
def login():
    # Find out what URL to hit for Google login
    google_provider_cfg = get_google_provider_cfg()
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]

    # Use library to construct the request for Google login and provide
    # scopes that let you retrieve user's profile from Google
    request_uri = client.prepare_request_uri(
        authorization_endpoint,
        redirect_uri=request.base_url + "/callback",
        scope=["openid", "email", "profile"],
    )
    return redirect(request_uri)


@app.route("/login/callback")
def callback():
    # Get authorization code Google sent back to you
    code = request.args.get("code")
    # Find out what URL to hit to get tokens that allow you to ask for
    # things on behalf of a user
    google_provider_cfg = get_google_provider_cfg()
    token_endpoint = google_provider_cfg["token_endpoint"]
    token_url, headers, body = client.prepare_token_request(
        token_endpoint,
        authorization_response=request.url,
        redirect_url=request.base_url,
        code=code
    )
    token_response = requests.post(
        token_url,
        headers=headers,
        data=body,
        auth=(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
    )

    # Parse the tokens!
    client.parse_request_body_response(json.dumps(token_response.json()))
    # Now that you have tokens (yay) let's find and hit the URL
    # from Google that gives you the user's profile information,
    # including their Google profile image and email
    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    uri, headers, body = client.add_token(userinfo_endpoint)
    userinfo_response = requests.get(uri, headers=headers, data=body)

    # You want to make sure their email is verified.
    # The user authenticated with Google, authorized your
    # app, and now you've verified their email through Google!
    if userinfo_response.json().get("email_verified"):
        unique_id = userinfo_response.json()["sub"]
        users_email = userinfo_response.json()["email"]
        picture = userinfo_response.json()["picture"]
        users_name = userinfo_response.json()["given_name"]
    else:
        return "User email not available or not verified by Google.", 400

    # Create a user in your db with the information provided
    # by Google
    user = User(
        id_=unique_id, name=users_name, email=users_email, profile_pic=picture
    )

    # Doesn't exist? Add it to the database.
    if not User.get(unique_id):
        User.create(unique_id, users_name, users_email, picture)

    # Begin user session by logging the user in
    login_user(user)

    # Send user back to homepage
    return redirect(url_for("index"))


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("index"))


@app.route("/v1/api/scratch/blogs", methods=["GET"])
@login_required
def list_blogs():
    User = Query()
    blogs = scratch_db.search(User.uid == current_user.id)
    return jsonify(blogs)


@app.route("/v1/api/scratch/blogs/<cid>", methods=["GET"])
@login_required
def get_blogs(cid):
    Blog = Query()
    blogs = scratch_db.get(Blog.cid == cid)
    return jsonify(blogs)


@app.route("/v1/api/scratch/blogs/<cid>", methods=["DELETE"])
@login_required
def delete_blogs(cid):
    Blog = Query()
    print(scratch_db.remove(Blog.cid == cid))
    return jsonify(True)


@app.route("/temp", methods=["GET"])
def temp():
    blogs = scratch_db.all()
    return jsonify(blogs)


# todo: is there a better mechanism to route api / api versions
# todo: what were the learnings from the rest dylan conf
@app.route("/v1/api/scratch/blogs", methods=["POST"])
@login_required
def save():
    print(f'SAVE {current_user=}')
    data = request.json
    # logger.debug(json.dumps(data, indent=2))
    # uid = data.get("uid")

    if not(cid := data.get('cid')):
        data['uid'] = current_user.id
        data['cid'] = str(time.time()).replace('.', '')
        data['created'] = str(datetime.now())
        data['last_updated'] = str(datetime.now())
        scratch_db.insert(data)
    else:
        doc_query = Query()
        data['last_updated'] = str(datetime.now())
        scratch_db.upsert(data, doc_query.cid == cid)

    return jsonify(data), 200
# @app.route('/')
# def index():
#     return render_template("index.html")


if __name__ == "__main__":
    app.run(ssl_context="adhoc", debug=True)
