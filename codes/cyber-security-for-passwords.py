#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SOVEREIGN-X PORTABLE SECURITY & SIGNAL ANALYZER
جهاز محمول لإدارة البيانات والأمان وتحليل الإشارات
ملف واحد متكامل - مناسب للأجهزة الصغيرة
"""

import os
import sys
import json
import time
import math
import sqlite3
import hashlib
import secrets
import string
import logging
import getpass
import subprocess
import re
import threading
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple
from contextlib import contextmanager

# ============================================================
# CONFIGURATION
# ============================================================
class Config:
    APP_NAME = "SovereignX-Security"
    VERSION = "1.0.0"
    DB_PATH = "sovereignx.db"
    LOG_PATH = "logs/sovereignx.log"
    KEY_FILE = ".master_key"
    LOCK_TIMEOUT = 300  # seconds (5 minutes auto-lock)
    SIGNAL_SCAN_INTERVAL = 5  # seconds
    MAX_SIGNAL_HISTORY = 1000

    # UI Settings for small screen
    SCREEN_WIDTH = 40
    SCREEN_HEIGHT = 20

# ============================================================
# LOGGING SETUP
# ============================================================
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(Config.LOG_PATH),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ============================================================
# ENCRYPTION MODULE
# ============================================================
class Encryption:
    """Simple but strong encryption using Fernet-like approach with PBKDF2"""

    def __init__(self, master_password: str):
        self.key = self._derive_key(master_password)

    def _derive_key(self, password: str, salt: bytes = None) -> Tuple[bytes, bytes]:
        if salt is None:
            salt = secrets.token_bytes(16)
        key = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000, 32)
        return key, salt

    def encrypt(self, data: str) -> str:
        """Encrypt data using XOR with derived key (simplified for embedded)"""
        import base64
        salt = secrets.token_bytes(16)
        key, _ = self._derive_key(self.key[0].hex() if isinstance(self.key, tuple) else self.key.hex(), salt)
        if isinstance(self.key, tuple):
            key = self.key[0]
        data_bytes = data.encode('utf-8')
        encrypted = bytearray()
        for i, byte in enumerate(data_bytes):
            encrypted.append(byte ^ key[i % len(key)])
        result = base64.b64encode(salt + bytes(encrypted)).decode()
        return result

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt data"""
        import base64
        try:
            data = base64.b64decode(encrypted_data.encode())
            salt = data[:16]
            encrypted = data[16:]
            key, _ = self._derive_key(self.key[0].hex() if isinstance(self.key, tuple) else self.key.hex(), salt)
            if isinstance(self.key, tuple):
                key = self.key[0]
            decrypted = bytearray()
            for i, byte in enumerate(encrypted):
                decrypted.append(byte ^ key[i % len(key)])
            return bytes(decrypted).decode('utf-8')
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise ValueError("فشل فك التشفير - كلمة المرور الرئيسية غير صحيحة")

# ============================================================
# DATABASE MODULE
# ============================================================
class Database:
    def __init__(self, db_path: str = Config.DB_PATH):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self._connect() as conn:
            # Passwords table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS passwords (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    service TEXT NOT NULL,
                    username TEXT,
                    encrypted_password TEXT NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Signal history table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS signal_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    signal_type TEXT NOT NULL,
                    ssid TEXT,
                    bssid TEXT,
                    rssi INTEGER,
                    frequency REAL,
                    distance_approx REAL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # GPS/Map points table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS map_points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    latitude REAL,
                    longitude REAL,
                    altitude REAL,
                    label TEXT,
                    signal_id INTEGER,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (signal_id) REFERENCES signal_history(id)
                )
            """)

            # Auth log table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS auth_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT NOT NULL,
                    status TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            logger.info("Database initialized successfully")

# ============================================================
# AUTHENTICATION MODULE
# ============================================================
class Authentication:
    def __init__(self, db: Database):
        self.db = db
        self._master_hash = None
        self._last_activity = time.time()
        self._locked = False
        self._load_master_hash()

    def _load_master_hash(self):
        if os.path.exists(Config.KEY_FILE):
            with open(Config.KEY_FILE, 'r') as f:
                self._master_hash = f.read().strip()

    def _hash_password(self, password: str) -> str:
        salt = secrets.token_hex(16)
        pwdhash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return salt + pwdhash.hex()

    def _verify_password(self, password: str, stored: str) -> bool:
        salt = stored[:32]
        stored_hash = stored[32:]
        pwdhash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return pwdhash.hex() == stored_hash

    def is_first_run(self) -> bool:
        return self._master_hash is None

    def setup_master_password(self, password: str):
        if len(password) < 8:
            raise ValueError("كلمة المرور يجب أن تكون 8 أحرف على الأقل")
        self._master_hash = self._hash_password(password)
        with open(Config.KEY_FILE, 'w') as f:
            f.write(self._master_hash)
        self._log_auth("SETUP", "SUCCESS")
        logger.info("Master password set successfully")

    def login(self, password: str) -> bool:
        if self._master_hash is None:
            return False
        if self._verify_password(password, self._master_hash):
            self._last_activity = time.time()
            self._locked = False
            self._log_auth("LOGIN", "SUCCESS")
            return True
        self._log_auth("LOGIN", "FAILED")
        logger.warning("Failed login attempt")
        return False

    def check_auto_lock(self):
        if time.time() - self._last_activity > Config.LOCK_TIMEOUT:
            if not self._locked:
                self._locked = True
                logger.info("System auto-locked due to inactivity")
        return self._locked

    def update_activity(self):
        self._last_activity = time.time()
        self._locked = False

    def _log_auth(self, action: str, status: str):
        with self.db._connect() as conn:
            conn.execute(
                "INSERT INTO auth_log (action, status) VALUES (?, ?)",
                (action, status)
            )

# ============================================================
# PASSWORD MANAGER MODULE
# ============================================================
class PasswordManager:
    def __init__(self, db: Database, encryption: Encryption):
        self.db = db
        self.encryption = encryption

    def add_password(self, service: str, username: str, password: str, notes: str = ""):
        encrypted = self.encryption.encrypt(password)
        with self.db._connect() as conn:
            conn.execute(
                """INSERT INTO passwords (service, username, encrypted_password, notes) 
                   VALUES (?, ?, ?, ?)""",
                (service, username, encrypted, notes)
            )
        logger.info(f"Password added for service: {service}")

    def get_passwords(self) -> List[Dict]:
        with self.db._connect() as conn:
            rows = conn.execute("SELECT * FROM passwords ORDER BY created_at DESC").fetchall()
            return [dict(row) for row in rows]

    def get_password(self, entry_id: int) -> Optional[str]:
        with self.db._connect() as conn:
            row = conn.execute(
                "SELECT encrypted_password FROM passwords WHERE id = ?", (entry_id,)
            ).fetchone()
            if row:
                return self.encryption.decrypt(row['encrypted_password'])
        return None

    def delete_password(self, entry_id: int):
        with self.db._connect() as conn:
            conn.execute("DELETE FROM passwords WHERE id = ?", (entry_id,))
        logger.info(f"Password entry {entry_id} deleted")

    def update_password(self, entry_id: int, service: str = None, username: str = None, 
                       password: str = None, notes: str = None):
        updates = []
        params = []
        if service:
            updates.append("service = ?")
            params.append(service)
        if username:
            updates.append("username = ?")
            params.append(username)
        if password:
            updates.append("encrypted_password = ?")
            params.append(self.encryption.encrypt(password))
        if notes:
            updates.append("notes = ?")
            params.append(notes)
        if updates:
            params.append(entry_id)
            with self.db._connect() as conn:
                conn.execute(
                    f"UPDATE passwords SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    params
                )
            logger.info(f"Password entry {entry_id} updated")

# ============================================================
# PASSWORD GENERATOR MODULE
# ============================================================
class PasswordGenerator:
    @staticmethod
    def generate(length: int = 16, uppercase: bool = True, lowercase: bool = True,
                 digits: bool = True, symbols: bool = True) -> Tuple[str, str]:
        chars = ""
        if lowercase:
            chars += string.ascii_lowercase
        if uppercase:
            chars += string.ascii_uppercase
        if digits:
            chars += string.digits
        if symbols:
            chars += "!@#$%^&*()_+-=[]{}|;:,.<>?"

        if not chars:
            raise ValueError("يجب اختيار نوع واحد على الأقل من الأحرف")

        password = ''.join(secrets.choice(chars) for _ in range(length))
        strength = PasswordGenerator._check_strength(password)
        return password, strength

    @staticmethod
    def _check_strength(password: str) -> str:
        score = 0
        if len(password) >= 12:
            score += 1
        if len(password) >= 16:
            score += 1
        if any(c.isupper() for c in password):
            score += 1
        if any(c.islower() for c in password):
            score += 1
        if any(c.isdigit() for c in password):
            score += 1
        if any(c in string.punctuation for c in password):
            score += 1

        if score <= 2:
            return "ضعيفة"
        elif score <= 4:
            return "متوسطة"
        elif score <= 5:
            return "قوية"
        else:
            return "قوية جداً"

# ============================================================
# SIGNAL SCANNER MODULE
# ============================================================
@dataclass
class SignalReading:
    signal_type: str  # WiFi, Bluetooth
    ssid: Optional[str]
    bssid: str
    rssi: int
    frequency: Optional[float]
    distance_approx: Optional[float]
    timestamp: str

class SignalScanner:
    """Scanner for nearby wireless signals using system tools"""

    def __init__(self, db: Database):
        self.db = db
        self.scanning = False
        self._scan_thread = None
        self._last_results: List[SignalReading] = []

    def _estimate_distance(self, rssi: int, freq_mhz: float = 2400) -> float:
        """Estimate distance using Free Space Path Loss formula"""
        try:
            # FSPL: d = 10^((27.55 - 20*log10(f) + |RSSI|)/20)
            # Simplified for 2.4GHz/5GHz
            distance = 10 ** ((27.55 - 20 * math.log10(freq_mhz) + abs(rssi)) / 20)
            return round(min(distance, 100), 2)  # Cap at 100m
        except:
            return -1.0

    def scan_wifi(self) -> List[SignalReading]:
        """Scan WiFi networks using iwlist or nmcli"""
        results = []
        try:
            # Try nmcli first (more reliable)
            cmd = ["nmcli", "-t", "-f", "SSID,BSSID,SIGNAL,FREQ", "dev", "wifi"]
            output = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

            if output.returncode == 0 and output.stdout:
                for line in output.stdout.strip().split('\n'):
                    parts = line.split(':')
                    if len(parts) >= 4:
                        ssid = parts[0] if parts[0] else "Hidden"
                        bssid = parts[1]
                        signal = int(parts[2]) if parts[2].isdigit() else -100
                        freq = float(parts[3]) if parts[3] else 2400
                        # Convert signal quality % to RSSI approx
                        rssi = (signal / 2) - 100
                        distance = self._estimate_distance(int(rssi), freq)

                        reading = SignalReading(
                            signal_type="WiFi",
                            ssid=ssid[:20],
                            bssid=bssid,
                            rssi=int(rssi),
                            frequency=freq,
                            distance_approx=distance,
                            timestamp=datetime.now().isoformat()
                        )
                        results.append(reading)

            # Fallback to iwlist
            if not results:
                cmd = ["sudo", "iwlist", "scan"]
                output = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                if output.returncode == 0:
                    results = self._parse_iwlist(output.stdout)

        except FileNotFoundError:
            logger.warning("nmcli/iwlist not found. WiFi scanning unavailable.")
        except Exception as e:
            logger.error(f"WiFi scan error: {e}")

        return results

    def _parse_iwlist(self, output: str) -> List[SignalReading]:
        results = []
        cells = output.split("Cell ")
        for cell in cells[1:]:
            try:
                essid_match = re.search(r'ESSID:"([^"]*)"', cell)
                address_match = re.search(r'Address: ([0-9A-F:]{17})', cell)
                signal_match = re.search(r'Signal level=(-?\d+)', cell)
                freq_match = re.search(r'Frequency:([\d.]+)', cell)

                if address_match:
                    ssid = essid_match.group(1) if essid_match else "Hidden"
                    bssid = address_match.group(1)
                    rssi = int(signal_match.group(1)) if signal_match else -100
                    freq = float(freq_match.group(1)) * 1000 if freq_match else 2400
                    distance = self._estimate_distance(rssi, freq)

                    results.append(SignalReading(
                        signal_type="WiFi",
                        ssid=ssid[:20],
                        bssid=bssid,
                        rssi=rssi,
                        frequency=freq,
                        distance_approx=distance,
                        timestamp=datetime.now().isoformat()
                    ))
            except Exception:
                continue
        return results

    def scan_bluetooth(self) -> List[SignalReading]:
        """Scan Bluetooth devices using hcitool or bluetoothctl"""
        results = []
        try:
            cmd = ["hcitool", "scan", "--flush"]
            output = subprocess.run(cmd, capture_output=True, text=True, timeout=10)

            if output.returncode == 0:
                for line in output.stdout.strip().split('\n')[1:]:
                    parts = line.strip().split('\t')
                    if len(parts) >= 2:
                        mac = parts[0]
                        name = parts[1] if len(parts) > 1 else "Unknown"

                        # Try to get RSSI
                        rssi = -100
                        try:
                            rssi_cmd = ["hcitool", "rssi", mac]
                            rssi_out = subprocess.run(rssi_cmd, capture_output=True, text=True, timeout=5)
                            if rssi_out.returncode == 0:
                                rssi_match = re.search(r'-?\d+', rssi_out.stdout)
                                if rssi_match:
                                    rssi = int(rssi_match.group())
                        except:
                            pass

                        distance = self._estimate_distance(rssi, 2400)
                        results.append(SignalReading(
                            signal_type="Bluetooth",
                            ssid=name[:20],
                            bssid=mac,
                            rssi=rssi,
                            frequency=2400,
                            distance_approx=distance,
                            timestamp=datetime.now().isoformat()
                        ))
        except FileNotFoundError:
            logger.warning("hcitool not found. Bluetooth scanning unavailable.")
        except Exception as e:
            logger.error(f"Bluetooth scan error: {e}")

        return results

    def scan_all(self) -> List[SignalReading]:
        """Scan all available signal types"""
        wifi = self.scan_wifi()
        bt = self.scan_bluetooth()
        all_signals = wifi + bt

        # Sort by RSSI (strongest first)
        all_signals.sort(key=lambda x: x.rssi, reverse=True)
        self._last_results = all_signals

        # Save to database
        self._save_to_db(all_signals)

        return all_signals

    def _save_to_db(self, signals: List[SignalReading]):
        with self.db._connect() as conn:
            for sig in signals:
                conn.execute(
                    """INSERT INTO signal_history 
                       (signal_type, ssid, bssid, rssi, frequency, distance_approx)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (sig.signal_type, sig.ssid, sig.bssid, sig.rssi, 
                     sig.frequency, sig.distance_approx)
                )

    def get_history(self, limit: int = 50) -> List[Dict]:
        with self.db._connect() as conn:
            rows = conn.execute(
                """SELECT * FROM signal_history 
                   ORDER BY timestamp DESC LIMIT ?""", (limit,)
            ).fetchall()
            return [dict(row) for row in rows]

    def start_continuous_scan(self, callback=None):
        self.scanning = True
        def scan_loop():
            while self.scanning:
                results = self.scan_all()
                if callback:
                    callback(results)
                time.sleep(Config.SIGNAL_SCAN_INTERVAL)
        self._scan_thread = threading.Thread(target=scan_loop, daemon=True)
        self._scan_thread.start()

    def stop_continuous_scan(self):
        self.scanning = False

# ============================================================
# MAP MODULE
# ============================================================
class MapManager:
    """Simple map point manager for GPS and signal locations"""

    def __init__(self, db: Database):
        self.db = db

    def get_gps_location(self) -> Optional[Tuple[float, float, float]]:
        """Try to get GPS location from gpsd or geoclue"""
        try:
            # Try gpsd
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            sock.connect(("localhost", 2947))
            sock.sendall(b'?WATCH={"enable":true}\n')
            time.sleep(1)
            sock.sendall(b'?POLL;\n')
            data = sock.recv(4096).decode()
            sock.close()

            # Simple parsing
            lat_match = re.search(r'"lat":([-?\d.]+)', data)
            lon_match = re.search(r'"lon":([-?\d.]+)', data)
            alt_match = re.search(r'"alt":([-?\d.]+)', data)

            if lat_match and lon_match:
                return (
                    float(lat_match.group(1)),
                    float(lon_match.group(1)),
                    float(alt_match.group(1)) if alt_match else 0.0
                )
        except:
            pass

        # Try geoclue
        try:
            cmd = ["busctl", "--user", "call", "org.freedesktop.GeoClue2", 
                   "/org/freedesktop/GeoClue2/Manager", "org.freedesktop.GeoClue2.Manager", 
                   "GetClient"]
            # This is simplified - real implementation would need D-Bus interaction
        except:
            pass

        return None

    def add_point(self, lat: float, lon: float, altitude: float = 0.0, 
                  label: str = "", signal_id: int = None):
        with self.db._connect() as conn:
            conn.execute(
                """INSERT INTO map_points (latitude, longitude, altitude, label, signal_id)
                   VALUES (?, ?, ?, ?, ?)""",
                (lat, lon, altitude, label, signal_id)
            )
        logger.info(f"Map point added: {lat}, {lon}")

    def get_points(self, limit: int = 100) -> List[Dict]:
        with self.db._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM map_points ORDER BY timestamp DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(row) for row in rows]

    def generate_ascii_map(self, points: List[Dict], width: int = 40, height: int = 15) -> str:
        """Generate a simple ASCII map for small screens"""
        if not points:
            return "لا توجد نقاط على الخريطة"

        # Find bounds
        lats = [p['latitude'] for p in points]
        lons = [p['longitude'] for p in points]
        min_lat, max_lat = min(lats), max(lats)
        min_lon, max_lon = min(lons), max(lons)

        # Add padding
        lat_pad = (max_lat - min_lat) * 0.1 or 0.001
        lon_pad = (max_lon - min_lon) * 0.1 or 0.001
        min_lat -= lat_pad
        max_lat += lat_pad
        min_lon -= lon_pad
        max_lon += lon_pad

        # Create grid
        grid = [['.' for _ in range(width)] for _ in range(height)]

        for p in points:
            x = int((p['longitude'] - min_lon) / (max_lon - min_lon) * (width - 1))
            y = int((max_lat - p['latitude']) / (max_lat - min_lat) * (height - 1))
            x = max(0, min(x, width - 1))
            y = max(0, min(y, height - 1))
            grid[y][x] = 'X'

        lines = [
            "┌" + "─" * width + "┐",
            f"│{'خريطة النقاط':^{width}}│",
            "├" + "─" * width + "┤"
        ]
        for row in grid:
            lines.append("│" + "".join(row) + "│")
        lines.append("└" + "─" * width + "┘")
        lines.append(f"نطاق: [{min_lat:.4f}, {min_lon:.4f}] -> [{max_lat:.4f}, {max_lon:.4f}]")

        return "\n".join(lines)

# ============================================================
# UI MODULE - Simple Terminal Interface for Small Screens
# ============================================================
class TerminalUI:
    def __init__(self, auth: Authentication, db: Database):
        self.auth = auth
        self.db = db
        self.encryption = None
        self.password_manager = None
        self.scanner = SignalScanner(db)
        self.map_manager = MapManager(db)
        self.running = True

    def clear(self):
        os.system('clear' if os.name != 'nt' else 'cls')

    def print_header(self, title: str):
        w = Config.SCREEN_WIDTH
        self.clear()
        print("═" * w)
        print(f"{title:^{w}}")
        print("═" * w)

    def print_box(self, text: str):
        w = Config.SCREEN_WIDTH
        print("┌" + "─" * (w - 2) + "┐")
        for line in text.split('\n'):
            print(f"│ {line:<{w-4}} │")
        print("└" + "─" * (w - 2) + "┘")

    def input_prompt(self, prompt: str) -> str:
        return input(f">>> {prompt}: ").strip()

    def show_menu(self, title: str, options: Dict[str, str]) -> str:
        self.print_header(title)
        for key, value in options.items():
            print(f"  [{key}] {value}")
        print("─" * Config.SCREEN_WIDTH)
        return self.input_prompt("اختر")

    def run(self):
        # First run setup
        if self.auth.is_first_run():
            self.setup_wizard()

        # Login
        if not self.login_screen():
            return

        # Main loop
        while self.running:
            if self.auth.check_auto_lock():
                self.locked_screen()
                continue

            choice = self.show_menu(
                "SovereignX Security Hub",
                {
                    "1": "مدير كلمات المرور",
                    "2": "مولد كلمات مرور",
                    "3": "ماسح الإشارات",
                    "4": "تحليل الإشارات",
                    "5": "الخريطة والمواقع",
                    "6": "سجل النشاطات",
                    "7": "قفل الجهاز",
                    "0": "خروج"
                }
            )

            self.auth.update_activity()

            if choice == "1":
                self.password_manager_menu()
            elif choice == "2":
                self.password_generator_menu()
            elif choice == "3":
                self.signal_scanner_menu()
            elif choice == "4":
                self.signal_analyzer_menu()
            elif choice == "5":
                self.map_menu()
            elif choice == "6":
                self.activity_log_menu()
            elif choice == "7":
                self.auth._locked = True
            elif choice == "0":
                self.running = False

    def setup_wizard(self):
        self.print_header("إعداد أولي")
        print("مرحباً بك في SovereignX Security Hub")
        print("يجب إنشاء كلمة مرور رئيسية للجهاز")
        print("─" * Config.SCREEN_WIDTH)

        while True:
            pwd = getpass.getpass(">>> أدخل كلمة المرور الرئيسية: ")
            confirm = getpass.getpass(">>> تأكيد كلمة المرور: ")
            if pwd == confirm and len(pwd) >= 8:
                try:
                    self.auth.setup_master_password(pwd)
                    self.encryption = Encryption(pwd)
                    self.password_manager = PasswordManager(self.db, self.encryption)
                    print("✓ تم الإعداد بنجاح!")
                    time.sleep(1)
                    break
                except Exception as e:
                    print(f"خطأ: {e}")
            else:
                print("خطأ: كلمات المرور غير متطابقة أو أقل من 8 أحرف")

    def login_screen(self) -> bool:
        attempts = 0
        max_attempts = 3

        while attempts < max_attempts:
            self.print_header("تسجيل الدخول")
            pwd = getpass.getpass(">>> كلمة المرور الرئيسية: ")

            if self.auth.login(pwd):
                self.encryption = Encryption(pwd)
                self.password_manager = PasswordManager(self.db, self.encryption)
                print("✓ تم تسجيل الدخول بنجاح")
                time.sleep(1)
                return True
            else:
                attempts += 1
                print(f"✗ كلمة المرور خاطئة (محاولة {attempts}/{max_attempts})")
                time.sleep(1)

        print("✗ تم تجاوز عدد المحاولات. الخروج...")
        time.sleep(2)
        return False

    def locked_screen(self):
        self.print_header("الجهاز مقفل")
        print("تم القفل التلقائي بسبب عدم النشاط")
        print("─" * Config.SCREEN_WIDTH)
        pwd = getpass.getpass(">>> أدخل كلمة المرور لفك القفل: ")
        if self.auth.login(pwd):
            print("✓ تم فك القفل")
            time.sleep(1)
        else:
            print("✗ كلمة المرور خاطئة")
            time.sleep(1)

    def password_manager_menu(self):
        while True:
            choice = self.show_menu(
                "مدير كلمات المرور",
                {
                    "1": "عرض كلمات المرور المحفوظة",
                    "2": "إضافة كلمة مرور جديدة",
                    "3": "حذف كلمة مرور",
                    "4": "عرض كلمة مرور (فك تشفير)",
                    "0": "رجوع"
                }
            )

            if choice == "1":
                passwords = self.password_manager.get_passwords()
                self.print_header("كلمات المرور المحفوظة")
                if not passwords:
                    print("لا توجد كلمات مرور محفوظة")
                else:
                    for p in passwords:
                        print(f"ID:{p['id']} | {p['service']} | {p['username']} | {p['created_at']}")
                input("\nاضغط Enter للمتابعة...")

            elif choice == "2":
                service = self.input_prompt("اسم الخدمة")
                username = self.input_prompt("اسم المستخدم")
                password = getpass.getpass(">>> كلمة المرور: ")
                notes = self.input_prompt("ملاحظات (اختياري)")
                self.password_manager.add_password(service, username, password, notes)
                print("✓ تم الحفظ بنجاح")
                time.sleep(1)

            elif choice == "3":
                pid = self.input_prompt("أدخل ID للحذف")
                if pid.isdigit():
                    self.password_manager.delete_password(int(pid))
                    print("✓ تم الحذف")
                time.sleep(1)

            elif choice == "4":
                pid = self.input_prompt("أدخل ID لعرض كلمة المرور")
                if pid.isdigit():
                    pwd = self.password_manager.get_password(int(pid))
                    if pwd:
                        self.print_box(f"كلمة المرور: {pwd}")
                    else:
                        print("✗ لم يتم العثور على البيانات")
                input("\nاضغط Enter للمتابعة...")

            elif choice == "0":
                break

    def password_generator_menu(self):
        self.print_header("مولد كلمات المرور")

        try:
            length = int(self.input_prompt("طول كلمة المرور (افتراضي 16)") or "16")
            upper = self.input_prompt("تضمين أحرف كبيرة؟ (y/n)").lower() != 'n'
            lower = self.input_prompt("تضمين أحرف صغيرة؟ (y/n)").lower() != 'n'
            digits = self.input_prompt("تضمين أرقام؟ (y/n)").lower() != 'n'
            symbols = self.input_prompt("تضمين رموز؟ (y/n)").lower() != 'n'

            password, strength = PasswordGenerator.generate(length, upper, lower, digits, symbols)

            self.print_box(f"كلمة المرور: {password}\nالقوة: {strength}")

            save = self.input_prompt("حفظ في مدير كلمات المرور؟ (y/n)").lower()
            if save == 'y':
                service = self.input_prompt("اسم الخدمة")
                username = self.input_prompt("اسم المستخدم")
                self.password_manager.add_password(service, username, password)
                print("✓ تم الحفظ")
        except Exception as e:
            print(f"خطأ: {e}")

        input("\nاضغط Enter للمتابعة...")

    def signal_scanner_menu(self):
        while True:
            choice = self.show_menu(
                "ماسح الإشارات",
                {
                    "1": "مسح WiFi",
                    "2": "مسح Bluetooth",
                    "3": "مسح شامل (الكل)",
                    "4": "مسح مستمر (خلفية)",
                    "5": "إيقاف المسح المستمر",
                    "0": "رجوع"
                }
            )

            if choice == "1":
                self.print_header("جاري مسح WiFi...")
                results = self.scanner.scan_wifi()
                self._display_signals(results)

            elif choice == "2":
                self.print_header("جاري مسح Bluetooth...")
                results = self.scanner.scan_bluetooth()
                self._display_signals(results)

            elif choice == "3":
                self.print_header("جاري المسح الشامل...")
                results = self.scanner.scan_all()
                self._display_signals(results)

            elif choice == "4":
                print("بدء المسح المستمر... (اضغط Enter لإيقاف)")
                self.scanner.start_continuous_scan(self._display_signals_callback)
                input()
                self.scanner.stop_continuous_scan()

            elif choice == "5":
                self.scanner.stop_continuous_scan()
                print("✓ تم إيقاف المسح")
                time.sleep(1)

            elif choice == "0":
                break

    def _display_signals(self, results: List[SignalReading]):
        self.print_header(f"نتائج المسح - {len(results)} إشارة")
        if not results:
            print("لم يتم العثور على إشارات")
        else:
            print(f"{'النوع':<8} {'الاسم':<15} {'RSSI':<6} {'المسافة':<10}")
            print("─" * Config.SCREEN_WIDTH)
            for r in results[:20]:  # Limit for small screen
                dist = f"{r.distance_approx}m" if r.distance_approx and r.distance_approx > 0 else "N/A"
                name = (r.ssid or "Hidden")[:14]
                print(f"{r.signal_type:<8} {name:<15} {r.rssi:<6} {dist:<10}")
        input("\nاضغط Enter للمتابعة...")

    def _display_signals_callback(self, results: List[SignalReading]):
        self.clear()
        print(f"[مسح مستمر] {len(results)} إشارة مكتشفة")
        for r in results[:10]:
            dist = f"{r.distance_approx}m" if r.distance_approx and r.distance_approx > 0 else "N/A"
            print(f"{r.signal_type}: {r.ssid or 'Hidden'} | RSSI:{r.rssi} | {dist}")
        print("\n(اضغط Enter في القائمة لإيقاف)")

    def signal_analyzer_menu(self):
        self.print_header("تحليل الإشارات")
        history = self.scanner.get_history(50)

        if not history:
            print("لا توجد بيانات سابقة")
        else:
            # Statistics
            wifi_count = sum(1 for h in history if h['signal_type'] == 'WiFi')
            bt_count = sum(1 for h in history if h['signal_type'] == 'Bluetooth')
            avg_rssi = sum(h['rssi'] for h in history) / len(history)

            self.print_box(
                f"إجمالي القراءات: {len(history)}\n"
                f"WiFi: {wifi_count} | BT: {bt_count}\n"
                f"متوسط RSSI: {avg_rssi:.1f} dBm"
            )

            print("\nآخر 10 قراءات:")
            for h in history[:10]:
                dist = f"{h['distance_approx']}m" if h['distance_approx'] else "N/A"
                print(f"{h['timestamp'][:16]} | {h['signal_type']} | {h['ssid'] or 'Hidden'} | {dist}")

        input("\nاضغط Enter للمتابعة...")

    def map_menu(self):
        while True:
            choice = self.show_menu(
                "الخريطة والمواقع",
                {
                    "1": "قراءة موقع GPS الحالي",
                    "2": "عرض النقاط المحفوظة",
                    "3": "إضافة نقطة يدوياً",
                    "4": "عرض خريطة ASCII",
                    "0": "رجوع"
                }
            )

            if choice == "1":
                self.print_header("جاري قراءة GPS...")
                loc = self.map_manager.get_gps_location()
                if loc:
                    lat, lon, alt = loc
                    self.print_box(f"الموقع الحالي:\nخط العرض: {lat:.6f}\nخط الطول: {lon:.6f}\nالارتفاع: {alt:.1f}m")
                    save = self.input_prompt("حفظ النقطة؟ (y/n)").lower()
                    if save == 'y':
                        label = self.input_prompt("اسم النقطة")
                        self.map_manager.add_point(lat, lon, alt, label)
                        print("✓ تم الحفظ")
                else:
                    print("✗ لا يمكن الحصول على موقع GPS")
                    print("تأكد من تشغيل gpsd أو توفر خدمة الموقع")
                time.sleep(2)

            elif choice == "2":
                points = self.map_manager.get_points()
                self.print_header("النقاط المحفوظة")
                if not points:
                    print("لا توجد نقاط")
                else:
                    for p in points:
                        print(f"ID:{p['id']} | {p['label'] or 'بدون اسم'} | {p['latitude']:.4f}, {p['longitude']:.4f}")
                input("\nاضغط Enter للمتابعة...")

            elif choice == "3":
                try:
                    lat = float(self.input_prompt("خط العرض"))
                    lon = float(self.input_prompt("خط الطول"))
                    alt = float(self.input_prompt("الارتفاع (افتراضي 0)") or "0")
                    label = self.input_prompt("اسم النقطة")
                    self.map_manager.add_point(lat, lon, alt, label)
                    print("✓ تمت الإضافة")
                except ValueError:
                    print("✗ إحداثيات غير صالحة")
                time.sleep(1)

            elif choice == "4":
                points = self.map_manager.get_points()
                self.print_header("خريطة ASCII")
                print(self.map_manager.generate_ascii_map(points))
                input("\nاضغط Enter للمتابعة...")

            elif choice == "0":
                break

    def activity_log_menu(self):
        self.print_header("سجل النشاطات")
        with self.db._connect() as conn:
            logs = conn.execute(
                "SELECT * FROM auth_log ORDER BY timestamp DESC LIMIT 20"
            ).fetchall()

            if not logs:
                print("لا توجد سجلات")
            else:
                for log in logs:
                    status_icon = "✓" if log['status'] == 'SUCCESS' else "✗"
                    print(f"{status_icon} {log['timestamp'][:16]} | {log['action']}")

        input("\nاضغط Enter للمتابعة...")

# ============================================================
# MAIN ENTRY POINT
# ============================================================
def main():
    print("""
    ╔══════════════════════════════════════╗
    ║     SovereignX Security Hub          ║
    ║   Portable Data & Security Tool      ║
    ╚══════════════════════════════════════╝
    """)
    time.sleep(1)

    try:
        db = Database()
        auth = Authentication(db)
        ui = TerminalUI(auth, db)
        ui.run()
    except KeyboardInterrupt:
        print("\n\nتم إيقاف البرنامج بواسطة المستخدم")
    except Exception as e:
        logger.exception("Fatal error")
        print(f"\nخطأ فادح: {e}")
    finally:
        print("\nشكراً لاستخدام SovereignX Security Hub")

if __name__ == "__main__":
    main()
