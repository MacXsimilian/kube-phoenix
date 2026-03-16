IMAGE      ?= ghcr.io/macxsimilian/kube-phoenix
TAG        ?= $(shell git rev-parse --short HEAD)
HELM_CHART ?= helm/kube-phoenix
HELM_RELEASE ?= kube-phoenix
HELM_NAMESPACE ?= kube-phoenix

.PHONY: frontend backend build docker-build copy-spec \
        helm-lint helm-template helm-install helm-upgrade helm-uninstall \
        dev dev-frontend dev-backend

# ── Development ──────────────────────────────────────────────────────────────

dev:
	docker compose up postgres -d
	@echo "Postgres ready at localhost:5432"
	@echo "Run 'make dev-backend' and 'make dev-frontend' in separate terminals"

dev-frontend:
	cd frontend && npm install && npm run dev

dev-backend:
	cd backend && DATABASE_URL="host=localhost user=kube_phoenix password=kube_phoenix dbname=kube_phoenix port=5432 sslmode=disable" go run ./cmd/server/...

# ── Build ─────────────────────────────────────────────────────────────────────

frontend:
	cd frontend && npm install && npm run build
	rm -rf backend/web/static
	cp -r frontend/out backend/web/static

copy-spec:
	cp openapi.yaml backend/internal/docs/openapi.yaml

backend: frontend copy-spec
	cd backend && go mod tidy && go build -o bin/kube-phoenix ./cmd/server/...

build: backend

# ── Docker ────────────────────────────────────────────────────────────────────

docker-build: frontend
	docker build -t $(IMAGE):$(TAG) -t $(IMAGE):latest .

# ── Helm ──────────────────────────────────────────────────────────────────────

helm-lint:
	helm lint $(HELM_CHART)

helm-template:
	helm template $(HELM_RELEASE) $(HELM_CHART) \
	  --namespace $(HELM_NAMESPACE) \
	  --create-namespace

helm-install:
	helm upgrade --install $(HELM_RELEASE) $(HELM_CHART) \
	  --namespace $(HELM_NAMESPACE) \
	  --create-namespace \
	  --set image.tag=$(TAG) \
	  $(HELM_VALUES)

helm-upgrade: helm-install

helm-uninstall:
	helm uninstall $(HELM_RELEASE) --namespace $(HELM_NAMESPACE)
