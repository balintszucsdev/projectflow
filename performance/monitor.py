"""Local performance monitoring for Docker, the host, and the Locust process."""

import csv
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import statistics
import subprocess
import threading

import psutil


CONTAINERS = ("projectflow-backend", "projectflow-postgres")


def memory_mib(value):
    match = re.fullmatch(
        r"([0-9.]+)\s*(B|kB|KB|MB|GB|TB|KiB|MiB|GiB|TiB)",
        value.strip(),
    )
    if not match:
        raise ValueError(f"Unsupported Docker memory value: {value}")

    units = {
        "B": 1,
        "kB": 1000,
        "KB": 1000,
        "MB": 1000**2,
        "GB": 1000**3,
        "TB": 1000**4,
        "KiB": 1024,
        "MiB": 1024**2,
        "GiB": 1024**3,
        "TiB": 1024**4,
    }

    return float(match[1]) * units[match[2]] / 1024**2


def snapshot():
    """Collect one Docker stats snapshot for the expected Compose containers."""
    result = subprocess.run(
        [
            "docker",
            "stats",
            "--no-stream",
            "--format",
            "{{json .}}",
            *CONTAINERS,
        ],
        capture_output=True,
        text=True,
        check=True,
        timeout=15,
    )

    records = [
        json.loads(line)
        for line in result.stdout.splitlines()
        if line.strip()
    ]

    if {row.get("Name") for row in records} != set(CONTAINERS):
        raise ValueError(
            "Docker stats did not return both expected containers"
        )

    stamp = datetime.now(timezone.utc).isoformat()
    rows = []

    for record in records:
        used, limit = record["MemUsage"].split("/")

        if memory_mib(limit) <= 0:
            raise ValueError(
                "Container is stopped or has no usable stats: "
                f"{record['Name']}"
            )

        rows.append(
            {
                "timestamp_utc": stamp,
                "container": record["Name"],
                "cpu_percent": float(record["CPUPerc"].rstrip("%")),
                "memory_mib": memory_mib(used),
                "memory_limit_mib": memory_mib(limit),
                "memory_percent": float(record["MemPerc"].rstrip("%")),
                "net_io": record["NetIO"],
                "block_io": record["BlockIO"],
                "pids": record["PIDs"],
            }
        )

    return rows


def host_snapshot():
    """Collect one host CPU and memory sample."""
    memory = psutil.virtual_memory()

    return {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "cpu_percent": psutil.cpu_percent(interval=None),
        "memory_percent": memory.percent,
        "memory_used_mib": memory.used / 1024**2,
        "memory_available_mib": memory.available / 1024**2,
    }


class DockerMonitor:
    """Monitor Docker containers, the host, and the Locust load generator."""

    def __init__(self, output, first_rows, interval=2):
        self.output = Path(output)
        self.first_rows = first_rows
        self.interval = interval
        self.stop_event = threading.Event()
        self.rows = []
        self.host_rows = []
        self.locust_rows = []
        self.errors = []
        self.locust_process = None
        self.locust_processes = {}
        self.thread = threading.Thread(
            target=self.collect,
            daemon=True,
        )

    def attach_process(self, pid):
        """Attach the monitor to the Locust process started by run.py."""
        try:
            process = psutil.Process(pid)
            self.locust_process = process
            self.locust_processes = {pid: process}
            process.cpu_percent(interval=None)
        except (
            psutil.AccessDenied,
            psutil.NoSuchProcess,
            psutil.ZombieProcess,
        ) as exc:
            self.errors.append(
                f"Could not attach to Locust process {pid}: {exc}"
            )

    def start(self):
        psutil.cpu_percent(interval=None)
        self.thread.start()

    def _locust_snapshot(self):
        """Measure the complete Locust process tree."""
        if self.locust_process is None:
            return None

        try:
            discovered = [
                self.locust_process,
                *self.locust_process.children(recursive=True),
            ]
        except (
            psutil.AccessDenied,
            psutil.NoSuchProcess,
            psutil.ZombieProcess,
        ):
            return None

        cpu_percent = 0.0
        memory_rss = 0
        process_count = 0

        for discovered_process in discovered:
            process = self.locust_processes.get(
                discovered_process.pid
            )

            if process is None:
                process = discovered_process
                self.locust_processes[process.pid] = process

                try:
                    process.cpu_percent(interval=None)
                except (
                    psutil.AccessDenied,
                    psutil.NoSuchProcess,
                    psutil.ZombieProcess,
                ):
                    continue

                process_cpu = 0.0
            else:
                try:
                    process_cpu = process.cpu_percent(
                        interval=None
                    )
                except (
                    psutil.AccessDenied,
                    psutil.NoSuchProcess,
                    psutil.ZombieProcess,
                ):
                    continue

            try:
                memory_rss += process.memory_info().rss
            except (
                psutil.AccessDenied,
                psutil.NoSuchProcess,
                psutil.ZombieProcess,
            ):
                continue

            cpu_percent += process_cpu
            process_count += 1

        if process_count == 0:
            return None

        return {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "pid": self.locust_process.pid,
            "process_count": process_count,
            "cpu_percent": cpu_percent,
            "memory_rss_mib": memory_rss / 1024**2,
        }

    def collect(self):
        try:
            with (
                (self.output / "docker_stats.csv").open(
                    "w", newline="", encoding="utf-8"
                ) as docker_stream,
                (self.output / "host_stats.csv").open(
                    "w", newline="", encoding="utf-8"
                ) as host_stream,
                (self.output / "locust_stats.csv").open(
                    "w", newline="", encoding="utf-8"
                ) as locust_stream,
            ):
                docker_writer = csv.DictWriter(
                    docker_stream,
                    fieldnames=list(self.first_rows[0]),
                )
                host_writer = csv.DictWriter(
                    host_stream,
                    fieldnames=[
                        "timestamp_utc",
                        "cpu_percent",
                        "memory_percent",
                        "memory_used_mib",
                        "memory_available_mib",
                    ],
                )
                locust_writer = csv.DictWriter(
                    locust_stream,
                    fieldnames=[
                        "timestamp_utc",
                        "pid",
                        "process_count",
                        "cpu_percent",
                        "memory_rss_mib",
                    ],
                )

                docker_writer.writeheader()
                host_writer.writeheader()
                locust_writer.writeheader()

                rows = self.first_rows

                while True:
                    docker_writer.writerows(rows)
                    self.rows.extend(rows)

                    host_row = host_snapshot()
                    host_writer.writerow(host_row)
                    self.host_rows.append(host_row)

                    locust_row = self._locust_snapshot()
                    if locust_row is not None:
                        locust_writer.writerow(locust_row)
                        self.locust_rows.append(locust_row)

                    docker_stream.flush()
                    host_stream.flush()
                    locust_stream.flush()

                    if self.stop_event.wait(self.interval):
                        break

                    rows = snapshot()

        except Exception as exc:
            self.errors.append(str(exc))

    def stop(self):
        self.stop_event.set()
        self.thread.join(timeout=20)

        if self.thread.is_alive():
            self.errors.append("Collector did not stop in time")

        container_summaries = {}

        for name in CONTAINERS:
            rows = [
                row
                for row in self.rows
                if row["container"] == name
            ]

            if not rows:
                self.errors.append(f"No samples for {name}")
                continue

            container_summaries[name] = {
                "samples": len(rows),
                "cpu_percent_mean": statistics.mean(
                    row["cpu_percent"] for row in rows
                ),
                "cpu_percent_max": max(
                    row["cpu_percent"] for row in rows
                ),
                "memory_mib_first": rows[0]["memory_mib"],
                "memory_mib_last": rows[-1]["memory_mib"],
                "memory_mib_max": max(
                    row["memory_mib"] for row in rows
                ),
            }

        host_summary = None
        if self.host_rows:
            host_summary = {
                "samples": len(self.host_rows),
                "cpu_percent_mean": statistics.mean(
                    row["cpu_percent"] for row in self.host_rows
                ),
                "cpu_percent_max": max(
                    row["cpu_percent"] for row in self.host_rows
                ),
                "memory_percent_mean": statistics.mean(
                    row["memory_percent"] for row in self.host_rows
                ),
                "memory_percent_max": max(
                    row["memory_percent"] for row in self.host_rows
                ),
                "memory_used_mib_first": self.host_rows[0]["memory_used_mib"],
                "memory_used_mib_last": self.host_rows[-1]["memory_used_mib"],
                "memory_used_mib_max": max(
                    row["memory_used_mib"] for row in self.host_rows
                ),
                "memory_available_mib_min": min(
                    row["memory_available_mib"] for row in self.host_rows
                ),
            }
        else:
            self.errors.append("No host samples")

        locust_summary = None
        if self.locust_rows:
            locust_summary = {
                "pid": self.locust_rows[0]["pid"],
                "samples": len(self.locust_rows),
                "process_count_max": max(
                    row["process_count"]
                    for row in self.locust_rows
                ),
                "cpu_percent_mean": statistics.mean(
                    row["cpu_percent"] for row in self.locust_rows
                ),
                "cpu_percent_max": max(
                    row["cpu_percent"] for row in self.locust_rows
                ),
                "memory_rss_mib_first": self.locust_rows[0]["memory_rss_mib"],
                "memory_rss_mib_last": self.locust_rows[-1]["memory_rss_mib"],
                "memory_rss_mib_max": max(
                    row["memory_rss_mib"] for row in self.locust_rows
                ),
            }
        else:
            self.errors.append("No Locust process samples")

        result = {
            "complete": not self.errors,
            "errors": self.errors,
            "containers": container_summaries,
            "host": host_summary,
            "locust_process": locust_summary,
            "pause_between_samples_seconds": self.interval,
        }

        (self.output / "monitoring.json").write_text(
            json.dumps(result, indent=2) + "\n",
            encoding="utf-8",
        )

        return result
