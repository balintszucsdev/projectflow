"""Shared ProjectFlow performance-test profiles."""

BASELINE_PROFILE = {
    "users": 1,
    "spawn_rate": 1,
    "seconds": 120,
}

LOAD_PROFILE = {
    "users": 10,
    "spawn_rate": 2,
    "seconds": 120,
}


STRESS_PROFILE = {
    "users": 500,
    "spawn_rate": 10,
    "seconds": 720,
    "stages": [
        {"until_seconds": 120, "users": 300, "spawn_rate": 10},
        {"until_seconds": 240, "users": 350, "spawn_rate": 10},
        {"until_seconds": 360, "users": 400, "spawn_rate": 10},
        {"until_seconds": 480, "users": 450, "spawn_rate": 10},
        {"until_seconds": 600, "users": 500, "spawn_rate": 10},
        {
            "until_seconds": 720,
            "users": 50,
            "spawn_rate": 25,
            "purpose": "recovery",
        },
    ],
}

CAPACITY_PROFILE = {
    "users": 400,
    "spawn_rate": 10,
    "seconds": 2700,
    "stable_after_seconds": 60,
    "stages": [
        {
            "until_seconds": 300,
            "users": 375,
            "spawn_rate": 10,
            "purpose": "warmup",
        },
        {
            "until_seconds": 600,
            "users": 375,
            "spawn_rate": 10,
        },
        {
            "until_seconds": 900,
            "users": 380,
            "spawn_rate": 10,
        },
        {
            "until_seconds": 1200,
            "users": 385,
            "spawn_rate": 10,
        },
        {
            "until_seconds": 1500,
            "users": 390,
            "spawn_rate": 10,
        },
        {
            "until_seconds": 1800,
            "users": 395,
            "spawn_rate": 10,
        },
        {
            "until_seconds": 2100,
            "users": 400,
            "spawn_rate": 10,
        },
        {
            "until_seconds": 2400,
            "users": 375,
            "spawn_rate": 10,
            "purpose": "control",
        },
        {
            "until_seconds": 2700,
            "users": 50,
            "spawn_rate": 25,
            "purpose": "recovery",
        },
    ],
}

PROFILES = {
    "baseline": BASELINE_PROFILE,
    "load": LOAD_PROFILE,
    "stress": STRESS_PROFILE,
    "capacity": CAPACITY_PROFILE,
}
