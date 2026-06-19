# UnfollowerDetector

UnfollowerDetector is a local Python web application that helps users analyze their Instagram data export and detect accounts they follow that do not follow them back.

The project reads Instagram’s exported `followers` and `following` JSON files, compares them, and displays a clean list of users who are not following back. Each result includes a clickable Instagram profile link, allowing the user to review the account manually. Users can also mark accounts as **whitelisted** or **inactive** to keep track of accounts they intentionally do not want to unfollow.

This project is designed to run locally and does **not** require Instagram login credentials, scraping, browser automation, or access to the Instagram API.

---

## Features

* Detect users you follow who do not follow you back
* Parse Instagram JSON export files
* Support local `connections` directory scanning
* Support uploading JSON files through the frontend
* Support pasting JSON content manually
* Display clickable Instagram profile links
* Mark users as:

  * **Normal**
  * **Whitelisted**
  * **Inactive**
* Persist user statuses locally
* Export results to CSV
* Run frontend and backend from a Python launcher
* Local-first design for better privacy
* No Instagram password required
* No automated unfollowing or account actions

---

## Why This Project Exists

Instagram allows users to export their account information, including followers and following data. However, this data is not easy to compare manually.

UnfollowerDetector makes the exported data easier to use by showing which accounts are not mutual follows.

The app is useful for people who want to:

* Clean up their following list
* Find accounts that do not follow them back
* Keep track of inactive accounts
* Avoid repeatedly checking the same profiles
* Whitelist accounts they still want to follow

---

## Privacy

UnfollowerDetector is built as a local application.

Your Instagram export files are processed on your own machine. The app does not send your data to an external server.

The project does not ask for:

* Instagram username
* Instagram password
* Two-factor authentication codes
* Session cookies
* API tokens

The only data used by the app is the JSON data you provide from your Instagram export.

---

## Important Disclaimer

This project is not affiliated with, endorsed by, or connected to Instagram or Meta.

UnfollowerDetector does not automate unfollowing, scraping, login, or interaction with Instagram. It only analyzes data files provided by the user and creates clickable links to Instagram profiles so users can review accounts manually.

Users are responsible for following Instagram’s terms and policies.

---

## Tech Stack

### Backend

* Python
* FastAPI
* Uvicorn

### Frontend

* HTML
* CSS
* JavaScript

### Storage

* Local JSON files

---

## Project Structure

```txt
UnfollowerDetector/
├── run.py
├── requirements.txt
├── README.md
├── backend/
│   ├── app.py
│   ├── parser.py
│   └── storage.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── data/
│   └── statuses.json
└── connections/
    └── followers_and_following/
        ├── followers_1.json
        └── following.json
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/UnfollowerDetector.git
cd UnfollowerDetector
```

### 2. Create a virtual environment

#### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

#### Windows

```bash
python -m venv .venv
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

---

## Running the Project

Run the app with:

```bash
python run.py
```

Then open your browser at:

```txt
http://127.0.0.1:8000
```

---

## How to Get Your Instagram Data Export

1. Open Instagram.
2. Go to your account settings.
3. Find the option to download or export your information.
4. Request your followers and following data.
5. Choose JSON format if available.
6. Download and extract the exported files.
7. Look for the `connections` directory.

The relevant files are usually located in a path similar to:

```txt
connections/followers_and_following/
```

Common files may include:

```txt
followers_1.json
following.json
following_1.json
```

Instagram may change the exact file names or folder structure over time, so the parser is designed to support common export formats.

---

## Usage

There are three main ways to use the app.

### Option 1: Local Connections Directory

Place your Instagram export files inside:

```txt
connections/followers_and_following/
```

Then open the app and run the local scan.

The backend will read the files, compare followers and following, and return the accounts that do not follow back.

---

### Option 2: Upload JSON Files

Use the frontend upload section to upload your followers and following JSON files.

This is useful if you do not want to manually place files inside the project directory.

---

### Option 3: Paste JSON Content

You can paste the raw JSON content of your followers and following files directly into the frontend.

This is useful for quick testing or small exports.

---

## Statuses

Each detected user can be marked with a status.

### Normal

The default state. This means the user does not follow you back and has not been categorized yet.

### Whitelisted

Use this when you know the account does not follow you back, but you still want to keep following it.

Examples:

* Celebrities
* Brands
* News pages
* Friends with private accounts
* Accounts you intentionally follow

### Inactive

Use this when the account seems inactive or abandoned.

This allows you to separate inactive users from regular non-followers.

---

## CSV Export

The app allows exporting the results to CSV.

The exported file can be used for:

* Personal tracking
* Manual review
* Backup
* Spreadsheet filtering

Example CSV columns:

```txt
username,status,profileUrl
```

---

## API Overview

The backend exposes API routes used by the frontend.

### Get Local Unfollowers

```http
GET /api/unfollowers
```

Scans the local `connections/followers_and_following` directory and returns users who do not follow back.

### Analyze Uploaded Data

```http
POST /api/analyze-upload
```

Accepts uploaded JSON files and returns detected non-followers.

### Analyze Pasted Data

```http
POST /api/analyze-json
```

Accepts pasted JSON content and returns detected non-followers.

### Update User Status

```http
POST /api/status
```

Updates a user’s status.

Example statuses:

```txt
normal
whitelisted
inactive
```

### Export Results

```http
GET /api/export
```

Exports the current results as a CSV file.

---

## Example Result

```json
[
  {
    "username": "example_user",
    "profileUrl": "https://instagram.com/example_user",
    "status": "normal"
  },
  {
    "username": "another_user",
    "profileUrl": "https://instagram.com/another_user",
    "status": "whitelisted"
  }
]
```

---

## How Detection Works

The detection logic is simple:

```txt
not_following_back = following - followers
```

The app compares:

* Accounts you follow
* Accounts that follow you

Any username that appears in your following list but does not appear in your followers list is shown as a user who does not follow back.

---

## Limitations

UnfollowerDetector depends on the accuracy of Instagram’s exported data.

The app cannot detect:

* Users who followed or unfollowed after the export was created
* Accounts that changed usernames after the export
* Private account state changes
* Blocked or deleted accounts with incomplete export data

To get updated results, request a fresh Instagram data export.

---

## Security Notes

This project intentionally avoids:

* Instagram login automation
* Password collection
* Web scraping
* Browser session access
* Automated unfollowing
* Bot-like behavior

The app only processes user-provided JSON files.

---

## Development

Run the backend manually with:

```bash
uvicorn backend.app:app --reload
```

Then open:

```txt
http://127.0.0.1:8000
```

---

## Testing

If tests are included, run:

```bash
pytest
```

A basic parser test should verify that the app correctly detects users who appear in the following list but not in the followers list.

---

## Future Improvements

Possible future features:

* Dark mode
* Search and filtering
* Bulk status updates
* Better export history
* Multiple Instagram account profiles
* Result comparison between different export dates
* Improved support for additional Instagram export structures
* Docker support
* Desktop app packaging

---

## Contributing

Contributions are welcome.

To contribute:

1. Fork the repository.
2. Create a new branch.
3. Make your changes.
4. Test your changes.
5. Open a pull request.

Please keep the project local-first, privacy-friendly, and free of Instagram automation.

---

## License

This project can be released under the MIT License.

Add a `LICENSE` file to the repository if you want to publish it as open source.

---

## Author

Created by Shahaf Elkayam.

---

## Summary

UnfollowerDetector is a simple, privacy-friendly tool for analyzing Instagram followers and following data. It helps users identify non-mutual follows, organize them with statuses, and review accounts manually through clickable profile links.
