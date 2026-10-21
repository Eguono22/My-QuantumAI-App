"""Promote a verified production deployment using project-scoped Vercel credentials."""
import argparse
import json
import os
import time
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen


def validate_deployment(deployment, project_id):
    if deployment.get("projectId") != project_id:
        raise RuntimeError("Deployment belongs to a different Vercel project")
    if deployment.get("target") != "production" or deployment.get("readyState") != "READY":
        raise RuntimeError("Only a ready production deployment can be promoted")
    if not deployment.get("id"):
        raise RuntimeError("Deployment ID is missing")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("deployment_url")
    args = parser.parse_args()
    parsed = urlparse(args.deployment_url)
    if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".vercel.app") or parsed.username:
        raise RuntimeError("Expected an HTTPS Vercel deployment URL")
    token = os.environ["VERCEL_TOKEN"]
    project_id = os.environ["VERCEL_PROJECT_ID"]
    team_id = os.environ["VERCEL_ORG_ID"]

    def api(path, method="GET"):
        request = Request(
            "https://api.vercel.com" + path + "?" + urlencode({"teamId": team_id}),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
            data=b"{}" if method == "POST" else None,
            method=method,
        )
        with urlopen(request, timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else {}

    deployment = api("/v13/deployments/" + quote(parsed.hostname, safe=""))
    validate_deployment(deployment, project_id)
    project_path = "/v9/projects/" + quote(project_id, safe="")
    current = api(project_path).get("targets", {}).get("production", {})
    if current.get("id") == deployment["id"]:
        print("Verified deployment is already current in production")
        return
    api("/v10/projects/" + quote(project_id, safe="") + "/promote/" + quote(deployment["id"], safe=""), "POST")
    for _ in range(60):
        current = api(project_path).get("targets", {}).get("production", {})
        if current.get("id") == deployment["id"]:
            print("Verified deployment is current in production")
            return
        time.sleep(2)
    raise RuntimeError("Promotion did not become current within the verification window")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        raise SystemExit("Production promotion failed: " + str(exc))
