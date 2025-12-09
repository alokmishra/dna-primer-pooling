import random

def generate_primer(length=20):
    """Generate a random DNA primer of specified length"""
    bases = ['A', 'T', 'C', 'G']
    primer = ''.join(random.choice(bases) for _ in range(length))
    return primer

def calculate_tm(primer):
    """Simple Tm calculation (Wallace rule) for primers ~20bp"""
    # Count bases
    a_count = primer.count('A')
    t_count = primer.count('T')
    c_count = primer.count('C')
    g_count = primer.count('G')
    
    # Simple Tm calculation: 2°C for AT pairs, 4°C for GC pairs
    tm = 2*(a_count + t_count) + 4*(c_count + g_count)
    return tm

def generate_reverse_complement(primer):
    """Generate reverse complement of a DNA sequence"""
    complement = {'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C'}
    rev_comp = ''.join(complement[base] for base in reversed(primer))
    return rev_comp

def check_primer_quality(primer):
    """Check basic primer quality metrics"""
    # Check GC content
    gc_content = (primer.count('G') + primer.count('C')) / len(primer) * 100
    
    # Check for long mononucleotide repeats
    max_repeat = 1
    current_repeat = 1
    for i in range(1, len(primer)):
        if primer[i] == primer[i-1]:
            current_repeat += 1
            max_repeat = max(max_repeat, current_repeat)
        else:
            current_repeat = 1
    
    return gc_content, max_repeat

# Generate 500 primer pairs
primer_pairs = []
for i in range(1, 501):
    # Generate forward primer
    while True:
        forward_primer = generate_primer(random.randint(18, 25))
        gc_content, max_repeat = check_primer_quality(forward_primer)
        tm = calculate_tm(forward_primer)
        
        # Quality filters
        if 40 <= gc_content <= 60 and max_repeat <= 4 and 50 <= tm <= 65:
            break
    
    # Generate reverse primer
    while True:
        reverse_primer = generate_primer(random.randint(18, 25))
        gc_content, max_repeat = check_primer_quality(reverse_primer)
        tm = calculate_tm(reverse_primer)
        
        # Quality filters
        if 40 <= gc_content <= 60 and max_repeat <= 4 and 50 <= tm <= 65:
            break
    
    primer_pairs.append({
        'pair_id': i,
        'forward': forward_primer,
        'reverse': reverse_primer,
        'forward_tm': calculate_tm(forward_primer),
        'reverse_tm': calculate_tm(reverse_primer),
        'forward_gc': (forward_primer.count('G') + forward_primer.count('C')) / len(forward_primer) * 100,
        'reverse_gc': (reverse_primer.count('G') + reverse_primer.count('C')) / len(reverse_primer) * 100
    })

# Write to file
with open('primer_pairs.txt', 'w') as f:
    f.write("PRIMER PAIRS DATABASE (500 pairs)\n")
    f.write("=" * 60 + "\n\n")
    
    for pair in primer_pairs:
        f.write(f"Pair #{pair['pair_id']:03d}\n")
        f.write(f"Forward: 5'-{pair['forward']}-3'\n")
        f.write(f"Reverse: 5'-{pair['reverse']}-3'\n")
        f.write(f"Tm: {pair['forward_tm']:.1f}°C (F), {pair['reverse_tm']:.1f}°C (R)\n")
        f.write(f"GC%: {pair['forward_gc']:.1f}% (F), {pair['reverse_gc']:.1f}% (R)\n")
        f.write("-" * 40 + "\n\n")

# Also create a CSV version for easier analysis
with open('primer_pairs.csv', 'w') as f:
    f.write("PairID,ForwardPrimer,ReversePrimer,ForwardTm,ReverseTm,ForwardGC,ReverseGC\n")
    for pair in primer_pairs:
        f.write(f"{pair['pair_id']},{pair['forward']},{pair['reverse']},{pair['forward_tm']},{pair['reverse_tm']},{pair['forward_gc']:.1f},{pair['reverse_gc']:.1f}\n")

# Create a FASTA format file
with open('primer_pairs.fasta', 'w') as f:
    for pair in primer_pairs:
        f.write(f">Pair_{pair['pair_id']:03d}_Forward\n")
        f.write(f"{pair['forward']}\n")
        f.write(f">Pair_{pair['pair_id']:03d}_Reverse\n")
        f.write(f"{pair['reverse']}\n")

print("Generated files:")
print("1. primer_pairs.txt - Human readable format with details")
print("2. primer_pairs.csv - CSV format for spreadsheet import")
print("3. primer_pairs.fasta - FASTA format for sequence analysis")
print(f"\nTotal: {len(primer_pairs)} primer pairs generated")
print(f"Primer length range: 18-25 bp")
print(f"Tm range: 50-65°C")
print(f"GC content: 40-60%")

# Show first 5 pairs as example
print("\n\nFirst 5 primer pairs (example):")
print("=" * 50)
for i in range(5):
    pair = primer_pairs[i]
    print(f"\nPair #{pair['pair_id']}:")
    print(f"Forward: 5'-{pair['forward']}-3'")
    print(f"Reverse: 5'-{pair['reverse']}-3'")
    print(f"Tm: {pair['forward_tm']}°C / {pair['reverse_tm']}°C")
    print(f"GC: {pair['forward_gc']:.1f}% / {pair['reverse_gc']:.1f}%")