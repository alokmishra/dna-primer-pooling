# api/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import pandas as pd
import numpy as np
import json
import asyncio
from concurrent.futures import ProcessPoolExecutor
import tempfile
import os

from .core_optimizer import PrimerPoolOptimizer, quick_analyze

app = FastAPI(
    title="Primer Pool Optimizer API",
    description="High-performance primer pool optimization for multiplex PCR",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class PrimerInput(BaseModel):
    id: str
    gene: str
    forward: str
    reverse: str

class OptimizationRequest(BaseModel):
    primers: List[PrimerInput]
    n_pools: int = 4
    max_primers_per_pool: Optional[int] = None
    max_iterations: int = 500

class OptimizationResponse(BaseModel):
    status: str
    job_id: str
    message: str

class ResultResponse(BaseModel):
    status: str
    results: Optional[Dict] = None
    error: Optional[str] = None

# Store jobs in memory (use Redis in production)
jobs = {}

@app.get("/")
async def root():
    return {"message": "Primer Pool Optimizer API", "version": "2.0.0"}

@app.post("/api/analyze", response_model=OptimizationResponse)
async def analyze_primers(request: OptimizationRequest):
    """Analyze primers and optimize pools"""
    job_id = f"job_{len(jobs)}_{np.random.randint(1000, 9999)}"
    
    # Convert to dict list
    primers_data = [p.dict() for p in request.primers]
    
    # Start analysis in background
    jobs[job_id] = {
        'status': 'processing',
        'request': request.dict(),
        'results': None,
        'error': None
    }
    
    # Run analysis in background
    asyncio.create_task(run_analysis(job_id, primers_data, request.n_pools, request.max_iterations))
    
    return OptimizationResponse(
        status="processing",
        job_id=job_id,
        message=f"Started analysis of {len(primers_data)} primers"
    )

def make_serializable(obj):
    """Convert numpy types to python native types for JSON serialization"""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: make_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_serializable(item) for item in obj]
    return obj

async def run_analysis(job_id: str, primers_data: List[Dict], n_pools: int, max_iterations: int):
    """Run analysis in background"""
    try:
        optimizer = PrimerPoolOptimizer()
        optimizer.load_primers(primers_data)
        optimizer.build_dimer_matrix()
        results = optimizer.optimize_pools(n_pools=n_pools, max_iterations=max_iterations)
        
        # Save results
        # optimizer.save_results(results, f"results/{job_id}.json")
        
        # Make serializable
        clean_results = make_serializable(results)
        
        jobs[job_id]['status'] = 'completed'
        jobs[job_id]['results'] = clean_results
        jobs[job_id]['completed_at'] = pd.Timestamp.now().isoformat()
        
    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['error'] = str(e)

@app.post("/api/upload")
async def upload_primers(primers: List[PrimerInput]):
    """Upload primers (JSON list)"""
    try:
        # Convert Pydantic models to dicts
        primers_data = [p.dict() for p in primers]
        
        # Quick analysis
        results = quick_analyze(primers_data[:50])  # Limit for quick analysis
        
        return {
            "status": "success",
            "primers_loaded": len(primers),
            "quick_analysis": results['metrics'],
            "primers": primers_data[:10]  # Return first 10 for preview
        }
        
    except Exception as e:
        raise HTTPException(500, f"Processing error: {str(e)}")

@app.get("/api/results/{job_id}")
async def get_results(job_id: str):
    """Get analysis results"""
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    
    job = jobs[job_id]
    if job['status'] == 'processing':
        return ResultResponse(status="processing", results=None)
    elif job['status'] == 'error':
        return ResultResponse(status="error", results=None, error=job['error'])
    else:
        return ResultResponse(status="completed", results=job['results'])

@app.get("/api/stats")
async def get_stats():
    """Get API statistics"""
    total_jobs = len(jobs)
    completed = sum(1 for j in jobs.values() if j['status'] == 'completed')
    processing = sum(1 for j in jobs.values() if j['status'] == 'processing')
    
    return {
        "total_jobs": total_jobs,
        "completed": completed,
        "processing": processing,
        "uptime": "TODO"  # Add uptime tracking
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
