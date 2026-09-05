# VibesWAF

Selfhosted reverse proxy and WAF with real time dashboard, multi phase threat scoring and managed OWASP CRS rules built in Go.

<table>
  <tr>
    <td width="50%"><img src="screenshot/overview-dash.png" alt="Dashboard Overview" width="100%" /></td>
    <td width="50%"><img src="screenshot/overview-logs.png" alt="Logs Overview" width="100%" /></td>
  </tr>
</table>

<p align="center">Built in Go. Uses Coraza + OWASP CRS for managed rules, PostgreSQL for config, ClickHouse for logs, Redis for state.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.25+-00ADD8?logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/ClickHouse-F0F0F0?logo=clickhouse&logoColor=black" alt="ClickHouse" />
  <img src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Nginx-009639?logo=nginx&logoColor=white" alt="Nginx" />
</p>

---

## Features

See [FEATURES.md](docs/features.md) for a full list of features.

---

## Demo

Live demo at [vibeswaf.tailgo.com](https://vibeswaf.tailgo.com)
* user: `vibeswaf`
* pass: `vibeswaf`

> Runs in read-only mode for global config. Per-app settings are fully editable. 

>The public demo processes live Internet traffic. Dashboard analytics are generated from real requests and continuously evolve over time. Try sending requests to any *.tailgo.com subdomain to see them appear in the logs. 

> Backend: $14/year VPS (2 vCore, 4 GB RAM), Ubuntu 24.04.

---

## How it works

Nginx 1.30.4 handles TLS termination with dynamic SSL (no restart via [nginx-ssl-dynamic](https://github.com/iodesk/nginx-ssl-dynamic)) and JA4 fingerprinting via [ja4-nginx-module](https://github.com/iodesk/ja4-nginx-module). All WAF logic runs in Go.

```
Request -> Nginx 1.30.4 (SSL + JA4) -> Go WAF Pipeline -> Phase 1 (Hard Rules) -> Phase 2 (Scoring) -> Phase 3 (Decision) -> Phase 4 (Response) -> Upstream
```

[Pipeline flow](docs/pipeline-flow.md) | [Phase 1: Hard Rules](docs/phase1-hard-rules.md) | [Phase 2: Scoring](docs/phase2-scoring.md) | [Phase 3: Decision](docs/phase3-decision.md) | [Challenge Trust Levels](docs/challenge-trust-levels.md)

---

## Dashboard

Web UI managing all configuration  applications, security rules, rate limiter, bot detector, WAF engine, IP reputation, scoring engine, logs, and analytics.

[`Apps`](screenshot/2.%20App-basic.png) [`Security Rules`](screenshot/2.%20App-security-rules.png) [`Rate Limiter`](screenshot/4.%20Rate%20limiter%20-%20Food%20protection.png) [`Bot Detector`](screenshot/5.%20Bot%20Detector.png) [`WAF`](screenshot/3.%20Waf%20Settings.png) [`IP Reputation`](screenshot/6.%20IP%20Reputation.png) [`Scoring`](screenshot/8.%20Scoring.png) [`Logs`](screenshot/10.%20Logs.png) [`Analytics`](screenshot/12.%20Threat%20Inteligence.png)

---

## Stack

| Component | Role |
|---|---|
| Go | Core proxy + pipeline |
| Nginx 1.30.4 | TLS termination, JA4/JA4S/JA4H fingerprinting via [ja4-nginx-module](https://github.com/iodesk/ja4-nginx-module), dynamic SSL via [nginx-ssl-dynamic](https://github.com/iodesk/nginx-ssl-dynamic) |
| Coraza + OWASP CRS | Managed WAF rules |
| PostgreSQL | Config storage |
| ClickHouse | Request logs + analytics |
| Redis | Rate limit, challenge store, trust history |
| React + Vite | Dashboard |

---

## Setup

```sh
cp .env.example .env && ./vibeswaf     # backend
cd frontend && cp .env.example .env && bun install && bun run build  # frontend
```

See `config/` for nginx, systemd, and ACME scripts.

---
