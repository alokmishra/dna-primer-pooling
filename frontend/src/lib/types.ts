// lib/types.ts
export interface Primer {
    id: string;
    gene: string;
    forward: string;
    reverse: string;
    length?: number;
    notes?: string;
}

export interface OptimizationRequest {
    primers: Primer[];
    n_pools: number;
    max_primers_per_pool?: number;
    max_iterations?: number;
}

export interface OptimizationJob {
    job_id: string;
    status: 'processing' | 'completed' | 'error';
    message: string;
}

export interface PoolMetrics {
    pool_sizes: number[];
    avg_tm_per_pool: number[];
    max_dimer_per_pool: number[];
    tm_range_per_pool: number[];
    overall_score: number;
}

export interface PrimerResult {
    id: string;
    gene: string;
    forward: string;
    reverse: string;
    forward_tm: number;
    reverse_tm: number;
    avg_tm: number;
    gc_content: number;
    compatibility_score: number;
    pool: number;
}

export interface OptimizationResults {
    assignment: number[];
    metrics: PoolMetrics;
    pools: PrimerResult[][];
    optimization_score: number;
}

export interface UploadResponse {
    status: string;
    primers_loaded: number;
    quick_analysis: PoolMetrics;
    primers: Primer[];
}