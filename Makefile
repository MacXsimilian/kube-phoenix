IMAGE      ?= ghcr.io/macxsimilian/kube-phoenix
TAG        ?= $(shell git rev-parse --short HEAD)
HELM_CHART ?= helm/kube-phoenix
HELM_RELEASE ?= kube-phoenix
HELM_NAMESPACE ?= kube-phoenix
# Extra Helm flags — e.g. HELM_VALUES="-f my-values.yaml" make helm-install
HELM_VALUES ?=

.DEFAULT_GOAL := help

.PHONY: help frontend backend build docker-build copy-spec test lint \
        helm-lint helm-template helm-install helm-upgrade helm-uninstall \
        dev dev-frontend dev-backend

# ── Help ─────────────────────────────────────────────────────────────────────

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Development ──────────────────────────────────────────────────────────────

dev: ## Start local PostgreSQL via docker compose
	docker compose up postgres -d
	@echo "Postgres ready at localhost:5432"
	@echo "Run 'make dev-backend' and 'make dev-frontend' in separate terminals"

dev-frontend: ## Start frontend dev server (Next.js)
	cd frontend && npm install && npm run dev

dev-backend: copy-spec ## Start backend dev server (Go)
	cd backend && DATABASE_URL="host=localhost user=kube_phoenix password=kube_phoenix dbname=kube_phoenix port=5432 sslmode=disable" go run ./cmd/server/...

# ── Build ─────────────────────────────────────────────────────────────────────

frontend: ## Build frontend and copy to backend/web/static
	cd frontend && npm install && npm run build
	rm -rf backend/web/static
	cp -r frontend/out backend/web/static

copy-spec: ## Copy openapi.yaml to backend/internal/docs
	cp openapi.yaml backend/internal/docs/openapi.yaml

backend: frontend copy-spec ## Build Go binary (includes frontend)
	cd backend && go mod tidy && go build -o bin/kube-phoenix ./cmd/server/...

build: backend ## Full production build

# ── Test & Lint ──────────────────────────────────────────────────────────────

test: ## Run backend tests
	cd backend && go test ./...

lint: ## Run backend linter (requires golangci-lint v2)
	cd backend && golangci-lint run

# ── Docker ────────────────────────────────────────────────────────────────────

docker-build: frontend ## Build Docker image
	docker build -t $(IMAGE):$(TAG) -t $(IMAGE):latest .

# ── Helm ──────────────────────────────────────────────────────────────────────

helm-lint: ## Lint Helm chart
	helm lint $(HELM_CHART)

helm-template: ## Render Helm templates locally
	helm template $(HELM_RELEASE) $(HELM_CHART) \
	  --namespace $(HELM_NAMESPACE) \
	  --create-namespace

helm-install: ## Install or upgrade Helm release
	helm upgrade --install $(HELM_RELEASE) $(HELM_CHART) \
	  --namespace $(HELM_NAMESPACE) \
	  --create-namespace \
	  --set image.tag=$(TAG) \
	  $(HELM_VALUES)

helm-upgrade: helm-install ## Alias for helm-install

helm-uninstall: ## Uninstall Helm release
	helm uninstall $(HELM_RELEASE) --namespace $(HELM_NAMESPACE)
