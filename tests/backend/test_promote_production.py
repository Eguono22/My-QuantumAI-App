import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("promote_production", Path(__file__).resolve().parents[2] / "scripts/promote_production.py")
promote = importlib.util.module_from_spec(spec)
spec.loader.exec_module(promote)


def test_ready_production_deployment_from_expected_project():
    promote.validate_deployment({"id": "dpl_test", "projectId": "prj_test", "target": "production", "readyState": "READY"}, "prj_test")


@pytest.mark.parametrize("change", [{"projectId": "prj_other"}, {"target": "preview"}, {"readyState": "ERROR"}, {"id": None}])
def test_invalid_deployment_cannot_be_promoted(change):
    deployment = {"id": "dpl_test", "projectId": "prj_test", "target": "production", "readyState": "READY", **change}
    with pytest.raises(RuntimeError):
        promote.validate_deployment(deployment, "prj_test")
