# core_optimizer.py
import numpy as np
import pandas as pd
from typing import List, Tuple, Dict
import numba
from Bio.SeqUtils import MeltingTemp as mt
import pickle
from dataclasses import dataclass
import logging
from scipy.optimize import differential_evolution
from sklearn.preprocessing import StandardScaler
from concurrent.futures import ProcessPoolExecutor
import multiprocessing as mp

@dataclass
class Primer:
    id: str
    gene: str
    forward: str
    reverse: str
    forward_tm: float = 0.0
    reverse_tm: float = 0.0
    gc_content: float = 0.0
    length: int = 0

class PrimerPoolOptimizer:
    """High-performance primer pool optimization using Numpy"""
    
    def __init__(self, n_workers: int = None):
        self.n_workers = n_workers or max(1, mp.cpu_count() - 1)
        self.logger = logging.getLogger(__name__)
        self.reset()
    
    def reset(self):
        """Reset optimizer state"""
        self.primers = []
        self.primer_array = None  # Encoded primer sequences
        self.tm_matrix = None  # Tm values matrix
        self.dimer_matrix = None  # Dimer scores
        self.compatibility_matrix = None
        self.feature_matrix = None
        self.n_primers = 0
    
    def load_primers(self, primers_data: List[Dict]):
        """Load primers from data"""
        self.primers = []
        for data in primers_data:
            primer = Primer(
                id=data.get('id', f"P{len(self.primers)+1}"),
                gene=data.get('gene', ''),
                forward=data['forward'].upper(),
                reverse=data['reverse'].upper()
            )
            primer.length = len(primer.forward)
            primer.gc_content = self._calculate_gc(primer.forward + primer.reverse)
            self.primers.append(primer)
        
        self.n_primers = len(self.primers)
        self._encode_sequences()
        self._calculate_tm_matrix()
    
    def _encode_sequences(self):
        """Encode DNA sequences to numerical arrays for fast computation"""
        # Encode as 2D array: [primer_index, position, (forward/reverse, base)]
        max_len = max(len(p.forward) for p in self.primers)
        max_len = max(max_len, max(len(p.reverse) for p in self.primers))
        
        # One-hot encoding: A=0, C=1, G=2, T=3
        self.primer_array = np.zeros((self.n_primers, 2, max_len), dtype=np.int8)
        
        base_map = {'A': 0, 'C': 1, 'G': 2, 'T': 3}
        
        for i, primer in enumerate(self.primers):
            # Encode forward primer
            for j, base in enumerate(primer.forward):
                self.primer_array[i, 0, j] = base_map.get(base, -1)
            # Encode reverse primer
            for j, base in enumerate(primer.reverse):
                self.primer_array[i, 1, j] = base_map.get(base, -1)
    
    @staticmethod
    @numba.jit(nopython=True, parallel=True, cache=True)
    def _calculate_dimer_score_numba(seq1, seq2):
        """Numba-accelerated dimer score calculation"""
        len1, len2 = len(seq1), len(seq2)
        max_score = 0
        
        # Score matrix: matches get positive, mismatches negative
        score_matrix = np.array([
            [2, -1, -1, -1],  # A with A, C, G, T
            [-1, 3, -1, -1],  # C
            [-1, -1, 3, 1],   # G (G-T wobble = 1)
            [-1, -1, 1, 2]    # T
        ])
        
        # Check all possible overlaps
        for offset in range(-len2 + 1, len1):
            score = 0
            consecutive = 0
            max_consecutive = 0
            
            for k in range(max(len1, len2)):
                idx1 = k if offset >= 0 else k - offset
                idx2 = k + offset if offset >= 0 else k
                
                if 0 <= idx1 < len1 and 0 <= idx2 < len2:
                    b1 = seq1[idx1]
                    b2 = seq2[idx2]
                    
                    if b1 >= 0 and b2 >= 0:  # Valid bases
                        s = score_matrix[b1, b2]
                        if s > 0:
                            consecutive += 1
                            score += s * (1 + 0.1 * consecutive)  # Reward consecutive matches
                        else:
                            consecutive = 0
                            score += s
                        max_consecutive = max(max_consecutive, consecutive)
                    else:
                        consecutive = 0
                        score -= 0.5
                
                # Early termination
                if k > 20 and score < -10:
                    break
            
            # Apply penalties/bonuses
            if max_consecutive >= 4:
                score *= 1.2  # Bonus for long consecutive matches
            elif max_consecutive < 3:
                score *= 0.5  # Penalty for short matches
            
            max_score = max(max_score, score)
        
        return max_score
    
    def build_dimer_matrix(self):
        """Build complete dimer interaction matrix using parallel processing"""
        self.logger.info(f"Building dimer matrix for {self.n_primers} primers...")
        
        # Prepare sequence arrays
        forward_seqs = [self.primer_array[i, 0] for i in range(self.n_primers)]
        reverse_seqs = [self.primer_array[i, 1] for i in range(self.n_primers)]
        
        # Initialize matrices
        ff_matrix = np.zeros((self.n_primers, self.n_primers))
        rr_matrix = np.zeros((self.n_primers, self.n_primers))
        fr_matrix = np.zeros((self.n_primers, self.n_primers))
        rf_matrix = np.zeros((self.n_primers, self.n_primers))
        
        # Calculate in parallel
        with ProcessPoolExecutor(max_workers=self.n_workers) as executor:
            # Prepare tasks
            tasks = []
            for i in range(self.n_primers):
                for j in range(i, self.n_primers):
                    tasks.append((i, j, forward_seqs[i], forward_seqs[j], 'ff'))
                    tasks.append((i, j, reverse_seqs[i], reverse_seqs[j], 'rr'))
                    tasks.append((i, j, forward_seqs[i], reverse_seqs[j], 'fr'))
                    if i != j:
                        tasks.append((i, j, reverse_seqs[i], forward_seqs[j], 'rf'))
            
            # Process tasks
            futures = []
            for i, j, seq1, seq2, matrix_type in tasks:
                future = executor.submit(self._calculate_dimer_score_numba, seq1, seq2)
                futures.append((i, j, matrix_type, future))
            
            # Collect results
            for i, j, matrix_type, future in futures:
                score = future.result()
                if matrix_type == 'ff':
                    ff_matrix[i, j] = ff_matrix[j, i] = score
                elif matrix_type == 'rr':
                    rr_matrix[i, j] = rr_matrix[j, i] = score
                elif matrix_type == 'fr':
                    fr_matrix[i, j] = score
                elif matrix_type == 'rf':
                    rf_matrix[i, j] = score
        
        # Combine matrices
        self.dimer_matrix = np.stack([ff_matrix, rr_matrix, fr_matrix, rf_matrix], axis=-1)
        
        # Calculate overall compatibility
        self.compatibility_matrix = np.sum(self.dimer_matrix, axis=-1)
        
        self.logger.info("Dimer matrix calculation complete")
    
    def _calculate_tm_matrix(self):
        """Calculate melting temperatures"""
        self.tm_matrix = np.zeros((self.n_primers, 2))
        for i, primer in enumerate(self.primers):
            try:
                self.tm_matrix[i, 0] = mt.Tm_NN(primer.forward)
                self.tm_matrix[i, 1] = mt.Tm_NN(primer.reverse)
            except:
                # Fallback calculation
                self.tm_matrix[i, 0] = self._simple_tm(primer.forward)
                self.tm_matrix[i, 1] = self._simple_tm(primer.reverse)
    
    @staticmethod
    def _simple_tm(seq):
        """Simple Tm calculation for fallback"""
        gc_count = seq.count('G') + seq.count('C')
        return 64.9 + 41 * (gc_count - 16.4) / len(seq)
    
    @staticmethod
    def _calculate_gc(seq):
        """Calculate GC content"""
        gc = seq.count('G') + seq.count('C')
        return gc / len(seq) * 100
    
    def optimize_pools(self, n_pools: int = 4, 
                      max_iterations: int = 1000,
                      **kwargs) -> Dict:
        """Optimize primer assignment to pools using differential evolution"""
        
        self.logger.info(f"Optimizing {self.n_primers} primers into {n_pools} pools")
        
        # Prepare feature matrix for optimization
        self._prepare_features()
        
        # Use differential evolution for global optimization
        bounds = [(0, 1)] * (self.n_primers * n_pools)
        
        # Extract parameters for worker function
        max_primers_per_pool = kwargs.get('max_primers_per_pool', 50)
        
        result = differential_evolution(
            self._evaluate_assignment,
            bounds,
            args=(n_pools, max_primers_per_pool),
            maxiter=max_iterations,
            popsize=min(50, self.n_primers * 2),
            disp=False,
            workers=self.n_workers,
            updating='deferred'
        )
        
        # Decode best solution
        best_assignment = self._decode_solution(result.x, n_pools)
        
        # Calculate metrics
        metrics = self._calculate_metrics(best_assignment, n_pools)
        
        return {
            'assignment': best_assignment,
            'metrics': metrics,
            'pools': self._create_pools(best_assignment, n_pools),
            'optimization_score': result.fun
        }
    
    def _prepare_features(self):
        """Prepare feature matrix for optimization"""
        # Combine various features
        features = []
        
        # Tm features
        features.append(self.tm_matrix[:, 0])  # Forward Tm
        features.append(self.tm_matrix[:, 1])  # Reverse Tm
        features.append(np.abs(self.tm_matrix[:, 0] - self.tm_matrix[:, 1]))  # Tm difference
        
        # GC content
        gc_array = np.array([p.gc_content for p in self.primers])
        features.append(gc_array)
        
        # Length
        length_array = np.array([p.length for p in self.primers])
        features.append(length_array)
        
        # Compatibility features (average with others)
        avg_compatibility = np.mean(self.compatibility_matrix, axis=1)
        features.append(avg_compatibility)
        
        self.feature_matrix = np.column_stack(features)
        
        # Normalize features
        self.scaler = StandardScaler()
        self.feature_matrix = self.scaler.fit_transform(self.feature_matrix)
    
    def _evaluate_assignment(self, weights, n_pools, max_primers_per_pool=50):
        """Evaluate assignment quality (lower is better)"""
        assignment = self._decode_solution(weights, n_pools)
        
        # Initialize score
        score = 0
        
        # 1. Intra-pool dimer penalty
        for pool in range(n_pools):
            pool_indices = np.where(assignment == pool)[0]
            if len(pool_indices) > 1:
                # Calculate total dimer score within pool
                for i in range(len(pool_indices)):
                    for j in range(i + 1, len(pool_indices)):
                        idx1, idx2 = pool_indices[i], pool_indices[j]
                        score += np.sum(self.dimer_matrix[idx1, idx2]) * 2.0
        
        # 2. Tm compatibility penalty
        for pool in range(n_pools):
            pool_indices = np.where(assignment == pool)[0]
            if len(pool_indices) > 0:
                pool_tms = self.tm_matrix[pool_indices].flatten()
                tm_range = np.ptp(pool_tms)
                if tm_range > 5:  # Penalize large Tm ranges
                    score += (tm_range - 5) * 10
        
        # 3. Pool size balance penalty
        pool_sizes = [np.sum(assignment == p) for p in range(n_pools)]
        size_variance = np.var(pool_sizes)
        score += size_variance * 5
        
        # 4. Maximum pool size constraint
        for size in pool_sizes:
            if size > max_primers_per_pool:
                score += (size - max_primers_per_pool) * 100
        
        return score
    
    def _decode_solution(self, weights, n_pools):
        """Decode continuous weights to discrete pool assignments"""
        weights = weights.reshape(self.n_primers, n_pools)
        return np.argmax(weights, axis=1)
    
    def _calculate_metrics(self, assignment, n_pools):
        """Calculate optimization metrics"""
        metrics = {
            'pool_sizes': [],
            'avg_tm_per_pool': [],
            'max_dimer_per_pool': [],
            'tm_range_per_pool': [],
            'overall_score': 0
        }
        
        for pool in range(n_pools):
            pool_indices = np.where(assignment == pool)[0]
            metrics['pool_sizes'].append(len(pool_indices))
            
            if len(pool_indices) > 0:
                # Tm statistics
                pool_tms = self.tm_matrix[pool_indices].flatten()
                metrics['avg_tm_per_pool'].append(np.mean(pool_tms))
                metrics['tm_range_per_pool'].append(np.ptp(pool_tms))
                
                # Dimer statistics
                if len(pool_indices) > 1:
                    max_dimer = 0
                    for i in range(len(pool_indices)):
                        for j in range(i + 1, len(pool_indices)):
                            idx1, idx2 = pool_indices[i], pool_indices[j]
                            max_dimer = max(max_dimer, np.max(self.dimer_matrix[idx1, idx2]))
                    metrics['max_dimer_per_pool'].append(max_dimer)
                else:
                    metrics['max_dimer_per_pool'].append(0)
        
        return metrics
    
    def _create_pools(self, assignment, n_pools):
        """Create organized pool data"""
        pools = []
        for pool in range(n_pools):
            pool_indices = np.where(assignment == pool)[0]
            pool_data = []
            
            for idx in pool_indices:
                primer = self.primers[idx]
                pool_data.append({
                    'id': primer.id,
                    'gene': primer.gene,
                    'forward': primer.forward,
                    'reverse': primer.reverse,
                    'forward_tm': float(self.tm_matrix[idx, 0]),
                    'reverse_tm': float(self.tm_matrix[idx, 1]),
                    'avg_tm': float(np.mean(self.tm_matrix[idx])),
                    'gc_content': float(primer.gc_content),
                    'compatibility_score': float(np.mean(self.compatibility_matrix[idx]))
                })
            
            # Sort by compatibility score (most compatible first)
            pool_data.sort(key=lambda x: x['compatibility_score'])
            pools.append(pool_data)
        
        return pools
    
    def save_results(self, results: Dict, filename: str):
        """Save optimization results"""
        import json
        
        # Convert to JSON serializable format
        serializable = {
            'assignment': results['assignment'].tolist(),
            'metrics': results['metrics'],
            'optimization_score': float(results['optimization_score']),
            'n_pools': len(results['pools']),
            'pools': results['pools']
        }
        
        with open(filename, 'w') as f:
            json.dump(serializable, f, indent=2)
        
        # Also save as CSV
        self._save_to_csv(results, filename.replace('.json', '.csv'))
    
    def _save_to_csv(self, results: Dict, filename: str):
        """Save results to CSV format"""
        all_data = []
        for pool_idx, pool_data in enumerate(results['pools']):
            for primer in pool_data:
                primer['pool'] = pool_idx + 1
                all_data.append(primer)
        
        df = pd.DataFrame(all_data)
        df.to_csv(filename, index=False)

    def simple_bin_optimization(self, n_pools: int = 4) -> Dict:
        """
        Fast 'binning' optimization for initial upload view.
        Sorts by Tm and chunks into pools. O(N log N).
        Skips dimer checks.
        """
        self.logger.info(f"Running simple bin optimization for {self.n_primers} primers")
        
        # 1. Get average Tm for each primer
        tms = np.mean(self.tm_matrix, axis=1)
        
        # 2. Sort indices by Tm
        sorted_indices = np.argsort(tms)
        
        # 3. Assign to pools (chunking to minimize Tm spread)
        assignment = np.zeros(self.n_primers, dtype=int)
        chunk_size = int(np.ceil(self.n_primers / n_pools))
        
        for i in range(self.n_primers):
            # Safe chunk assignment
            pool_idx = i // chunk_size
            if pool_idx >= n_pools:
                pool_idx = n_pools - 1
            idx = sorted_indices[i]
            assignment[idx] = pool_idx
            
        # 4. Calculate basic metrics (skip dimer scores)
        metrics = {
            'pool_sizes': [],
            'avg_tm_per_pool': [],
            'max_dimer_per_pool': [],
            'tm_range_per_pool': [],
            'overall_score': 0
        }
        
        for pool in range(n_pools):
            pool_indices = np.where(assignment == pool)[0]
            metrics['pool_sizes'].append(len(pool_indices))
            
            if len(pool_indices) > 0:
                pool_tms = self.tm_matrix[pool_indices].flatten()
                metrics['avg_tm_per_pool'].append(float(np.mean(pool_tms)))
                metrics['tm_range_per_pool'].append(float(np.ptp(pool_tms)))
            else:
                metrics['avg_tm_per_pool'].append(0.0)
                metrics['tm_range_per_pool'].append(0.0)
                
            # We didn't calc dimer matrix, so return 0
            metrics['max_dimer_per_pool'].append(0.0)
            
        return {
            'assignment': assignment,
            'metrics': metrics,
            'pools': self._create_pools_fast(assignment, n_pools), # Use fast version
            'optimization_score': 0
        }

    def _create_pools_fast(self, assignment, n_pools):
        """Create pool data without compatibility scores"""
        pools = []
        for pool in range(n_pools):
            pool_indices = np.where(assignment == pool)[0]
            pool_data = []
            
            for idx in pool_indices:
                primer = self.primers[idx]
                pool_data.append({
                    'id': primer.id,
                    'gene': primer.gene,
                    'forward': primer.forward,
                    'reverse': primer.reverse,
                    'forward_tm': float(self.tm_matrix[idx, 0]),
                    'reverse_tm': float(self.tm_matrix[idx, 1]),
                    'avg_tm': float(np.mean(self.tm_matrix[idx])),
                    'gc_content': float(primer.gc_content),
                    'compatibility_score': 0.0 # Not calculated
                })
            
            pools.append(pool_data)
        
        return pools

# Fast analysis for upload
def fast_analyze_upload(primers_data: List[Dict], n_pools: int = 4) -> Dict:
    """
    Extremely fast analysis for file uploads.
    Does NOT calculate dimer matrix.
    """
    optimizer = PrimerPoolOptimizer()
    optimizer.load_primers(primers_data)
    # Skip build_dimer_matrix()
    return optimizer.simple_bin_optimization(n_pools=n_pools)

# Legacy quick analysis (still useful for small sets if needed, but we replace usage in upload)
def quick_analyze(primers_data: List[Dict], n_pools: int = 4) -> Dict:
    """Quick analysis without full optimization"""
    optimizer = PrimerPoolOptimizer()
    optimizer.load_primers(primers_data)
    optimizer.build_dimer_matrix()
    return optimizer.optimize_pools(n_pools=n_pools, max_iterations=100)
