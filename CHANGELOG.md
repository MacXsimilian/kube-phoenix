# Changelog

## [0.1.9](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.8...v0.1.9) (2026-03-13)


### Features

* **frontend:** UX improvements and README overhaul ([3df37a8](https://github.com/MacXsimilian/kube-phoenix/commit/3df37a82997c23e90fe0362716f2e0f29e2ad84c))
* **helm:** add TargetGroupBinding support for EKS ALB integration ([1c7ca65](https://github.com/MacXsimilian/kube-phoenix/commit/1c7ca653070b2501a415ccc97518fd187c884d1d))
* **overview:** next-run countdown, partial state, deep-link activity feed ([187aaf3](https://github.com/MacXsimilian/kube-phoenix/commit/187aaf34b6a4d784a73fb3680b259d008065478d))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([fad27c6](https://github.com/MacXsimilian/kube-phoenix/commit/fad27c61c1d46163fe9829bc292574c6b89beec7))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([08eae58](https://github.com/MacXsimilian/kube-phoenix/commit/08eae58922854dbb4dc4ae3a8755f5462cf74ecd))
* check json.Encode error in createSchedule 201 response ([0708228](https://github.com/MacXsimilian/kube-phoenix/commit/0708228e6f2888b001b8a4efcbe469e523466084))
* grant packages: write at workflow level for reusable docker workflow ([74430cd](https://github.com/MacXsimilian/kube-phoenix/commit/74430cdae1f5a5c2e5b6ef91c718afea19aef014))
* **helm:** address chart audit findings ([5fe6857](https://github.com/MacXsimilian/kube-phoenix/commit/5fe6857c81331a4289eef072104a509ff3d9e707))
* lowercase GHCR owner for OCI Helm chart push ([1aaf651](https://github.com/MacXsimilian/kube-phoenix/commit/1aaf6510d912e56d4d9e3042c394ffd953217c4f))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([bedec7c](https://github.com/MacXsimilian/kube-phoenix/commit/bedec7c0c8915d7921c0bcecdc28ecdd77611d63))
* migrate release-please to googleapis/release-please-action v4.4.0 ([fee5963](https://github.com/MacXsimilian/kube-phoenix/commit/fee596338bfaf6ba1d5b54c39a921b3ab913d10a))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([86a3893](https://github.com/MacXsimilian/kube-phoenix/commit/86a3893243af5b33ace27f0d207cd918c063ebaf))
* remove npm cache — no package-lock.json in repo ([6acf4d7](https://github.com/MacXsimilian/kube-phoenix/commit/6acf4d7e372a7c28e30c6a8c773b2187361a778d))
* replace release-please action with npx CLI to avoid action policy restriction ([e98ce3e](https://github.com/MacXsimilian/kube-phoenix/commit/e98ce3e5a88de8d07e0af49a303e17166139c986))
* resolve all errcheck lint findings ([bf65046](https://github.com/MacXsimilian/kube-phoenix/commit/bf650460201b120d38ccf4524343854d1dcb589e))
* resolve frontend and backend CI build failures ([1f19da7](https://github.com/MacXsimilian/kube-phoenix/commit/1f19da7b1f68d0f9b755a4cbe40d935165123da8))
* resolve next.config.ts and go embed CI failures ([a26d6ac](https://github.com/MacXsimilian/kube-phoenix/commit/a26d6ac31eff5aedba55b909fdb02214faf9bc79))
* resolve TypeScript and go vet CI failures ([de83d86](https://github.com/MacXsimilian/kube-phoenix/commit/de83d8676e39c52156468de1602fdef9f9fecefe))
* restore release-please action now that policy allows google-github-actions/* ([d898de8](https://github.com/MacXsimilian/kube-phoenix/commit/d898de8866691ab94225e2fc1f5d55ac715f5961))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([0b60829](https://github.com/MacXsimilian/kube-phoenix/commit/0b60829167d48648534bf34283cfd6f8718445b7))
* **scheduler:** detach manual trigger from HTTP request context ([2310a84](https://github.com/MacXsimilian/kube-phoenix/commit/2310a84c701f157c72eb35062729bd10be03fab3))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([2b2016b](https://github.com/MacXsimilian/kube-phoenix/commit/2b2016b49a662424275d1b7c7e082d9b146017e2))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([a3c2acc](https://github.com/MacXsimilian/kube-phoenix/commit/a3c2acce1265327cf6d786008a9f335590b5842a))
* use npm install in Dockerfile (no package-lock.json) ([81a9f9c](https://github.com/MacXsimilian/kube-phoenix/commit/81a9f9c90b3e0678d611b90e1657d9e5ccd460e2))

## [0.1.8](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.7...v0.1.8) (2026-03-12)


### Features

* **helm:** add TargetGroupBinding support for EKS ALB integration ([2c591bd](https://github.com/MacXsimilian/kube-phoenix/commit/2c591bd7c9487d9945052de177231aa0986333c7))
* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([5d5a3e9](https://github.com/MacXsimilian/kube-phoenix/commit/5d5a3e9f205dc99c035b6bff9d30541f6bcdd38e))
* check json.Encode error in createSchedule 201 response ([ff6d5b5](https://github.com/MacXsimilian/kube-phoenix/commit/ff6d5b527fcd57d480a18c38b1289b7f7ad1d86f))
* grant packages: write at workflow level for reusable docker workflow ([0c8dc31](https://github.com/MacXsimilian/kube-phoenix/commit/0c8dc31fc0e240c633a93072acfc3a4bf9faf7ec))
* lowercase GHCR owner for OCI Helm chart push ([aee864d](https://github.com/MacXsimilian/kube-phoenix/commit/aee864db32b5b389a369100473adc41a1e7991d5))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([6699279](https://github.com/MacXsimilian/kube-phoenix/commit/66992796599c435f40f05e809152ed80fa3a493c))
* migrate release-please to googleapis/release-please-action v4.4.0 ([a234f01](https://github.com/MacXsimilian/kube-phoenix/commit/a234f011a2f2e4497aa20ced92b8c9eefeb38e25))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([d0bed15](https://github.com/MacXsimilian/kube-phoenix/commit/d0bed1579e50a5dd3fad8efa76775f37d4aa6ddd))
* remove npm cache — no package-lock.json in repo ([7e64632](https://github.com/MacXsimilian/kube-phoenix/commit/7e646324c7ee9317872e511dfc9fe55eab7f2be8))
* replace release-please action with npx CLI to avoid action policy restriction ([d8816b7](https://github.com/MacXsimilian/kube-phoenix/commit/d8816b74e6f484e13bd7ed2dff76d9a68dc2f150))
* resolve all errcheck lint findings ([af19078](https://github.com/MacXsimilian/kube-phoenix/commit/af19078dcc68cb358c98632d12785a1085e27f4d))
* resolve frontend and backend CI build failures ([d8fd31a](https://github.com/MacXsimilian/kube-phoenix/commit/d8fd31a5190911b68d5df85233218119924166c2))
* resolve next.config.ts and go embed CI failures ([03b539d](https://github.com/MacXsimilian/kube-phoenix/commit/03b539dc2411ee2b912a9b42154b59489d41f1cb))
* resolve TypeScript and go vet CI failures ([fa31876](https://github.com/MacXsimilian/kube-phoenix/commit/fa31876804731402ca5eecf3bacc211d19c53815))
* restore release-please action now that policy allows google-github-actions/* ([5d8a79e](https://github.com/MacXsimilian/kube-phoenix/commit/5d8a79ef7389a759db6bb9488a00335c9e5da27c))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))
* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([8ee3f3c](https://github.com/MacXsimilian/kube-phoenix/commit/8ee3f3cd629c49b09f3ca0699b32ccc709b3e80d))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([9acb1d1](https://github.com/MacXsimilian/kube-phoenix/commit/9acb1d11ba8aa6296107bcc314c91ce7255b7622))
* use npm install in Dockerfile (no package-lock.json) ([dc39d66](https://github.com/MacXsimilian/kube-phoenix/commit/dc39d66e0eb84c3a108690f987b46ca656931719))

## [0.1.7](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.6...v0.1.7) (2026-03-12)


### Features

* **helm:** add TargetGroupBinding support for EKS ALB integration ([2c591bd](https://github.com/MacXsimilian/kube-phoenix/commit/2c591bd7c9487d9945052de177231aa0986333c7))
* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([5d5a3e9](https://github.com/MacXsimilian/kube-phoenix/commit/5d5a3e9f205dc99c035b6bff9d30541f6bcdd38e))
* check json.Encode error in createSchedule 201 response ([ff6d5b5](https://github.com/MacXsimilian/kube-phoenix/commit/ff6d5b527fcd57d480a18c38b1289b7f7ad1d86f))
* grant packages: write at workflow level for reusable docker workflow ([0c8dc31](https://github.com/MacXsimilian/kube-phoenix/commit/0c8dc31fc0e240c633a93072acfc3a4bf9faf7ec))
* lowercase GHCR owner for OCI Helm chart push ([aee864d](https://github.com/MacXsimilian/kube-phoenix/commit/aee864db32b5b389a369100473adc41a1e7991d5))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([6699279](https://github.com/MacXsimilian/kube-phoenix/commit/66992796599c435f40f05e809152ed80fa3a493c))
* migrate release-please to googleapis/release-please-action v4.4.0 ([a234f01](https://github.com/MacXsimilian/kube-phoenix/commit/a234f011a2f2e4497aa20ced92b8c9eefeb38e25))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([d0bed15](https://github.com/MacXsimilian/kube-phoenix/commit/d0bed1579e50a5dd3fad8efa76775f37d4aa6ddd))
* remove npm cache — no package-lock.json in repo ([7e64632](https://github.com/MacXsimilian/kube-phoenix/commit/7e646324c7ee9317872e511dfc9fe55eab7f2be8))
* replace release-please action with npx CLI to avoid action policy restriction ([d8816b7](https://github.com/MacXsimilian/kube-phoenix/commit/d8816b74e6f484e13bd7ed2dff76d9a68dc2f150))
* resolve all errcheck lint findings ([af19078](https://github.com/MacXsimilian/kube-phoenix/commit/af19078dcc68cb358c98632d12785a1085e27f4d))
* resolve frontend and backend CI build failures ([d8fd31a](https://github.com/MacXsimilian/kube-phoenix/commit/d8fd31a5190911b68d5df85233218119924166c2))
* resolve next.config.ts and go embed CI failures ([03b539d](https://github.com/MacXsimilian/kube-phoenix/commit/03b539dc2411ee2b912a9b42154b59489d41f1cb))
* resolve TypeScript and go vet CI failures ([fa31876](https://github.com/MacXsimilian/kube-phoenix/commit/fa31876804731402ca5eecf3bacc211d19c53815))
* restore release-please action now that policy allows google-github-actions/* ([5d8a79e](https://github.com/MacXsimilian/kube-phoenix/commit/5d8a79ef7389a759db6bb9488a00335c9e5da27c))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))
* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([8ee3f3c](https://github.com/MacXsimilian/kube-phoenix/commit/8ee3f3cd629c49b09f3ca0699b32ccc709b3e80d))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([9acb1d1](https://github.com/MacXsimilian/kube-phoenix/commit/9acb1d11ba8aa6296107bcc314c91ce7255b7622))
* use npm install in Dockerfile (no package-lock.json) ([dc39d66](https://github.com/MacXsimilian/kube-phoenix/commit/dc39d66e0eb84c3a108690f987b46ca656931719))

## [0.1.6](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.5...v0.1.6) (2026-03-12)


### Features

* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))

## [0.1.5](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.4...v0.1.5) (2026-03-12)


### Features

* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([5d5a3e9](https://github.com/MacXsimilian/kube-phoenix/commit/5d5a3e9f205dc99c035b6bff9d30541f6bcdd38e))
* check json.Encode error in createSchedule 201 response ([ff6d5b5](https://github.com/MacXsimilian/kube-phoenix/commit/ff6d5b527fcd57d480a18c38b1289b7f7ad1d86f))
* grant packages: write at workflow level for reusable docker workflow ([0c8dc31](https://github.com/MacXsimilian/kube-phoenix/commit/0c8dc31fc0e240c633a93072acfc3a4bf9faf7ec))
* lowercase GHCR owner for OCI Helm chart push ([aee864d](https://github.com/MacXsimilian/kube-phoenix/commit/aee864db32b5b389a369100473adc41a1e7991d5))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([6699279](https://github.com/MacXsimilian/kube-phoenix/commit/66992796599c435f40f05e809152ed80fa3a493c))
* migrate release-please to googleapis/release-please-action v4.4.0 ([a234f01](https://github.com/MacXsimilian/kube-phoenix/commit/a234f011a2f2e4497aa20ced92b8c9eefeb38e25))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([d0bed15](https://github.com/MacXsimilian/kube-phoenix/commit/d0bed1579e50a5dd3fad8efa76775f37d4aa6ddd))
* remove npm cache — no package-lock.json in repo ([7e64632](https://github.com/MacXsimilian/kube-phoenix/commit/7e646324c7ee9317872e511dfc9fe55eab7f2be8))
* replace release-please action with npx CLI to avoid action policy restriction ([d8816b7](https://github.com/MacXsimilian/kube-phoenix/commit/d8816b74e6f484e13bd7ed2dff76d9a68dc2f150))
* resolve all errcheck lint findings ([af19078](https://github.com/MacXsimilian/kube-phoenix/commit/af19078dcc68cb358c98632d12785a1085e27f4d))
* resolve frontend and backend CI build failures ([d8fd31a](https://github.com/MacXsimilian/kube-phoenix/commit/d8fd31a5190911b68d5df85233218119924166c2))
* resolve next.config.ts and go embed CI failures ([03b539d](https://github.com/MacXsimilian/kube-phoenix/commit/03b539dc2411ee2b912a9b42154b59489d41f1cb))
* resolve TypeScript and go vet CI failures ([fa31876](https://github.com/MacXsimilian/kube-phoenix/commit/fa31876804731402ca5eecf3bacc211d19c53815))
* restore release-please action now that policy allows google-github-actions/* ([5d8a79e](https://github.com/MacXsimilian/kube-phoenix/commit/5d8a79ef7389a759db6bb9488a00335c9e5da27c))
* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))
* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([8ee3f3c](https://github.com/MacXsimilian/kube-phoenix/commit/8ee3f3cd629c49b09f3ca0699b32ccc709b3e80d))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([9acb1d1](https://github.com/MacXsimilian/kube-phoenix/commit/9acb1d11ba8aa6296107bcc314c91ce7255b7622))
* use npm install in Dockerfile (no package-lock.json) ([dc39d66](https://github.com/MacXsimilian/kube-phoenix/commit/dc39d66e0eb84c3a108690f987b46ca656931719))

## [0.1.4](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.3...v0.1.4) (2026-03-12)


### Features

* **overview:** next-run countdown, partial state, deep-link activity feed ([24a63ed](https://github.com/MacXsimilian/kube-phoenix/commit/24a63ed037bea856e50a2cd6f8fa31e6dfda79fd))
* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))

## [0.1.3](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.2...v0.1.3) (2026-03-12)


### Features

* **ui:** replace AutoAwesome icon with phoenix SVG icon ([b568d21](https://github.com/MacXsimilian/kube-phoenix/commit/b568d2127d6390bb2b77baf0f548faf4824da637))


### Bug Fixes

* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))
* **scheduler:** detach manual trigger from HTTP request context ([96bd2d7](https://github.com/MacXsimilian/kube-phoenix/commit/96bd2d7bb8498cfb320f6a5a830f56f0915bfb0e))

## [0.1.2](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.1...v0.1.2) (2026-03-12)


### Bug Fixes

* **router:** move BasicAuth middleware before routes to prevent chi panic ([20ddc48](https://github.com/MacXsimilian/kube-phoenix/commit/20ddc4836e58266ff869fc2b8ce351e1250b24e4))

## [0.1.1](https://github.com/MacXsimilian/kube-phoenix/compare/v0.1.0...v0.1.1) (2026-03-12)


### Bug Fixes

* audit fixes — slog, execution timeout, annotation parsing, DB index, security context, node drain ([5d5a3e9](https://github.com/MacXsimilian/kube-phoenix/commit/5d5a3e9f205dc99c035b6bff9d30541f6bcdd38e))
* check json.Encode error in createSchedule 201 response ([ff6d5b5](https://github.com/MacXsimilian/kube-phoenix/commit/ff6d5b527fcd57d480a18c38b1289b7f7ad1d86f))
* grant packages: write at workflow level for reusable docker workflow ([0c8dc31](https://github.com/MacXsimilian/kube-phoenix/commit/0c8dc31fc0e240c633a93072acfc3a4bf9faf7ec))
* lowercase GHCR owner for OCI Helm chart push ([aee864d](https://github.com/MacXsimilian/kube-phoenix/commit/aee864db32b5b389a369100473adc41a1e7991d5))
* lowercase image name in docker-merge, trivy, and reusable build workflow ([6699279](https://github.com/MacXsimilian/kube-phoenix/commit/66992796599c435f40f05e809152ed80fa3a493c))
* migrate release-please to googleapis/release-please-action v4.4.0 ([a234f01](https://github.com/MacXsimilian/kube-phoenix/commit/a234f011a2f2e4497aa20ced92b8c9eefeb38e25))
* P1 audit — DB pool, indexes, slog, skipped counter, type immutability, WebSocket read pump, request ID, CORS ([d0bed15](https://github.com/MacXsimilian/kube-phoenix/commit/d0bed1579e50a5dd3fad8efa76775f37d4aa6ddd))
* remove npm cache — no package-lock.json in repo ([7e64632](https://github.com/MacXsimilian/kube-phoenix/commit/7e646324c7ee9317872e511dfc9fe55eab7f2be8))
* replace release-please action with npx CLI to avoid action policy restriction ([d8816b7](https://github.com/MacXsimilian/kube-phoenix/commit/d8816b74e6f484e13bd7ed2dff76d9a68dc2f150))
* resolve all errcheck lint findings ([af19078](https://github.com/MacXsimilian/kube-phoenix/commit/af19078dcc68cb358c98632d12785a1085e27f4d))
* resolve frontend and backend CI build failures ([d8fd31a](https://github.com/MacXsimilian/kube-phoenix/commit/d8fd31a5190911b68d5df85233218119924166c2))
* resolve next.config.ts and go embed CI failures ([03b539d](https://github.com/MacXsimilian/kube-phoenix/commit/03b539dc2411ee2b912a9b42154b59489d41f1cb))
* resolve TypeScript and go vet CI failures ([fa31876](https://github.com/MacXsimilian/kube-phoenix/commit/fa31876804731402ca5eecf3bacc211d19c53815))
* restore release-please action now that policy allows google-github-actions/* ([5d8a79e](https://github.com/MacXsimilian/kube-phoenix/commit/5d8a79ef7389a759db6bb9488a00335c9e5da27c))
* upgrade golangci-lint to v2.9.0 for Go 1.25 compatibility ([8ee3f3c](https://github.com/MacXsimilian/kube-phoenix/commit/8ee3f3cd629c49b09f3ca0699b32ccc709b3e80d))
* upgrade golangci-lint-action to v7 for golangci-lint v2 support ([9acb1d1](https://github.com/MacXsimilian/kube-phoenix/commit/9acb1d11ba8aa6296107bcc314c91ce7255b7622))
* use npm install in Dockerfile (no package-lock.json) ([dc39d66](https://github.com/MacXsimilian/kube-phoenix/commit/dc39d66e0eb84c3a108690f987b46ca656931719))
