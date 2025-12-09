import sqlite3
import json
import os
from datetime import datetime
from typing import Dict, List, Optional
import logging

DB_PATH = "backend/primer_pool.db"
logger = logging.getLogger(__name__)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database tables"""
    os.makedirs("backend", exist_ok=True)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Uploads table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS uploads (
            id TEXT PRIMARY KEY,
            filename TEXT,
            uploaded_at TIMESTAMP,
            raw_data TEXT
        )
        ''')
        
        # Jobs table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            status TEXT,
            created_at TIMESTAMP,
            completed_at TIMESTAMP,
            error TEXT,
            upload_id TEXT,
            FOREIGN KEY (upload_id) REFERENCES uploads (id)
        )
        ''')
        
        # Results table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS results (
            job_id TEXT PRIMARY KEY,
            data TEXT,
            FOREIGN KEY (job_id) REFERENCES jobs (id)
        )
        ''')
        
        conn.commit()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise
    finally:
        conn.close()

def save_upload(upload_id: str, filename: str, raw_data: List[Dict]):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO uploads (id, filename, uploaded_at, raw_data) VALUES (?, ?, ?, ?)',
            (upload_id, filename, datetime.now(), json.dumps(raw_data))
        )
        conn.commit()
    finally:
        conn.close()

def create_job(job_id: str, status: str = 'processing', upload_id: Optional[str] = None):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO jobs (id, status, created_at, upload_id) VALUES (?, ?, ?, ?)',
            (job_id, status, datetime.now(), upload_id)
        )
        conn.commit()
    finally:
        conn.close()

def update_job_status(job_id: str, status: str, error: Optional[str] = None):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if status in ['completed', 'error']:
            cursor.execute(
                'UPDATE jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?',
                (status, error, datetime.now(), job_id)
            )
        else:
            cursor.execute(
                'UPDATE jobs SET status = ?, error = ? WHERE id = ?',
                (status, error, job_id)
            )
        conn.commit()
    finally:
        conn.close()

def save_job_results(job_id: str, results: Dict):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            'INSERT OR REPLACE INTO results (job_id, data) VALUES (?, ?)',
            (job_id, json.dumps(results))
        )
        conn.commit()
    finally:
        conn.close()

def get_job(job_id: str) -> Optional[Dict]:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        job = cursor.execute('SELECT * FROM jobs WHERE id = ?', (job_id,)).fetchone()
        
        if not job:
            return None
            
        result = dict(job)
        
        # If completed, fetch results
        if job['status'] == 'completed':
            res = cursor.execute('SELECT data FROM results WHERE job_id = ?', (job_id,)).fetchone()
            if res:
                result['results'] = json.loads(res['data'])
        
        return result
    finally:
        conn.close()

def get_stats() -> Dict:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        total = cursor.execute('SELECT COUNT(*) FROM jobs').fetchone()[0]
        completed = cursor.execute("SELECT COUNT(*) FROM jobs WHERE status = 'completed'").fetchone()[0]
        processing = cursor.execute("SELECT COUNT(*) FROM jobs WHERE status = 'processing'").fetchone()[0]
        failed = cursor.execute("SELECT COUNT(*) FROM jobs WHERE status = 'error'").fetchone()[0]
        
        return {
            "total_jobs": total,
            "completed": completed,
            "processing": processing,
            "failed": failed
        }
    finally:
        conn.close()
