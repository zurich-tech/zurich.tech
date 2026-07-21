set shell := ["bash", "-cu"]
set windows-shell := ["C:/Program Files/Git/bin/bash.exe", "-cu"]

_default:
    @just --list --unsorted

# build production output
build:
    bun run build

# format source
format:
    bun run format

# check source formatting
format-check:
    bun run format-check

# generate Convex types
generate:
    bun run convex:codegen

# type check source
typecheck:
    bun run typecheck

# run static checks
lint:
    just typecheck
    just build

# run tests
test:
    bun test

# default check
check:
    just check-full

# normal check
check-quick:
    just format-check
    just lint

# check with slow suites
check-full:
    just check-quick
    just test

# run dev server
dev:
    bun run dev

# clean build artifacts
clean:
    rm -rf .vinxi .output dist
