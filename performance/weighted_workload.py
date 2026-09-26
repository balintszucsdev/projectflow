"""Weighted ProjectFlow workload with realistic CRUD distribution."""

import os
from random import choice
from uuid import uuid4

from locust import HttpUser, TaskSet, between, task


PROJECT_PREFIX = os.environ.get(
    "PROJECTFLOW_PROJECT_PREFIX",
    "perf-weighted-manual-",
)


class ProjectWeightedTasks(TaskSet):
    def on_start(self):
        self.project_ids: list[int] = []
        self._create_project()

    def _create_project(self) -> int | None:
        with self.client.post(
            "/api/projects",
            name="POST /api/projects",
            json={
                "name": f"{PROJECT_PREFIX}{uuid4().hex}",
                "description": "Created by weighted performance test",
                "status": "PLANNED",
            },
            timeout=10,
            catch_response=True,
        ) as response:
            if response.status_code != 201:
                response.failure(
                    f"Expected HTTP 201, got {response.status_code}"
                )
                return None

            try:
                body = response.json()
            except ValueError:
                response.failure("Response is not valid JSON")
                return None

            project_id = body.get("id")

            if type(project_id) is not int:
                response.failure(
                    "Created project does not contain a valid integer id"
                )
                return None

            self.project_ids.append(project_id)
            return project_id

    def _get_owned_project_id(self) -> int | None:
        if not self.project_ids:
            return None

        return choice(self.project_ids)

    @task(6)
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

    @task(4)
    def get_project(self):
        project_id = self._get_owned_project_id()

        if project_id is None:
            return

        with self.client.get(
            f"/api/projects/{project_id}",
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

            if body.get("id") != project_id:
                response.failure("Unexpected project id")

    @task(2)
    def update_project(self):
        project_id = self._get_owned_project_id()

        if project_id is None:
            return

        with self.client.patch(
            f"/api/projects/{project_id}",
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
                response.failure("Expected project status ACTIVE")

    @task(2)
    def create_project(self):
        self._create_project()

    @task(3)
    def delete_project(self):
        if len(self.project_ids) <= 1:
            return

        project_id = choice(self.project_ids)

        with self.client.delete(
            f"/api/projects/{project_id}",
            name="DELETE /api/projects/:id",
            timeout=10,
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(
                    f"Expected HTTP 200, got {response.status_code}"
                )
                return

            self.project_ids.remove(project_id)


class ProjectWeightedUser(HttpUser):
    wait_time = between(0.5, 1.0)
    tasks = [ProjectWeightedTasks]
    