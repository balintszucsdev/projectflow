"""ProjectFlow Locust entry point."""

import json
import logging
import os
from pathlib import Path

from locust import LoadTestShape, events

from performance_profiles import PROFILES


WORKLOAD_NAME = os.environ.get("PROJECTFLOW_WORKLOAD", "read-only")

if WORKLOAD_NAME == "read-only":
    from read_only_workload import ProjectReader  # noqa: F401

elif WORKLOAD_NAME == "mixed":
    from mixed_workload import ProjectMixedUser  # noqa: F401

elif WORKLOAD_NAME == "weighted":
    from weighted_workload import ProjectWeightedUser  # noqa: F401

else:
    raise RuntimeError(
        f"Unknown ProjectFlow workload: {WORKLOAD_NAME}"
    )


PROFILE_NAME = os.environ.get("PROJECTFLOW_PROFILE")

if PROFILE_NAME is not None:
    if PROFILE_NAME not in PROFILES:
        raise RuntimeError(
            f"Unknown ProjectFlow profile: {PROFILE_NAME}"
        )

    PROFILE = PROFILES[PROFILE_NAME]

    if "stages" in PROFILE:

        class ProjectFlowStagedShape(LoadTestShape):
            stages = PROFILE["stages"]

            def tick(self):
                run_time = self.get_run_time()

                for stage in self.stages:
                    if run_time < stage["until_seconds"]:
                        return (
                            stage["users"],
                            stage["spawn_rate"],
                        )

                return None


@events.init_command_line_parser.add_listener
def add_arguments(parser, **kwargs):
    parser.add_argument(
        "--max-p95-ms",
        type=float,
        default=800.0,
    )
    parser.add_argument(
        "--max-error-ratio",
        type=float,
        default=0.01,
    )
    parser.add_argument(
        "--min-requests",
        type=int,
        default=100,
    )
    parser.add_argument(
        "--summary-file",
        default="",
    )


@events.quitting.add_listener
def grade_run(environment, **kwargs):
    options = environment.parsed_options
    total = environment.stats.total

    p95 = (
        total.get_response_time_percentile(0.95)
        if total.num_requests
        else None
    )

    reasons = []

    if total.num_requests < options.min_requests:
        reasons.append(
            f"Fewer than {options.min_requests} requests"
        )

    if p95 is None or p95 >= options.max_p95_ms:
        reasons.append(
            f"p95 must be below {options.max_p95_ms} ms"
        )

    if total.fail_ratio >= options.max_error_ratio:
        reasons.append(
            f"Error ratio must be below "
            f"{options.max_error_ratio}"
        )

    if environment.process_exit_code:
        reasons.append(
            "Locust reported an execution error"
        )

    summary = {
        "passed": not reasons,
        "failure_reasons": reasons,
        "host": environment.host,
        "requests": total.num_requests,
        "failures": total.num_failures,
        "error_ratio": total.fail_ratio,
        "p95_ms": p95,
        "p99_ms": (
            total.get_response_time_percentile(0.99)
            if total.num_requests
            else None
        ),
        "average_ms": total.avg_response_time,
        "rps": total.total_rps,
        "thresholds": {
            "p95_ms_exclusive": options.max_p95_ms,
            "error_ratio_exclusive": options.max_error_ratio,
            "minimum_requests": options.min_requests,
        },
    }

    if options.summary_file:
        destination = Path(options.summary_file)
        destination.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        destination.write_text(
            json.dumps(summary, indent=2) + "\n",
            encoding="utf-8",
        )

    logging.info(
        "Performance gate: %s",
        "PASS" if summary["passed"] else "FAIL",
    )

    for reason in reasons:
        logging.error(reason)

    environment.process_exit_code = (
        environment.process_exit_code
        or (1 if reasons else 0)
    )
