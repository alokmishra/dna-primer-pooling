
import sys
import os
import time
import numpy as np
import pandas as pd

# Add current directory to path
sys.path.append(os.getcwd())

from backend.api.core_optimizer import fast_analyze_upload, quick_analyze

def generate_dummy_primers(n=500):
    primers = []
    bases = ['A', 'C', 'G', 'T']
    for i in range(n):
        # Generate random 20bp sequences
        fwd = "".join(np.random.choice(bases, 20))
        rev = "".join(np.random.choice(bases, 20))
        primers.append({
            "id": f"P{i}",
            "gene": f"Gene{i}",
            "forward": fwd,
            "reverse": rev
        })
    return primers

def benchmark():
    print("Generating 500 dummy primers...")
    primers = generate_dummy_primers(500)
    
    print("\n--- Benchmarking ---")
    
    # Test New Method
    start = time.time()
    res_fast = fast_analyze_upload(primers)
    end = time.time()
    print(f"New `fast_analyze_upload`: {end - start:.4f} seconds")
    print(f"Stats: {res_fast['metrics']['avg_tm_per_pool']}")

    # Test Old Method
    print("\nRunning old `quick_analyze` (this might take a while)...")
    start = time.time()
    # reduce iterations to 10 for speed, but build_dimer_matrix will still run
    # Note: quick_analyze hardcodes 100 iterations, so we rely on that
    res_slow = quick_analyze(primers) 
    end = time.time()
    print(f"Old `quick_analyze`: {end - start:.4f} seconds")

if __name__ == "__main__":
    benchmark()
