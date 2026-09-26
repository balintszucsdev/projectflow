# ProjectFlow performance tests

Local performance-test tooling for ProjectFlow using Python and Locust.

The performance module supports read-only, mixed CRUD, and weighted CRUD workloads; baseline, load, stress, and staged capacity profiles; local resource monitoring; per-run reports; and automatic cleanup of performance-test data.

> Local results describe the current machine and Docker environment. They must not be interpreted as Azure production capacity.

## Location

The performance tooling lives at the repository root:

```text
projectflow/
├── backend/
├── frontend/
├── performance/
│   ├── locustfile.py
│   ├── read_only_workload.py
│   ├── mixed_workload.py
│   ├── weighted_workload.py
│   ├── performance_profiles.py
│   ├── run.py
│   ├── monitor.py
│   ├── seed.py
│   └── results/
└── docker-compose.yml
```

Run the commands below from:

```powershell
D:\source\projectflow\performance
```

## Prerequisites

Python 3.11+ is required. Docker Desktop must be running for the local ProjectFlow backend, PostgreSQL, and resource monitoring.

Create the virtual environment and install the dependencies:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

You can also activate the environment and use `python` directly:

```powershell
.\.venv\Scripts\Activate.ps1
```

## Start the local ProjectFlow stack

From the repository root:

```powershell
cd D:\source\projectflow

docker compose up -d postgres
docker compose run --rm migrate
docker compose up -d --build backend

Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/projects
```

Do not run E2E tests, seed generation, or other heavy local tasks concurrently with a performance measurement.

## Seed data

For comparable read-only measurements, create the fixed 100-project dataset:

```powershell
cd D:\source\projectflow\performance
python seed.py --count 100
```

The seed tool uses deterministic `PF-PERF-*` project names and is designed to be rerunnable without duplicating the fixture set.

## Workloads

| Workload | Behavior |
| --- | --- |
| `read-only` | Repeated `GET /api/projects`. |
| `mixed` | Sequential lifecycle: list → create → get → patch → get → delete. |
| `weighted` | Realistic weighted CRUD traffic with a stable per-user project pool. |

All current Locust users use a `0.5–1.0 s` wait between tasks.

### Weighted workload

The weighted workload currently uses these task weights:

| Operation | Weight |
| --- | ---: |
| `GET /api/projects` | 6 |
| `GET /api/projects/:id` | 4 |
| `PATCH /api/projects/:id` | 2 |
| `POST /api/projects` | 2 |
| `DELETE /api/projects/:id` | 3 |

Each weighted Locust user creates one initial project in `on_start()`. GET/PATCH operations only use projects already owned by that user; they never create data implicitly. DELETE is allowed only while the user owns more than one project, so every active user keeps at least one usable project.

The initial per-user POST is part of the Locust statistics. For staged tests, interpret the settled portions of the stages rather than the initial ramp-up when comparing steady-state behavior.

## Profiles

Profiles are defined centrally in `performance_profiles.py`.

| Profile | Purpose |
| --- | --- |
| `baseline` | Minimal sanity/baseline measurement. |
| `load` | Small fixed-load run; `--users` and `--seconds` can be overridden. |
| `stress` | Staged load increase followed by a recovery stage. |
| `capacity` | Staged capacity evaluation with rolling percentile gates. |

The current stress profile ramps through 300, 350, 400, 450, and 500 users and then drops to 50 users for recovery.

Because `stress` and `capacity` are staged profiles, do not pass `--users` or `--seconds` to them.

## Running tests

Read-only load:

```powershell
python run.py load `
    --workload read-only `
    --users 10 `
    --seconds 120 `
    --monitor-docker
```

Mixed CRUD load:

```powershell
python run.py load `
    --workload mixed `
    --users 10 `
    --seconds 120 `
    --monitor-docker
```

Weighted load:

```powershell
python run.py load `
    --workload weighted `
    --users 50 `
    --seconds 120 `
    --monitor-docker
```

Weighted stress:

```powershell
python run.py stress `
    --workload weighted `
    --monitor-docker
```

Capacity:

```powershell
python run.py capacity `
    --workload read-only `
    --monitor-docker
```

`locustfile.py` is the single Locust entry point. `run.py` selects the workload and profile through environment variables and launches Locust as a child process.

## Preflight

Before starting Locust, `run.py` calls:

```text
GET /api/projects
```

The run is aborted if the API is unavailable, does not return HTTP 200, or does not return a JSON array.

When monitoring is enabled, the Docker monitoring preflight must also succeed.

## Performance gate

The general run gate defaults to:

```text
p95 < 800 ms
error ratio < 1%
minimum requests >= 100
```

The gate result is written to `summary.json`.

HTTP failures, timeouts, malformed responses, and workload validation failures are counted by Locust.

## Capacity evaluation

The capacity profile has a separate stage evaluator based on `requests_stats_history.csv`.

Default capacity limits:

```text
rolling p95 limit: 200 ms
rolling p99 limit: 400 ms
maximum violation share: 10%
maximum error ratio: 1%
minimum requests per stable stage: 100
```

A percentile sample violates its threshold only when it is strictly greater than the configured limit.

The evaluator distinguishes these outcomes:

```text
determined
below_test_range
inconclusive
```

`inconclusive` is used when a failing capacity stage is followed by a passing higher-load stage, because that non-monotonic sequence is not a reliable capacity boundary.

The capacity result is written to `capacity_summary.json`.

## Monitoring

Use:

```text
--monitor-docker
```

The historical flag name is retained, but monitoring now covers more than Docker.

During a run the monitor records the ProjectFlow backend container, PostgreSQL container, total host CPU/memory, and the Locust process tree.

Important interpretation detail: Docker CPU percentage and host CPU percentage use different semantics. A Docker process/container can report more than 100% when it consumes more than one CPU core.

For trustworthy local capacity measurements, avoid unrelated CPU-heavy applications. In particular, keep browser dashboards closed during the actual run; Prometheus/Grafana can continue collecting data in the background.

## Test-data cleanup

Mixed and weighted workloads create projects using a unique prefix for each run, for example:

```text
perf-13623de9-
```

After Locust and performance monitoring have stopped, `run.py` queries the project list and deletes only projects matching the current run prefix.

Cleanup traffic therefore does not contaminate Locust statistics or monitored performance data.

The cleanup result is written to `cleanup.json`, including the number of matched/deleted projects and any errors.

The fixed `PF-PERF-*` seed dataset is not affected by run cleanup.

## Output

Every run creates a unique directory below `performance/results/`.

| File | Purpose |
| --- | --- |
| `run.json` | Run metadata, selected profile/workload, thresholds and run-specific prefix. |
| `summary.json` | Overall Locust PASS/FAIL, requests, failures, p95/p99, average response time and RPS. |
| `report.html` | Locust HTML report. |
| `requests_stats.csv` | Endpoint-level aggregate statistics. |
| `requests_stats_history.csv` | Time-series Locust statistics used for staged analysis. |
| `requests_failures.csv` | Request failures, when present. |
| `requests_exceptions.csv` | Locust exceptions, when present. |
| `docker_stats.csv` | Raw container monitoring samples when monitoring is enabled. |
| `host_stats.csv` | Host CPU/memory samples when monitoring is enabled. |
| `locust_stats.csv` | Locust process-tree CPU/memory samples when monitoring is enabled. |
| `monitoring.json` | Monitoring summary and collection status. |
| `cleanup.json` | Post-run cleanup result for mixed/weighted workloads. |
| `capacity_summary.json` | Per-stage capacity evaluation for the capacity profile. |

## Exit codes

```text
0   successful run
1   Locust/performance-gate failure
2   preflight/configuration/monitoring/cleanup/capacity-evaluation failure
130 interrupted by the user
```

A capacity result that is below the tested range or inconclusive returns a non-zero runner status.

Interrupted measurements should not be used for comparison even if partial reports exist.

## Interpreting local results

User count is not an RPS target. ProjectFlow uses a closed Locust workload: each user waits after a request/task, so slower responses reduce generated throughput.

The API, PostgreSQL, Locust, Docker Desktop/WSL, and other host processes can compete for the same physical CPU and memory. If host CPU approaches saturation, the run may describe the local test machine rather than the backend alone.

The project-list endpoint is currently unpaginated. Larger project counts therefore increase database work, JSON serialization, transferred response size, and client-side parsing. Keep data volume controlled when comparing concurrency runs; test data growth should be treated as a separate volume-test dimension.

For production/Azure capacity, run the load generator separately from the system under test and repeat the measurements in the target environment.
