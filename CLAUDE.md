# CLAUDE.md - Project Instructions

## Deployment

This project deploys to Coolify at https://coolify.scrimvibes.xyz

For deployment instructions, reference the Coolify skill:
```
cat /home/cpape/clawd/skills/coolify/SKILL.md
```

### Quick Reference

**Coolify CLI:**
```bash
coolify server list              # List servers
coolify project list             # List projects
coolify app list                 # List applications
coolify deploy <app-uuid>        # Deploy an app
coolify app logs <app-uuid>      # View logs
```

**Chris's Setup:**
- Domain: `*.scrimvibes.xyz` (wildcard DNS)
- Server UUID: `mw80wg04w4g4swgs8g8k4c0g`
- Token: `/home/cpape/clawd/.secrets/coolify`

**Important:** Apps route through `blueprint-caddy` with a static Caddyfile at `/opt/blueprint/Caddyfile`. After deploying, you may need to update the Caddyfile with the new container name and reload Caddy.

See full skill at `/home/cpape/clawd/skills/coolify/SKILL.md` for complete deployment workflow.
