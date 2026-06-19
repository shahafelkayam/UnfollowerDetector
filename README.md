# 🕵️‍♂️ UnfollowerDetector

**UnfollowerDetector** is a simple local Python web app that helps you find Instagram accounts you follow that do **not** follow you back.

It works with your official Instagram data export, compares your followers and following lists, and shows a clean list of non-mutual follows with clickable profile links.

---

## ✨ Features

* 🔍 Detect users who do not follow you back
* 📁 Use Instagram export JSON files
* 🖥️ Run locally on your computer
* 🔗 Open each Instagram profile directly
* ⭐ Mark users as **Whitelisted**
* 💤 Mark users as **Inactive**
* 🔐 No Instagram password required
* 🚫 No automatic unfollowing
* 🧘 Simple, privacy-friendly workflow

---

## 📸 What It Does

UnfollowerDetector compares two lists from your Instagram data export:

* People who follow you
* People you follow

Then it shows the accounts that appear in your following list but not in your followers list.

Each result includes a direct profile link so you can manually review the account.

---

## 🛡️ Privacy First

Your data stays on your own computer.

UnfollowerDetector does **not** ask for your Instagram login details and does **not** connect to your Instagram account.

It only reads the JSON files that you choose to provide from your Instagram export.

---

## 📦 Installation

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

### 3. Install requirements

```bash
pip install -r requirements.txt
```

---

## 🚀 Running the App

Start the project with:

```bash
python run.py
```

Then open your browser and go to:

```txt
http://127.0.0.1:8080
```

---

## 📥 Getting Your Instagram Data

To use the app, download your Instagram information in JSON format.

You will need the files that contain your followers and following data.

They are usually found inside the Instagram export under a folder related to:

```txt
connections/followers_and_following
```

The looked-after file names may include:

```txt
followers_1.json
following.json
```

---

## 🧭 How to Use

### Option 1: Use Local Files 📁

Place your Instagram followers/following JSON files in the project’s `connections` directory, then run the app and scan locally.

### Option 2: Upload JSON Files ⬆️

Use the app interface to upload your followers and following files directly.

### Option 3: Paste JSON Content 📝

Paste the JSON content manually into the app and analyze it instantly.

---

## 🏷️ User Statuses

You can organize detected users with statuses:

### ⚪ Normal

A user who does not follow you back and has not been marked yet.

### ⭐ Whitelisted

A user who does not follow you back, but you still want to keep following.

Useful for:

* Celebrities
* Brands
* Friends
* News pages
* Accounts you intentionally follow

### 💤 Inactive

A user that seems inactive or abandoned.

---


## ⚠️ Disclaimer

This project is not affiliated with Instagram or Meta.

UnfollowerDetector does not log in to Instagram, scrape data, or perform automatic unfollow actions. It only helps you analyze your own exported data and review accounts manually.

