# run_api.py
import uvicorn
import os

if __name__ == "__main__":
    # Create results directory
    os.makedirs("results", exist_ok=True)
    
    # Run the API
    uvicorn.run(
        "api.fapi:app",
        host="0.0.0.0",  # Accessible from network
        port=8000,
        reload=True,     # Auto-reload on code changes
        workers=1        # Start with 1 worker, increase for production
    )