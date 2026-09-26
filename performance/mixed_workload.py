"""Mixed ProjectFlow workload simulating a project lifecycle."""

import os
from uuid import uuid4

from locust import HttpUser, SequentialTaskSet, between, task


PROJECT_PREFIX = os.environ.get(
    "PROJECTFLOW_PROJECT_PREFIX",
    "perf-manual-",
)


class ProjectLifecycle(SequentialTaskSet):
    project_id: int | None = None

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

    @task
    def create_project(self):
        project_name = f"{PROJECT_PREFIX}{uuid4().hex}"

        with self.client.post(
            "/api/projects",
            name="POST /api/projects",
            json={
                "name": project_name,
                "description": "Created by ProjectFlow performance test",
                "status": "PLANNED",
            },
            timeout=10,
            catch_response=True,
        ) as response:
            if response.status_code != 201:
                response.failure(
                    f"Expected HTTP 201, got {response.status_code}"
                )
                self.project_id = None
                return

            try:
                body = response.json()
            except ValueError:
                response.failure("Response is not valid JSON")
                self.project_id = None
                return

            project_id = body.get("id")

            if type(project_id) is not int:
                response.failure(
                    "Created project does not contain a valid integer id"
                )
                self.project_id = None
                return

            self.project_id = project_id

    @task
    def get_created_project(self):
        if self.project_id is None:
            return

        with self.client.get(
            f"/api/projects/{self.project_id}",
            name="GET /api/projects/:id",
            timeout=10,
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(
                    f"Expected HTTP 200, got {response.status_code}"
                )

    @task
    def update_project(self):
        if self.project_id is None:
            return

        with self.client.patch(
            f"/api/projects/{self.project_id}",
            name="PATCH /api/projects/:id",
            json={
                "status": "ACTIVE",
            },
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

            if body.get("status") != "ACTIVE":
                response.failure(
                    "Updated project did not become ACTIVE"
                )

    @task
    def get_updated_project(self):
        if self.project_id is None:
            return

        with self.client.get(
            f"/api/projects/{self.project_id}",
            name="GET /api/projects/:id",
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

            if body.get("status") != "ACTIVE":
                response.failure(
                    "Expected project status ACTIVE"
                )

    @task
    def delete_project(self):
        if self.project_id is None:
            return

        with self.client.delete(
            f"/api/projects/{self.project_id}",
            name="DELETE /api/projects/:id",
            timeout=10,
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(
                    f"Expected HTTP 200, got {response.status_code}"
                )
                return

            self.project_id = None

class ProjectMixedUser(HttpUser):
    wait_time = between(0.5, 1.0)
    tasks = [ProjectLifecycle]
    