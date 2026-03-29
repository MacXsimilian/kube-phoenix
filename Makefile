IMAGE      ?= ghcr.io/macxsimilian/kube-phoenix
TAG        ?= $(shell git rev-parse --short HEAD)
PLATFORM   ?= linux/amd64
HELM_CHART ?= helm/kube-phoenix
HELM_RELEASE ?= kube-phoenix
HELM_NAMESPACE ?= kube-phoenix
# Extra Helm flags — e.g. HELM_VALUES="-f my-values.yaml" make helm-install
HELM_VALUES ?=

.DEFAULT_GOAL := help

.PHONY: help frontend backend build docker-build copy-spec test lint \
        helm-lint helm-template helm-install helm-upgrade helm-uninstall \
        dev dev-frontend dev-backend dev-mock \
        minikube-setup minikube-workloads minikube-teardown

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

dev-mock: ## Start frontend with mock API (no backend or cluster needed)
	cd frontend && npm install --silent && node mock-api/dev.mjs

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

docker-build: ## Build Docker image (PLATFORM=linux/amd64 by default)
	docker buildx build \
	  --platform $(PLATFORM) \
	  --build-arg NEXT_PUBLIC_APP_VERSION=$(TAG) \
	  --load \
	  -t $(IMAGE):$(TAG) \
	  -t $(IMAGE):latest \
	  .

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

# ── Local Cluster ────────────────────────────────────────────────────────────

minikube-setup: ## Provision minikube cluster, workloads, and deploy kube-phoenix
	./hack/minikube-setup.sh

minikube-workloads: ## Create sample workloads only (cluster must be running)
	./hack/minikube-setup.sh --workloads

minikube-teardown: ## Destroy minikube cluster
	./hack/minikube-setup.sh --teardown
