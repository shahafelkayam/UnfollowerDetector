import os
import json
import mimetypes
import zipfile
import io
import base64
import shutil
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

# Configuration
PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONNECTIONS_DIR = os.path.join(BASE_DIR, 'connections')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
STATUS_FILE = os.path.join(BASE_DIR, 'status.json')

# Ensure directories exist
os.makedirs(CONNECTIONS_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

# Helper to load status.json
def load_status():
    if not os.path.exists(STATUS_FILE):
        default_status = {"whitelisted": [], "inactive": []}
        save_status(default_status)
        return default_status
    try:
        with open(STATUS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {"whitelisted": [], "inactive": []}

# Helper to save status.json
def save_status(status_data):
    try:
        with open(STATUS_FILE, 'w', encoding='utf-8') as f:
            json.dump(status_data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving status.json: {e}")

# Robust parser for Instagram JSON exports
def parse_instagram_file(file_path):
    users = []
    if not os.path.exists(file_path):
        return users

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error parsing file {file_path}: {e}")
        return users

    # Normalize structure to a list of entries
    entries = []
    if isinstance(data, dict):
        # Check standard key for following
        if 'relationships_following' in data:
            entries = data['relationships_following']
        # Check standard key for followers (sometimes wrapping dict)
        elif 'relationships_followers' in data:
            entries = data['relationships_followers']
        else:
            # Fallback: gather all lists inside the dictionary
            for val in data.values():
                if isinstance(val, list):
                    entries.extend(val)
    elif isinstance(data, list):
        entries = data

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        
        # Instagram exports typically put the username in the 'title' field
        # at the entry level, and the href in string_list_data
        title_username = entry.get('title', '').strip()
        
        string_list = entry.get('string_list_data', [])
        if isinstance(string_list, list) and len(string_list) > 0:
            for item in string_list:
                if isinstance(item, dict):
                    # 'value' may or may not exist; fall back to 'title' from parent entry
                    username = item.get('value') or title_username
                    href = item.get('href', '')
                    # Instagram hrefs look like https://www.instagram.com/_u/username
                    # Extract username from href if no username found
                    if not username and href:
                        parts = href.rstrip('/').split('/')
                        username = parts[-1] if parts else ''
                        if username == '_u' and len(parts) >= 2:
                            username = parts[-1]
                    if not username:
                        username = title_username
                    if not href and username:
                        href = f"https://www.instagram.com/{username}/"
                    # Normalize _u style hrefs to regular profile links
                    if '/_u/' in href:
                        href = f"https://www.instagram.com/{username}/"
                    if username:
                        users.append({"username": username, "href": href})
            # If string_list_data had items but none yielded a username, try title
            if not any(item.get('value') for item in string_list if isinstance(item, dict)):
                if title_username and not any(u['username'] == title_username for u in users[-len(string_list):] if users):
                    pass  # Already handled above via fallback
        elif title_username:
            # No string_list_data but has title
            href = f"https://www.instagram.com/{title_username}/"
            users.append({"username": title_username, "href": href})
        else:
            # Simple fallback structure
            username = entry.get('value') or entry.get('username')
            href = entry.get('href') or (f"https://www.instagram.com/{username}/" if username else "")
            if username:
                users.append({"username": username, "href": href})

    return users

# Parse followers and following to calculate relationships
def get_relationship_data():
    following_list = []
    followers_set = set()
    followers_map = {} # Maps username to href for followers
    
    # Process following
    following_file = os.path.join(CONNECTIONS_DIR, 'following.json')
    if os.path.exists(following_file):
        following_list = parse_instagram_file(following_file)

    # Process all followers files (followers_1.json, followers_2.json, etc.)
    has_followers = False
    for filename in os.listdir(CONNECTIONS_DIR):
        if filename.startswith('followers') and filename.endswith('.json'):
            has_followers = True
            followers_file = os.path.join(CONNECTIONS_DIR, filename)
            for user in parse_instagram_file(followers_file):
                username = user['username']
                followers_set.add(username)
                followers_map[username] = user['href']

    has_files = os.path.exists(following_file) or has_followers

    # Load whitelisted, inactive & unfollowed status
    status = load_status()
    whitelisted_set = set(status.get("whitelisted", []))
    inactive_set = set(status.get("inactive", []))
    unfollowed_set = set(status.get("unfollowed", []))

    # Compute categories
    unfollowers = []
    whitelisted = []
    inactive = []
    unfollowed = []

    # Map of all following to keep track of their URLs
    following_map = {u['username']: u['href'] for u in following_list}

    # Find who doesn't follow back
    for username, href in following_map.items():
        if username not in followers_set:
            user_info = {"username": username, "href": href}
            if username in whitelisted_set:
                whitelisted.append(user_info)
            elif username in inactive_set:
                inactive.append(user_info)
            elif username in unfollowed_set:
                unfollowed.append(user_info)
            else:
                unfollowers.append(user_info)

    # Also include unfollowed users who are no longer in following (they were truly unfollowed)
    for username in unfollowed_set:
        if username not in following_map:
            href = f"https://www.instagram.com/{username}/"
            unfollowed.append({"username": username, "href": href})

    # Clean up status.json if usernames no longer exist in following list
    if len(following_map) > 0:
        cleaned_whitelisted = [u for u in status.get("whitelisted", []) if u in following_map and u not in followers_set]
        cleaned_inactive = [u for u in status.get("inactive", []) if u in following_map and u not in followers_set]
        if len(cleaned_whitelisted) != len(status.get("whitelisted", [])) or len(cleaned_inactive) != len(status.get("inactive", [])):
            status["whitelisted"] = cleaned_whitelisted
            status["inactive"] = cleaned_inactive
            save_status(status)

    return {
        "has_files": has_files,
        "counts": {
            "following": len(following_list),
            "followers": len(followers_set),
            "unfollowers": len(unfollowers),
            "whitelisted": len(whitelisted),
            "inactive": len(inactive),
            "unfollowed": len(unfollowed)
        },
        "unfollowers": sorted(unfollowers, key=lambda x: x['username'].lower()),
        "whitelisted": sorted(whitelisted, key=lambda x: x['username'].lower()),
        "inactive": sorted(inactive, key=lambda x: x['username'].lower()),
        "unfollowed": sorted(unfollowed, key=lambda x: x['username'].lower())
    }

class RequestHandler(BaseHTTPRequestHandler):
    def send_json(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def serve_static(self, filepath, content_type):
        try:
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.end_headers()
            self.wfile.write(content)
        except Exception:
            self.send_error(404, "File Not Found")

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # API: Status endpoint
        if path == '/api/status':
            data = get_relationship_data()
            self.send_json(data)
            return

        # API: Has-data endpoint
        if path == '/api/has-data':
            has_data = any(
                f.endswith('.json') for f in os.listdir(CONNECTIONS_DIR)
                if os.path.isfile(os.path.join(CONNECTIONS_DIR, f))
            )
            self.send_json({"has_data": has_data})
            return

        # Static routing
        if path == '/' or path == '/index.html':
            self.serve_static(os.path.join(STATIC_DIR, 'index.html'), 'text/html')
            return
        elif path == '/style.css':
            self.serve_static(os.path.join(STATIC_DIR, 'style.css'), 'text/css')
            return
        elif path == '/app.js':
            self.serve_static(os.path.join(STATIC_DIR, 'app.js'), 'application/javascript')
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # Read POST content length
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else ""

        # API: Action endpoint (whitelist, inactive, unfollowed, remove)
        if path == '/api/action':
            try:
                payload = json.loads(post_data)
                username = payload.get('username')
                action = payload.get('action') # "whitelist", "inactive", "unfollowed", "remove"
                
                if not username or action not in ['whitelist', 'inactive', 'unfollowed', 'remove']:
                    self.send_json({"error": "Invalid request parameters"}, 400)
                    return

                status = load_status()
                
                # Remove from all sets first
                status["whitelisted"] = [u for u in status.get("whitelisted", []) if u != username]
                status["inactive"] = [u for u in status.get("inactive", []) if u != username]
                status["unfollowed"] = [u for u in status.get("unfollowed", []) if u != username]

                if action == 'whitelist':
                    status["whitelisted"].append(username)
                elif action == 'inactive':
                    status["inactive"].append(username)
                elif action == 'unfollowed':
                    status["unfollowed"].append(username)

                save_status(status)
                self.send_json({"success": True, "message": f"User {username} marked as {action}"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        # API: Upload endpoint
        if path == '/api/upload':
            try:
                payload = json.loads(post_data)
                filename = payload.get('filename')
                content = payload.get('content') # File content as string/dict
                
                if not filename or content is None:
                    self.send_json({"error": "Missing filename or content"}, 400)
                    return

                # Validate file names to prevent directory traversal
                if not filename.endswith('.json') or '/' in filename or '\\' in filename:
                    self.send_json({"error": "Invalid filename format"}, 400)
                    return

                # Check if payload content is a string or already structured dict/list
                if isinstance(content, str):
                    try:
                        # Validate that it is valid JSON
                        parsed_content = json.loads(content)
                    except json.JSONDecodeError:
                        self.send_json({"error": "Invalid JSON content"}, 400)
                        return
                else:
                    parsed_content = content

                # Save file
                file_path = os.path.join(CONNECTIONS_DIR, filename)
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(parsed_content, f, indent=2, ensure_ascii=False)

                self.send_json({"success": True, "message": f"{filename} uploaded successfully"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        # API: Upload ZIP endpoint
        if path == '/api/upload-zip':
            try:
                payload = json.loads(post_data)
                filename = payload.get('filename', '')
                content_b64 = payload.get('content', '')

                if not content_b64:
                    self.send_json({"error": "Missing content"}, 400)
                    return

                # Decode base64 content into bytes
                zip_bytes = base64.b64decode(content_b64)
                zip_buffer = io.BytesIO(zip_bytes)

                extracted_files = []

                with zipfile.ZipFile(zip_buffer, 'r') as zf:
                    for zip_entry in zf.namelist():
                        # Get just the basename of the entry
                        basename = os.path.basename(zip_entry)
                        if not basename:
                            continue  # Skip directories

                        # Check if it's a file we care about (case-insensitive)
                        basename_lower = basename.lower()
                        is_following = (basename_lower == 'following.json')
                        is_followers = (basename_lower.startswith('followers') and basename_lower.endswith('.json'))

                        if is_following or is_followers:
                            # Read the file from the zip and write to CONNECTIONS_DIR
                            data = zf.read(zip_entry)
                            dest_path = os.path.join(CONNECTIONS_DIR, basename_lower)
                            with open(dest_path, 'wb') as out_f:
                                out_f.write(data)
                            extracted_files.append(basename_lower)

                self.send_json({
                    "success": True,
                    "message": f"Extracted {len(extracted_files)} files from ZIP",
                    "files": extracted_files
                })
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        # API: Upload directory endpoint
        if path == '/api/upload-directory':
            try:
                payload = json.loads(post_data)
                files = payload.get('files', [])

                saved_files = []

                for file_entry in files:
                    file_path = file_entry.get('path', '')
                    file_content = file_entry.get('content')

                    # Get the basename
                    basename = os.path.basename(file_path)
                    basename_lower = basename.lower()

                    # Check if it's a file we care about (case-insensitive)
                    is_following = (basename_lower == 'following.json')
                    is_followers = (basename_lower.startswith('followers') and basename_lower.endswith('.json'))

                    if (is_following or is_followers) and file_content is not None:
                        # Always save with lowercase name so parser can find it
                        dest_path = os.path.join(CONNECTIONS_DIR, basename_lower)
                        with open(dest_path, 'w', encoding='utf-8') as f:
                            json.dump(file_content, f, indent=2, ensure_ascii=False)
                        saved_files.append(basename_lower)

                self.send_json({
                    "success": True,
                    "message": f"Processed {len(saved_files)} files",
                    "files": saved_files
                })
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        # API: Clear endpoint
        if path == '/api/clear':
            try:
                for filename in os.listdir(CONNECTIONS_DIR):
                    file_path = os.path.join(CONNECTIONS_DIR, filename)
                    if os.path.isfile(file_path) and filename.endswith('.json'):
                        os.remove(file_path)
                
                # Optionally keep or reset status.json
                # We will keep status.json to let status carry over if they reload the same usernames later
                self.send_json({"success": True, "message": "Connections folder cleared"})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        self.send_error(404, "Not Found")

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, RequestHandler)
    print(f"UnfollowerDetector server running at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
