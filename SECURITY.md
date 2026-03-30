# Security Policy

## Reporting a Vulnerability

- Do not open public issues for security vulnerabilities.
- Report privately to the project owner with:
  - impacted endpoint/component
  - reproduction steps
  - potential impact
  - suggested fix (if available)

## Supported Versions

- Only the latest deployed version is supported for security fixes.

## Security Baseline

- Secrets must be stored in environment variables or a secret manager.
- `JWT_SECRET` must be at least 32 characters.
- Production builds must use lockfile enforcement.
- RLS policies must follow least privilege.
- Security-sensitive endpoints must have authorization checks and audit logs.
