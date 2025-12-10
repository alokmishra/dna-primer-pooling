# DNA Primer Pooling Optimizer

A high-performance algorithmic tool for multiplex PCR primer pooling. This software automates the grouping of DNA primers into compatible pools to minimize dimer formation and ensure uniform melting temperatures (Tm).

## 🚀 Key Features

-   **High-Performance Backend**: Built with Python (FastAPI) + NumPy + Numba for fast matrix operations.
-   **Intelligent Optimization**: Uses Differential Evolution to solve the combinatorially complex pooling problem.
-   **Fast Stats Analysis**: Real-time feedback on file uploads using O(N log N) statistical binning.
-   **Interactive UI**: Modern React + Ant Design frontend with real-time progress tracking and visualization.
-   **Scalable**: Capable of handling hundreds of primers with parallel processing.

## 🛠️ Architecture

### Frontend (`/frontend`)
-   **Framework**: Next.js (React)
-   **UI Library**: Ant Design (antd)
-   **State Management**: React Hooks
-   **Data Visualization**: Custom tables and charts for pool metrics.

### Backend (`/backend`)
-   **API Framework**: FastAPI (Async)
-   **Core Math**: NumPy (Vectorized operations)
-   **JIT Compilation**: Numba (Accelerated pairwise scoring)
-   **Database**: SQLite (Job tracking and result persistence)

## 🧠 Core Algorithms & Logic

### 1. Primer Encoding
DNA sequences are encoded into numerical arrays for rapid processing:
-   `A=0`, `C=1`, `G=2`, `T=3`
-   This allows the system to use fast integer arithmetic instead of slow string comparisons during scoring.

### 2. Dimer Interaction Scoring (The "Expensive" Part)
The core challenge is calculating how likely any two primers are to bind to each other (dimers).
-   **Algorithm**: Needleman-Wunsch-style alignment / Sliding window overlap.
-   **Optimization**: 
    -   We use `Numba` to compile the scoring function to machine code.
    -   We compare **Forward-Forward**, **Reverse-Reverse**, **Forward-Reverse**, and **Reverse-Forward** combinations for every pair.
    -   **Parallelization**: `ProcessPoolExecutor` calculates the O(N²) interaction matrix in parallel chunks.

### 3. Differential Evolution (The Solver)
Assigning primers to `K` pools is a combinatorial optimization problem. We use **Differential Evolution** (a genetic algorithm approach):
-   **Genome**: A continuous vector of weights (size `N * K`).
-   **Decoding**: `argmax` of weights determines the pool assignment.
-   **Cost Function**:
    1.  **Dimer Penalty**: Sum of interaction scores for all primers *in the same pool*.
    2.  **Tm Penalty**: Variance of melting temperatures within a pool (tight Tm range needed for PCR).
    3.  **Balance Penalty**: Variance in pool sizes (we want equal-sized pools).
    4.  **Constraint Penalty**: Huge penalty if a pool exceeds `max_primers_per_pool`.

### 4. Fast Stats (Upload Optimization)
To ensure the UI is responsive immediately after uploading a 500+ line file:
-   We **skip** the O(N²) dimer matrix calculation initially.
-   We run a **O(N log N) "Binning" strategy**:
    1.  Calculate Tm for all primers.
    2.  Sort primers by Tm.
    3.  Distribute evenly into pools.
-   This provides instant visual feedback (< 50ms) before the user commits to the full optimization run (> 60s).

## 📋 Usage

### Prerequisites
- Python 3.10+
- Node.js 18+

### Setup

1.  **Backend**
    ```bash
    cd backend
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    python run_api.py
    ```

2.  **Frontend**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

3.  Open `http://localhost:3000`

## 📁 Project Structure

```
├── backend/
│   ├── api/
│   │   ├── core_optimizer.py  # The heavy lifting (bit encoding, numba, optimization)
│   │   ├── fapi.py            # FastAPI endpoints
│   │   └── db.py              # SQLite job storage
│   └── run_api.py             # Entry point
│
└── frontend/
    └── src/
        ├── components/        # React UI components (PrimerUpload, OptimizationPanel)
        └── lib/               # API clients
```
