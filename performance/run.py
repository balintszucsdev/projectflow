"""Cross-platform performance launcher; run with the performance venv Python."""

import argparse
import csv
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4

from monitor import DockerMonitor, snapshot
from performance_profiles import PROFILES

ROOT = Path(__file__).resolve().parent


def _number(row, column):
    value = row[column]
    return None if value == "N/A" else float(value)


def write_capacity_summary(history_file, destination, profile, thresholds):
    """Grade each stable capacity stage from Locust's rolling history."""
    with history_file.open(encoding="utf-8-sig", newline="") as source:
        rows = [
            row for row in csv.DictReader(source)
            if row["Name"] == "Aggregated" and row["Type"] == ""
        ]
    # Locust can emit two aggregate rows for the same second; keep the latest.
    rows = list({int(row["Timestamp"]): row for row in rows}.values())
    rows.sort(key=lambda row: int(row["Timestamp"]))
    if not rows:
        raise ValueError("No aggregate history rows found")
    started = int(rows[0]["Timestamp"])
    previous_until = 0
    results = []
    maximum_acceptable_users = None
    capacity_still_contiguous = True
    settle = profile["stable_after_seconds"]

    for stage in profile["stages"]:
        until = stage["until_seconds"]
        target = stage["users"]
        reached = [
            row for row in rows
            if previous_until <= int(row["Timestamp"]) - started < until
            and int(row["User Count"]) == target
        ]
        reasons = []
        if reached:
            first_target_elapsed = int(reached[0]["Timestamp"]) - started
            stable_from = first_target_elapsed + settle
            stable = [
                row for row in reached
                if int(row["Timestamp"]) - started >= stable_from
            ]
        else:
            first_target_elapsed = None
            stable_from = None
            stable = []

        if len(stable) < 2:
            reasons.append("Insufficient stable-stage history")
            requests = failures = 0
            error_ratio = rps = None

            p95_values = []
            p99_values = []

            p95_violation_count = 0
            p99_violation_count = 0

            p95_violation_ratio = None
            p99_violation_ratio = None

        else:
            first, last = stable[0], stable[-1]

            duration = int(last["Timestamp"]) - int(first["Timestamp"])

            requests = (
                int(last["Total Request Count"])
                - int(first["Total Request Count"])
            )

            failures = (
                int(last["Total Failure Count"])
                - int(first["Total Failure Count"])
            )

            error_ratio = failures / requests if requests else 0.0
            rps = requests / duration if duration else None

            p95_values = [
                value
                for row in stable
                if (value := _number(row, "95%")) is not None
            ]

            p99_values = [
                value
                for row in stable
                if (value := _number(row, "99%")) is not None
            ]

            p95_violation_count = sum(
                value > thresholds["max_rolling_p95_ms"]
                for value in p95_values
            )

            p99_violation_count = sum(
                value > thresholds["max_rolling_p99_ms"]
                for value in p99_values
            )

            p95_violation_ratio = (
                p95_violation_count / len(p95_values)
                if p95_values
                else None
            )

            p99_violation_ratio = (
                p99_violation_count / len(p99_values)
                if p99_values
                else None
            )

            if requests < thresholds["minimum_requests_per_stage"]:
                reasons.append("Too few requests in stable stage")

            if not p95_values:
                reasons.append("No rolling p95 samples")
            elif (
                p95_violation_ratio
                > thresholds["max_percentile_violation_ratio"]
            ):
                reasons.append("Rolling p95 violation ratio exceeded")

            if not p99_values:
                reasons.append("No rolling p99 samples")
            elif (
                p99_violation_ratio
                > thresholds["max_percentile_violation_ratio"]
            ):
                reasons.append("Rolling p99 violation ratio exceeded")

            if error_ratio >= thresholds["max_error_ratio"]:
                reasons.append("Error-ratio limit reached")

        purpose = stage.get("purpose", "capacity")
        passed = not reasons
        result = {
            "users": target,
            "purpose": purpose,
            "stage_from_seconds": previous_until,
            "stage_until_seconds": until,
            "target_reached_seconds": first_target_elapsed,
            "stable_from_seconds": stable_from,
            "stable_samples": len(stable),
            "requests": requests,
            "failures": failures,
            "error_ratio": error_ratio,
            "rps": rps,
            "rolling_p95_ms_median": statistics.median(p95_values) if p95_values else None,
            "rolling_p95_ms_max": max(p95_values) if p95_values else None,
            "rolling_p95_violation_count": p95_violation_count,
            "rolling_p95_violation_ratio": p95_violation_ratio,
            "rolling_p99_ms_median": statistics.median(p99_values) if p99_values else None,
            "rolling_p99_ms_max": max(p99_values) if p99_values else None,
            "rolling_p99_violation_count": p99_violation_count,
            "rolling_p99_violation_ratio": p99_violation_ratio,
            "passed": passed,
            "failure_reasons": reasons,
        }
        results.append(result)
        if purpose == "capacity":
            if capacity_still_contiguous and passed:
                maximum_acceptable_users = target
            else:
                capacity_still_contiguous = False
        previous_until = until

    capacity_results = [
        result
        for result in results
        if result["purpose"] == "capacity"
    ]

    if not capacity_results:
        raise ValueError("No capacity stages configured")

    passed_capacity_results = [
        result for result in capacity_results
        if result["passed"]
    ]

    failed_stage_seen = False
    pass_after_failure = False

    for result in capacity_results:
        if result["passed"]:
            if failed_stage_seen:
                pass_after_failure = True
        else:
            failed_stage_seen = True

    if not passed_capacity_results:
        evaluation_status = "below_test_range"
        evaluation_reason = (
            "No tested capacity stage met the configured thresholds."
        )
        maximum_acceptable_users = None
    elif pass_after_failure:
        evaluation_status = "inconclusive"
        evaluation_reason = (
            "Non-monotonic capacity results: a failed capacity stage "
            "was followed by a passing higher-load stage."
        )
        maximum_acceptable_users = None
    else:
        evaluation_status = "determined"
        if all(result["passed"] for result in capacity_results):
            evaluation_reason = (
                "All tested capacity stages met the configured thresholds; "
                "the true capacity may be higher than the highest tested stage."
            )
        else:
            evaluation_reason = (
                "Capacity boundary determined from the contiguous passing "
                "capacity stages."
            )

    summary = {
        "evaluation_status": evaluation_status,
        "evaluation_reason": evaluation_reason,
        "maximum_acceptable_users": maximum_acceptable_users,
        "thresholds": thresholds,
        "note": (
            "Percentile gates use the share of rolling samples that exceed "
            "the configured p95/p99 limits after each stage settles."
        ),
        "stages": results,
    }
    destination.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary



def cleanup_test_projects(host, project_prefix, destination):
    """Delete projects created by this performance run, outside Locust stats."""
    result = {
        "project_prefix": project_prefix,
        "matched_projects": 0,
        "deleted_projects": 0,
        "errors": [],
    }

    try:
        with urlopen(host + "/api/projects", timeout=10) as response:
            if response.status != 200:
                raise ValueError(
                    f"Expected HTTP 200 while listing projects, got "
                    f"{response.status}"
                )
            projects = json.load(response)

        if not isinstance(projects, list):
            raise ValueError("Expected a JSON array while listing projects")

        matches = [
            project
            for project in projects
            if isinstance(project, dict)
            and isinstance(project.get("name"), str)
            and project["name"].startswith(project_prefix)
            and type(project.get("id")) is int
        ]
        result["matched_projects"] = len(matches)

        for project in matches:
            project_id = project["id"]
            request = Request(
                f"{host}/api/projects/{project_id}",
                method="DELETE",
            )

            try:
                with urlopen(request, timeout=10) as response:
                    if response.status != 200:
                        raise ValueError(
                            f"Expected HTTP 200 deleting project "
                            f"{project_id}, got {response.status}"
                        )
                result["deleted_projects"] += 1
            except (URLError, ValueError, TimeoutError) as exc:
                result["errors"].append(
                    f"Project {project_id}: {exc}"
                )

    except (URLError, ValueError, TimeoutError) as exc:
        result["errors"].append(str(exc))

    result["complete"] = not result["errors"]

    destination.write_text(
        json.dumps(result, indent=2) + "\n",
        encoding="utf-8",
    )
    return result



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", choices=PROFILES)
    parser.add_argument("--host", default="http://localhost:3000")
    parser.add_argument("--seconds", type=int)
    parser.add_argument("--users", type=int)
    parser.add_argument("--min-requests", type=int, default=100)
    parser.add_argument("--max-p95-ms", type=float, default=800)
    parser.add_argument("--max-error-ratio", type=float, default=0.01)
    parser.add_argument("--capacity-max-p95-ms", type=float, default=200)
    parser.add_argument("--capacity-max-p99-ms", type=float, default=400)
    parser.add_argument("--monitor-docker", action="store_true", help="Record CPU/memory for the Compose backend and PostgreSQL containers")
    parser.add_argument("--capacity-max-violation-ratio", type=float, default=0.10)
    parser.add_argument("--workload", choices=("read-only", "mixed", "weighted"), default="read-only")

    args = parser.parse_args()
    profile = dict(PROFILES[args.profile])
    is_staged = "stages" in profile
    if is_staged and (args.seconds is not None or args.users is not None):
        parser.error(
            f"{args.profile} uses its fixed staged profile; "
            "omit --seconds and --users"
        )
    for key in ("seconds", "users"):
        if getattr(args, key) is not None:
            profile[key] = getattr(args, key)
    if min(profile["seconds"], profile["users"], args.min_requests) < 1:
        parser.error("seconds, users and min-requests must be positive")
    if not 0 < args.max_p95_ms < float("inf") or not 0 < args.max_error_ratio <= 1:
        parser.error("Use a finite positive p95 limit and an error ratio in (0, 1]")
    if (not 0 < args.capacity_max_p95_ms < float("inf")
            or not 0 < args.capacity_max_p99_ms < float("inf")):
        parser.error("Use finite positive capacity percentile limits")
    host = args.host.rstrip("/")
    url = urlsplit(host)
    if (url.scheme not in {"http", "https"} or not url.hostname
            or url.path or url.query or url.fragment or url.username or url.password):
        parser.error("host must be an HTTP(S) origin, without a path or credentials")
    if args.monitor_docker and url.hostname not in {"localhost", "127.0.0.1", "::1"}:
        parser.error("Docker monitoring is for the local Compose API only")
    if not 0 <= args.capacity_max_violation_ratio < 1:
        parser.error("capacity-max-violation-ratio must be in [0, 1)")

    # This probe is outside Locust statistics. Health alone does not check the DB.
    try:
        with urlopen(host + "/api/projects", timeout=10) as response:
            if response.status != 200:
                raise ValueError(f"Expected HTTP 200, got {response.status}")
            projects = json.load(response)
        if not isinstance(projects, list):
            raise ValueError("Expected a JSON array")
    except (URLError, ValueError, TimeoutError) as exc:
        print(f"Preflight failed: {exc}", file=sys.stderr)
        return 2

    first_rows = None
    if args.monitor_docker:
        try:
            first_rows = snapshot()
        except (OSError, ValueError, KeyError, subprocess.SubprocessError) as exc:
            print(f"Docker monitoring preflight failed: {exc}", file=sys.stderr)
            return 2

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_id = uuid4().hex[:8]
    project_prefix = f"perf-{run_id}-"
    output = ROOT / "results" / (
        f"{stamp}-{args.profile}-{args.workload}-{run_id}"
    )
    output.mkdir(parents=True)
    metadata = {
        "run_id": run_id,
        "project_prefix": project_prefix,
        "profile": args.profile,
        "workload": args.workload,
        "host": host,
        "started_at_utc": stamp,
        **profile,
        "project_count_before_run": len(projects),
        "wait_seconds": [0.5, 1.0],
        "includes_ramp_up": True,
        "docker_monitoring": args.monitor_docker,
        "thresholds": {
            "max_p95_ms": args.max_p95_ms,
            "max_error_ratio": args.max_error_ratio,
            "min_requests": args.min_requests,
        },
    }
    if args.profile == "capacity":
        metadata["capacity_thresholds"] = {
            "max_rolling_p95_ms": args.capacity_max_p95_ms,
            "max_rolling_p99_ms": args.capacity_max_p99_ms,
            "max_percentile_violation_ratio": args.capacity_max_violation_ratio,
            "max_error_ratio": args.max_error_ratio,
            "minimum_requests_per_stage": args.min_requests,
        }
    (output / "run.json").write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )

    # locustfile.py is the single Locust entry point. It selects both the
    # workload and an optional LoadTestShape from environment variables.
    locustfile = "locustfile.py"

    command = [
        sys.executable,
        "-m",
        "locust",
        "-f",
        str(ROOT / locustfile),
        "--headless",
        "--host",
        host,
        "--stop-timeout",
        "10",
        "--only-summary",
        "--csv",
        str(output / "requests"),
        "--csv-full-history",
        "--html",
        str(output / "report.html"),
        "--summary-file",
        str(output / "summary.json"),
        "--max-p95-ms",
        str(args.max_p95_ms),
        "--max-error-ratio",
        str(args.max_error_ratio),
        "--min-requests",
        str(args.min_requests),
    ]

    if not is_staged:
        command.extend([
            "--users",
            str(profile["users"]),
            "--spawn-rate",
            str(profile["spawn_rate"]),
            "--run-time",
            f"{profile['seconds']}s",
        ])

    process_env = os.environ.copy()
    process_env["PROJECTFLOW_PROFILE"] = args.profile
    process_env["PROJECTFLOW_WORKLOAD"] = args.workload
    process_env["PROJECTFLOW_PROJECT_PREFIX"] = project_prefix

    print(
        f"Target: {host}; "
        f"profile: {args.profile}; "
        f"workload: {args.workload}; "
        f"projects: {len(projects)}; "
        f"reports: {output}",
        flush=True,
    )

    monitor = DockerMonitor(output, first_rows) if args.monitor_docker else None
    monitoring = None
    monitor_started = False
    process = None
    returncode = 2
    capacity_exit_code = 0
    cleanup = None

    try:
        process = subprocess.Popen(
            command,
            cwd=ROOT,
            env=process_env,
        )

        if monitor:
            monitor.attach_process(process.pid)
            monitor.start()
            monitor_started = True

        returncode = process.wait()

    except KeyboardInterrupt:
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()

        print(
            "Run interrupted; do not use it as a completed measurement.",
            file=sys.stderr,
        )
        return 130

    except OSError as exc:
        print(
            f"Could not start Locust: {exc}",
            file=sys.stderr,
        )
        return 2

    finally:
        if monitor and monitor_started:
            monitoring = monitor.stop()
            if not monitoring["complete"]:
                print(
                    "Performance monitoring incomplete; "
                    "see monitoring.json.",
                    file=sys.stderr,
                )

        if process is not None and process.poll() is not None:
            if args.workload in {"mixed", "weighted"}:
                cleanup = cleanup_test_projects(
                    host,
                    project_prefix,
                    output / "cleanup.json",
                )
                if cleanup["complete"]:
                    print(
                        "Performance workload cleanup:",
                        cleanup["deleted_projects"],
                        "project(s) deleted.",
                    )
                else:
                    print(
                        "Performance workload cleanup incomplete; "
                        "see cleanup.json.",
                        file=sys.stderr,
                    )

    if not (output / "summary.json").exists():
        print(
            "No summary produced; Locust did not complete successfully.",
            file=sys.stderr,
        )
        return returncode or 2

    if args.profile == "capacity":
        try:
            capacity = write_capacity_summary(
                output / "requests_stats_history.csv",
                output / "capacity_summary.json",
                profile,
                metadata["capacity_thresholds"],
            )
        except (OSError, ValueError, KeyError) as exc:
            print(
                f"Capacity evaluation failed: {exc}",
                file=sys.stderr,
            )
            return 2

        maximum = capacity["maximum_acceptable_users"]
        evaluation_status = capacity["evaluation_status"]

        if evaluation_status == "below_test_range":
            print(
                capacity["evaluation_reason"],
                file=sys.stderr,
            )
            capacity_exit_code = 2

        elif evaluation_status == "inconclusive":
            print(
                f"Capacity evaluation inconclusive: "
                f"{capacity['evaluation_reason']}",
                file=sys.stderr,
            )
            capacity_exit_code = 2

        elif maximum is not None:
            print(
                "Maximum acceptable capacity:",
                maximum,
                "users",
            )

            capacity_results = [
                stage
                for stage in capacity["stages"]
                if stage["purpose"] == "capacity"
            ]
            if all(stage["passed"] for stage in capacity_results):
                print(capacity["evaluation_reason"])

    # Keep the API gate in summary.json separate from monitoring availability.
    return (
        returncode
        or capacity_exit_code
        or (2 if monitoring and not monitoring["complete"] else 0)
        or (2 if cleanup and not cleanup["complete"] else 0)
    )

if __name__ == "__main__":
    sys.exit(main())
    