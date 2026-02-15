#!/bin/bash
# Performance Regression Test Script
# Run this before/after major changes to detect performance regressions
#
# Usage: ./scripts/performance-test.sh
#
# Returns exit code 0 if all tests pass, 1 if any fail

set -e

echo "================================================"
echo "NYC Open Routing - Performance Regression Tests"
echo "================================================"
echo "Date: $(date)"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Performance thresholds (in seconds)
SIMPLE_ROUTE_THRESHOLD=0.5
COMPLEX_ROUTE_THRESHOLD=1.5
SEARCH_THRESHOLD=0.1
CONCURRENT_THRESHOLD=4.0

failures=0

# Test 1: Simple Route Performance
echo "Test 1: Simple Route (baseline: ~260ms)"
start=$(date +%s.%N)
response=$(curl -s "http://localhost:5001/api/route?orig=-74.0060,40.7128&dest=-73.9352,40.7306&mode=drive&use_traffic=false")
end=$(date +%s.%N)
duration=$(echo "$end - $start" | bc)
segments=$(echo "$response" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('features',[])))" 2>/dev/null || echo "0")

if (( $(echo "$duration < $SIMPLE_ROUTE_THRESHOLD" | bc -l) )); then
    echo -e "  ${GREEN}✓ PASS${NC}: ${duration}s (${segments} segments)"
else
    echo -e "  ${RED}✗ FAIL${NC}: ${duration}s - exceeds threshold ${SIMPLE_ROUTE_THRESHOLD}s"
    failures=$((failures + 1))
fi

# Test 2: Traffic Route Performance
echo ""
echo "Test 2: Traffic Route (baseline: ~930ms)"
start=$(date +%s.%N)
response=$(curl -s "http://localhost:5001/api/route?orig=-74.0060,40.7128&dest=-73.9352,40.7306&mode=drive&use_traffic=true")
end=$(date +%s.%N)
duration=$(echo "$end - $start" | bc)
factors=$(echo "$response" | python3 -c "import sys, json; d=json.load(sys.stdin); print(sorted(set([f['properties']['traffic_factor'] for f in d.get('features',[])])))" 2>/dev/null || echo "[]")

if (( $(echo "$duration < $COMPLEX_ROUTE_THRESHOLD" | bc -l) )); then
    echo -e "  ${GREEN}✓ PASS${NC}: ${duration}s (traffic factors: ${factors})"
else
    echo -e "  ${RED}✗ FAIL${NC}: ${duration}s - exceeds threshold ${COMPLEX_ROUTE_THRESHOLD}s"
    failures=$((failures + 1))
fi

# Test 3: Search Performance
echo ""
echo "Test 3: Address Search (baseline: ~40ms)"
start=$(date +%s.%N)
response=$(curl -s "http://localhost:5001/api/search?address=Broadway")
end=$(date +%s.%N)
duration=$(echo "$end - $start" | bc)
results=$(echo "$response" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('features',[])))" 2>/dev/null || echo "0")

if (( $(echo "$duration < $SEARCH_THRESHOLD" | bc -l) )); then
    echo -e "  ${GREEN}✓ PASS${NC}: ${duration}s (${results} results)"
else
    echo -e "  ${RED}✗ FAIL${NC}: ${duration}s - exceeds threshold ${SEARCH_THRESHOLD}s"
    failures=$((failures + 1))
fi

# Test 4: Turn Instructions Correctness
echo ""
echo "Test 4: Turn Instructions Correctness"
first_instruction=$(curl -s "http://localhost:5001/api/route?orig=-74.0060,40.7128&dest=-73.9352,40.7306&mode=drive" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('features',[])[0]['properties']['turn_instruction'])" 2>/dev/null || echo "ERROR")

if [[ "$first_instruction" == "Start" ]]; then
    echo -e "  ${GREEN}✓ PASS${NC}: First instruction is 'Start'"
else
    echo -e "  ${RED}✗ FAIL${NC}: First instruction is '${first_instruction}' (expected 'Start')"
    failures=$((failures + 1))
fi

# Test 5: Concurrent Load (10 requests)
echo ""
echo "Test 5: Concurrent Load - 10 Routes (baseline: ~3.5s)"
start=$(date +%s.%N)
for i in {1..10}; do
    curl -s "http://localhost:5001/api/route?orig=-74.0060,40.7128&dest=-73.9352,40.7306&mode=drive" > /dev/null &
done
wait
end=$(date +%s.%N)
duration=$(echo "$end - $start" | bc)

if (( $(echo "$duration < $CONCURRENT_THRESHOLD" | bc -l) )); then
    echo -e "  ${GREEN}✓ PASS${NC}: ${duration}s for 10 concurrent routes"
else
    echo -e "  ${RED}✗ FAIL${NC}: ${duration}s - exceeds threshold ${CONCURRENT_THRESHOLD}s"
    failures=$((failures + 1))
fi

# Test 6: Traffic Factors Vary
echo ""
echo "Test 6: Traffic Factors Vary (not all 1.0)"
factors=$(curl -s "http://localhost:5001/api/route?orig=-73.9584,40.7591&dest=-73.9440,40.7520&mode=drive&use_traffic=true" | python3 -c "import sys, json; d=json.load(sys.stdin); print(sorted(set([f['properties']['traffic_factor'] for f in d.get('features',[])])))" 2>/dev/null || echo "[]")

if [[ "$factors" == *"2.0"* ]] || [[ "$factors" == *"1.5"* ]]; then
    echo -e "  ${GREEN}✓ PASS${NC}: Traffic factors vary (${factors})"
else
    echo -e "  ${YELLOW}⚠ WARN${NC}: Only default factors found (${factors})"
    echo "  Note: This may be OK if route doesn't pass through traffic-monitored segments"
fi

# Summary
echo ""
echo "================================================"
if [ $failures -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo "================================================"
    exit 0
else
    echo -e "${RED}✗ ${failures} TEST(S) FAILED${NC}"
    echo "================================================"
    exit 1
fi
