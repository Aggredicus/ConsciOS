# Repository Universe MCP

Rebuild 1 preserves the useful core of the earlier 4D repository/Development Landscape work without restoring the large viewer/runtime surface.

The canonical graph reader is `src/universe.mjs`.

It accepts:

- ConsciOS Development Landscape JSON;
- the earlier 4D codebase graph shape;
- generic `nodes[] + edges[]` graph JSON.

The intervention uses bounded searches from this module directly in the browser.

External agents can query the same graph through a read-only stdio MCP server:

```bash
CONSCIOS_UNIVERSE_FILE=/path/to/landscape.json node scripts/universe-mcp.mjs
```

Available tools:

- `universe_summary`
- `universe_search`
- `universe_neighborhood`

The server opens no network listener and has no repository write tool.

This preserves the earlier architectural rule:

```text
repository history + topology
          ↓
bounded UniverseModel
          ↓
task-relevant neighborhood
          ↓
model context
```

The full graph should not be injected into every inference.
