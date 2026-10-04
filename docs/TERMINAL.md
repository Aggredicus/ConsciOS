# Terminal design

ConsciOS exposes the same command language in Node and the browser.

## Native ConsciOS shell

```bash
node bin/conscios.mjs
```

Important commands:

```text
help
help score
man consciousness
run <observation>
status
score
metric list
trace
memory
linux start
```

Manual pages follow Unix conventions: NAME, SYNOPSIS, DESCRIPTION, EXAMPLES, SEE ALSO.

## Browser Linux

`linux start` can lazily boot Linux through v86, an x86-to-WebAssembly emulator. The VM is opt-in; no VM assets load until requested.

Rebuild 1 uses a serial console rather than a graphical desktop. This is lighter and better aligned with ConsciOS's command-first interface.

### Production note

The first adapter references public v86 development assets. A production release should self-host a reviewed, pinned v86 build, BIOS files, and minimal Linux image with recorded hashes.

The native ConsciOS shell remains available when VM startup is unsupported, slow, offline, or disabled.
