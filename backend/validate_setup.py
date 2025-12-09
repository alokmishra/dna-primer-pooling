
import sys
import os
import asyncio
import numpy as np

# Add the current directory to sys.path so we can import api modules
sys.path.append(os.path.join(os.getcwd(), 'api'))

def main():
    try:
        print("Importing core_optimizer...")
        from api.core_optimizer import PrimerPoolOptimizer, quick_analyze, Primer
        print("Import successful.")

        print("Importing fapi...")
        from api.fapi import app
        print("Import successful.")

        print("Running a quick analysis test...")
        # Create dummy data
        primers_data = [
            {"id": "P1", "gene": "G1", "forward": "ATCGATCGATCGATCG", "reverse": "GCTAGCTAGCTAGCTA"},
            {"id": "P2", "gene": "G2", "forward": "AAAAATTTTTCCCCCG", "reverse": "GGGGGCCCCCAAAAAT"},
            {"id": "P3", "gene": "G3", "forward": "ATATATATATATATAT", "reverse": "GCGCGCGCGCGCGCGC"},
            {"id": "P4", "gene": "G4", "forward": "CGCGCGCGCGCGCGCG", "reverse": "TATATATATATATATA"},
        ]
        
        # Test quick_analyze
        results = quick_analyze(primers_data, n_pools=2)
        print("Quick analysis results keys:", results.keys())
        
        if 'assignment' in results and 'metrics' in results:
            print("Validation passed!")
        else:
            print("Validation failed: Missing keys in results")
            sys.exit(1)

    except ImportError as e:
        print(f"ImportError: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
