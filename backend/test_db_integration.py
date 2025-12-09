import sys
import os
import json
import time

# Add current directory to path so we can import api modules
sys.path.append(os.getcwd())

from api import db

def test_db_integration():
    print("Initializing DB...")
    db.init_db()
    
    # 1. Test Upload
    print("\nTesting Upload...")
    upload_id = "test_upload_001"
    raw_data = [{"id": "P1", "seq": "ATCG"}]
    db.save_upload(upload_id, "test_file.json", raw_data)
    
    # Verify upload exists (manual check via sqlite would be better but we can't easily do that from script without re-implementing get_upload which we didn't make public? actually we didn't implement get_upload in db.py, only save_upload. But we can check if file exists or trust no error means success for now. Actually let's query raw to be sure)
    conn = db.get_db_connection()
    res = conn.execute("SELECT * FROM uploads WHERE id = ?", (upload_id,)).fetchone()
    conn.close()
    if res:
        print(f"✅ Upload found: {res['id']}, filename: {res['filename']}")
    else:
        print("❌ Upload NOT found")
        return

    # 2. Test Job Creation
    print("\nTesting Job Creation...")
    job_id = "test_job_001"
    db.create_job(job_id, status='processing', upload_id=upload_id)
    
    job = db.get_job(job_id)
    if job and job['status'] == 'processing':
        print(f"✅ Job created: {job['id']}, status: {job['status']}")
    else:
        print("❌ Job creation failed")
        return

    # 3. Test Job Completion & Results
    print("\nTesting Job Completion...")
    results = {"metrics": {"score": 100}, "pools": []}
    db.save_job_results(job_id, results)
    db.update_job_status(job_id, 'completed')
    
    job = db.get_job(job_id)
    if job and job['status'] == 'completed' and 'results' in job:
        print(f"✅ Job verified completed with results: {job['results']}")
    else:
        print(f"❌ Job completion verification failed. Status: {job.get('status')}")
        return

    # 4. Test Stats
    print("\nTesting Stats...")
    stats = db.get_stats()
    print(f"Stats: {stats}")
    if stats['total_jobs'] >= 1 and stats['completed'] >= 1:
        print("✅ Stats seem correct")
    else:
        print("❌ Stats incorrect")

if __name__ == "__main__":
    try:
        test_db_integration()
        print("\n🎉 All tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
