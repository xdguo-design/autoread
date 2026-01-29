import requests
import time
import sys

BASE_URL = "http://localhost:8000"

def test_workflow():
    print("Starting E2E Test...")
    
    # 1. Health Check
    try:
        resp = requests.get(f"{BASE_URL}/health")
        if resp.status_code != 200:
            print("Health check failed")
            return False
        print("Health check passed")
    except Exception as e:
        print(f"Server not reachable: {e}")
        return False

    # 2. Submit Task
    # Use a simple, static URL to avoid complex scraping issues during test
    test_url = "https://example.com" 
    print(f"Submitting task for {test_url}...")
    
    try:
        resp = requests.post(f"{BASE_URL}/api/process", json={"url": test_url})
        if resp.status_code != 200:
            print(f"Task submission failed: {resp.text}")
            return False
        
        data = resp.json()
        task_id = data.get("task_id")
        print(f"Task submitted. ID: {task_id}")
    except Exception as e:
        print(f"Submission error: {e}")
        return False
        
    # 3. Poll Status
    print("Polling status...")
    max_retries = 60 # 2 minutes timeout
    for i in range(max_retries):
        try:
            resp = requests.get(f"{BASE_URL}/api/status/{task_id}")
            status_data = resp.json()
            status = status_data["status"]
            progress = status_data["progress"]
            message = status_data["message"]
            
            print(f"[{i+1}/{max_retries}] Status: {status}, Progress: {progress}%, Message: {message}")
            
            if status == "completed":
                print("Task completed successfully!")
                print(f"Article available: {status_data['has_article']}")
                print(f"Video available: {status_data['has_video']}")
                
                source_md = requests.get(f"{BASE_URL}/api/task/{task_id}/markdown/source")
                article_md = requests.get(f"{BASE_URL}/api/task/{task_id}/markdown/article")
                assets = requests.get(f"{BASE_URL}/api/task/{task_id}/assets")
                
                if source_md.status_code != 200:
                    print(f"Source markdown fetch failed: {source_md.status_code} {source_md.text}")
                    return False
                if article_md.status_code != 200:
                    print(f"Article markdown fetch failed: {article_md.status_code} {article_md.text}")
                    return False
                if assets.status_code != 200:
                    print(f"Assets fetch failed: {assets.status_code} {assets.text}")
                    return False
                
                assets_json = assets.json()
                print(f"Assets: images={len(assets_json.get('images', []))}, screenshots={len(assets_json.get('screenshots', []))}")
                return True
            elif status == "failed":
                print(f"Task failed: {message}")
                return False
                
            time.sleep(2)
        except Exception as e:
            print(f"Polling error: {e}")
            return False
            
    print("Test timed out")
    return False

if __name__ == "__main__":
    success = test_workflow()
    if success:
        sys.exit(0)
    else:
        sys.exit(1)
