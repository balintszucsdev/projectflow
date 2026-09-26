"""Read-only ProjectFlow workload."""

from locust import HttpUser, between, task


class ProjectReader(HttpUser):
    # Closed workload: each user waits after the response. Users are not RPS.
    wait_time = between(0.5, 1.0)

    @task
    def list_projects(self):
        with self.client.get(
            "/api/projects",
            name="GET /api/projects",
            timeout=10,
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(
                    f"Expected HTTP 200, got {response.status_code}"
                )
                return

            try:
                body = response.json()
            except ValueError:
                response.failure("Response is not valid JSON")
                return

            if not isinstance(body, list):
                response.failure("Expected a JSON array of projects")
                return

            if any(
                not isinstance(project, dict)
                or type(project.get("id")) is not int
                or not isinstance(project.get("name"), str)
                or project.get("status")
                not in {"PLANNED", "ACTIVE", "COMPLETED"}
                for project in body
            ):
                response.failure(
                    "Unexpected project response structure"
                )
                