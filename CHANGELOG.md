# Changelog

All notable changes to Angular Doctor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-03-27

### Added

- **70+ ESLint rules** covering accessibility, security, NgRx patterns, Angular Material, and Signals
- **Parallel execution** - Lint and dead code detection now run concurrently via Promise.all
- **GitHub Actions CI integration** - PR comments with health score and top issues, score output for CI gating
- **Framework auto-detection** - Auto-toggles rules based on Angular version and detected packages
  - Signals rules enabled for Angular 17+
  - NgRx rules conditional on @ngrx presence
  - Angular Material rules conditional on @angular/material presence
- **Enhanced error visibility** - ESLint parse errors are now visible, not silently swallowed
- **Verbose output improvements** - File:line:column format, severity breakdown, clear visual separation
- **Diff mode documentation** - Users understand limitations (dead code detection skipped in diff mode)

### Changed

- **Rule expansion**: Angular Doctor expanded from ~18 rules to 70+ rules
- **Auto-disable rules**: New rules automatically disabled when related packages aren't present
- **Exit code handling**: Non-zero exit code when ESLint errors occur

### Fixed

- ESLint parse errors now appear in output
- Error count accurately reported in summary
- Verbose mode shows full error details

## [1.2.0] - 2026-03-27

### Added

- Initial stable release
- Basic Angular project health scoring
- ESLint integration with Angular-specific rules
- Dead code detection via Knip
- Markdown and console output formats
- Diff mode for PR-aware scanning

---

## [1.1.0] - 2026-03-27

### Added

- Early development version
- Proof of concept for Angular diagnostics
