import json
import os
import ssl
import urllib.parse
import urllib.request
from typing import Any

import certifi
import pulumi
import pulumi.dynamic as dynamic
import pulumi_cloudflare as cloudflare


config = pulumi.Config()

domain = config.get("domain") or "atlanta-robotics.org"
azure_hostname = config.get("azureHostname") or "polite-tree-06850430f.7.azurestaticapps.net"
validation_token = config.get("validationToken") or "_mish3wq5ou7jsdbsac5xoin79mx1rjk"
www_validation_token = config.get("wwwValidationToken") or "_lqbyy7qkoaw8gjba04qxmxox7wyj0so"
github_pages_www_target = config.get("githubPagesWwwTarget") or "ncode3.github.io"
cloudflare_zone_id = config.get("cloudflareZoneId")

github_pages_apex_ips = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
]


def _object_value(obj: Any, key: str) -> Any:
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key)


def _first_zone_id(results: list[Any]) -> str:
    if not results:
        raise ValueError(f"No active Cloudflare zone found for {domain}")
    return _object_value(results[0], "id")


if cloudflare_zone_id:
    zone_id = pulumi.Output.from_input(cloudflare_zone_id)
else:
    zones = cloudflare.get_zones_output(name=domain, status="active", max_items=10)
    zone_id = zones.results.apply(_first_zone_id)


class WebsiteDnsCleanupProvider(dynamic.ResourceProvider):
    def _request(self, method: str, path: str, token: str) -> dict[str, Any]:
        request = urllib.request.Request(
            url=f"https://api.cloudflare.com/client/v4{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method=method,
        )
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(request, timeout=30, context=ssl_context) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if not payload.get("success"):
            raise RuntimeError(f"Cloudflare API request failed for {path}: {payload}")
        return payload

    def _list_records(self, zone_id_value: str, token: str, record_type: str, name: str) -> list[dict[str, Any]]:
        encoded_name = urllib.parse.quote(name, safe="")
        path = f"/zones/{zone_id_value}/dns_records?per_page=100&type={record_type}&name={encoded_name}"
        return self._request("GET", path, token).get("result", [])

    def _delete_record(self, zone_id_value: str, token: str, record_id: str) -> None:
        self._request("DELETE", f"/zones/{zone_id_value}/dns_records/{record_id}", token)

    def _resolve_zone_id(self, props: dict[str, Any], token: str) -> str:
        zone_id_value = props.get("zone_id")
        if zone_id_value:
            return zone_id_value

        encoded_domain = urllib.parse.quote(props["domain"], safe="")
        payload = self._request("GET", f"/zones?name={encoded_domain}&status=active", token)
        results = payload.get("result", [])
        if not results:
            raise RuntimeError(f"No active Cloudflare zone found for {props['domain']}")
        return results[0]["id"]

    def _sync(self, props: dict[str, Any]) -> dict[str, Any]:
        token = os.getenv("CLOUDFLARE_API_TOKEN")
        if not token:
            raise RuntimeError("CLOUDFLARE_API_TOKEN environment variable is required")

        zone_id_value = self._resolve_zone_id(props, token)
        domain_name = props["domain"]
        www_name = f"www.{domain_name}"
        removed_records: list[dict[str, Any]] = []

        for record in self._list_records(zone_id_value, token, "A", domain_name):
            if record.get("content") in props["github_pages_apex_ips"]:
                self._delete_record(zone_id_value, token, record["id"])
                removed_records.append(
                    {
                        "id": record["id"],
                        "type": record.get("type"),
                        "name": record.get("name"),
                        "content": record.get("content"),
                    }
                )

        old_www_target = str(props["github_pages_www_target"]).rstrip(".").lower()
        for record in self._list_records(zone_id_value, token, "CNAME", www_name):
            content = str(record.get("content", "")).rstrip(".").lower()
            if content == old_www_target:
                self._delete_record(zone_id_value, token, record["id"])
                removed_records.append(
                    {
                        "id": record["id"],
                        "type": record.get("type"),
                        "name": record.get("name"),
                        "content": record.get("content"),
                    }
                )

        outputs = dict(props)
        outputs["resolved_zone_id"] = zone_id_value
        outputs["removed_records"] = removed_records
        return outputs

    def create(self, props: dict[str, Any]) -> dynamic.CreateResult:
        outputs = self._sync(props)
        return dynamic.CreateResult(id_=f"{props['domain']}-website-cutover-cleanup", outs=outputs)

    def diff(self, _id: str, olds: dict[str, Any], news: dict[str, Any]) -> dynamic.DiffResult:
        changed = any(
            olds.get(key) != news.get(key)
            for key in ("domain", "zone_id", "github_pages_apex_ips", "github_pages_www_target")
        )
        return dynamic.DiffResult(changes=changed)

    def update(self, _id: str, _olds: dict[str, Any], news: dict[str, Any]) -> dynamic.UpdateResult:
        outputs = self._sync(news)
        return dynamic.UpdateResult(outs=outputs)


class WebsiteDnsCleanup(dynamic.Resource):
    removed_records: pulumi.Output[list[dict[str, Any]]]
    resolved_zone_id: pulumi.Output[str]

    def __init__(self, name: str, props: dict[str, Any], opts: pulumi.ResourceOptions | None = None) -> None:
        super().__init__(WebsiteDnsCleanupProvider(), name, props, opts)


cleanup = WebsiteDnsCleanup(
    "website-cutover-cleanup",
    {
        "domain": domain,
        "zone_id": zone_id,
        "github_pages_apex_ips": github_pages_apex_ips,
        "github_pages_www_target": github_pages_www_target,
    },
)

apex_validation = cloudflare.DnsRecord(
    "website-apex-validation-txt",
    zone_id=zone_id,
    name="@",
    type="TXT",
    content=validation_token,
    ttl=1,
    comment="Azure Static Web Apps apex validation record for atlanta-robotics.org",
    opts=pulumi.ResourceOptions(depends_on=[cleanup]),
)

apex_dnsauth_validation = cloudflare.DnsRecord(
    "website-apex-dnsauth-validation-txt",
    zone_id=zone_id,
    name="_dnsauth",
    type="TXT",
    content=validation_token,
    ttl=1,
    comment="Azure Static Web Apps apex TXT-token validation record for atlanta-robotics.org",
    opts=pulumi.ResourceOptions(depends_on=[cleanup]),
)

www_dnsauth_validation = cloudflare.DnsRecord(
    "website-www-dnsauth-validation-txt",
    zone_id=zone_id,
    name="_dnsauth.www",
    type="TXT",
    content=www_validation_token,
    ttl=1,
    comment="Azure Static Web Apps www TXT-token validation record for atlanta-robotics.org",
    opts=pulumi.ResourceOptions(depends_on=[cleanup]),
)

apex_cname = cloudflare.DnsRecord(
    "website-apex-cname",
    zone_id=zone_id,
    name="@",
    type="CNAME",
    content=azure_hostname,
    ttl=1,
    proxied=False,
    comment="Azure Static Web Apps apex cutover record for atlanta-robotics.org",
    opts=pulumi.ResourceOptions(depends_on=[cleanup]),
)

www_cname = cloudflare.DnsRecord(
    "website-www-cname",
    zone_id=zone_id,
    name="www",
    type="CNAME",
    content=azure_hostname,
    ttl=1,
    proxied=False,
    comment="Azure Static Web Apps www cutover record for atlanta-robotics.org",
    opts=pulumi.ResourceOptions(depends_on=[cleanup]),
)

pulumi.export("domain", domain)
pulumi.export(
    "plannedCreates",
    [
        {
            "type": "TXT",
            "name": "@",
            "content": validation_token,
            "ttl": "automatic",
            "proxied": False,
        },
        {
            "type": "TXT",
            "name": "_dnsauth",
            "content": validation_token,
            "ttl": "automatic",
            "proxied": False,
        },
        {
            "type": "TXT",
            "name": "_dnsauth.www",
            "content": www_validation_token,
            "ttl": "automatic",
            "proxied": False,
        },
        {
            "type": "CNAME",
            "name": "@",
            "content": azure_hostname,
            "ttl": "automatic",
            "proxied": False,
        },
        {
            "type": "CNAME",
            "name": "www",
            "content": azure_hostname,
            "ttl": "automatic",
            "proxied": False,
        },
    ],
)
pulumi.export(
    "plannedDeletes",
    [
        {"type": "A", "name": "@", "content": ip}
        for ip in github_pages_apex_ips
    ]
    + [
        {
            "type": "CNAME",
            "name": "www",
            "content": github_pages_www_target,
        }
    ],
)
pulumi.export(
    "managedRecordIds",
    [
        apex_validation.id,
        apex_dnsauth_validation.id,
        www_dnsauth_validation.id,
        apex_cname.id,
        www_cname.id,
    ],
)
