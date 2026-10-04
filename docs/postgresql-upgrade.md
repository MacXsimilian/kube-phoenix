# PostgreSQL 17 to 18 Migration

The bundled Compose and Helm databases now default to PostgreSQL 18.6. PostgreSQL 18 uses `PGDATA=/var/lib/postgresql/18/docker` with the volume mounted at `/var/lib/postgresql`; previous installations used a PostgreSQL 17 data directory under `/var/lib/postgresql/data`. An image change cannot upgrade that data. The chart and official image refuse old data instead of initializing a replacement database on the same volume. See the [official image's storage layout](https://hub.docker.com/_/postgres#pgdata) and [PostgreSQL's upgrade procedures](https://www.postgresql.org/docs/18/upgrading.html).

This guide uses a logical dump and restore into fresh storage. Keep the original PostgreSQL 17 volume, its credentials, and the previous application/chart configuration until the migration is accepted. External PostgreSQL 14+ remains supported; upgrade managed databases through their provider's procedure.

## Before starting

- Schedule a maintenance window. Stop every kube-phoenix backend and any other database writers before the final dump. A running backend can execute scheduled policies and write migration or bootstrap data.
- Suspend GitOps reconciliation, autoscalers, and any process that could restart the application during maintenance. A host process started with `make dev-backend` or another standalone command must also be stopped.
- Save backups outside the repository on durable storage with restricted access. Database dumps, globals, resolved Compose files, and Helm values can contain credentials or user data.
- Rehearse the restore into a disposable PostgreSQL 18 instance before production. Listing an archive's contents alone does not verify that all data restores successfully.

The commands below cover the default single application database with the same `POSTGRES_USER` and `POSTGRES_DB` on both versions. `pg_dump` includes all application tables and sequences. Cluster-wide roles are saved separately for review; do not blindly restore `globals.sql`, because the new image already creates the bootstrap role. If you added other roles, databases, extensions, or tablespaces, plan their migration and required PostgreSQL 18 packages separately. The restore uses [`pg_restore --no-owner --single-transaction`](https://www.postgresql.org/docs/18/app-pgrestore.html) against the fresh database created by the image.

## Docker Compose

### 1. Stop writers and back up PostgreSQL 17

Run this part from the previous checkout/configuration while the PostgreSQL 17 container still works. Preserve any Compose override files and environment files as well as the resolved configuration. Replace the backup location if your home directory is not durable storage.

```bash
set -e
umask 077
PG_BACKUP="$HOME/kube-phoenix-pg17-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PG_BACKUP"
docker compose config > "$PG_BACKUP/compose-pg17.yaml"
DB_CONTAINER=$(docker compose ps -q postgres)
COMPOSE_PROJECT=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$DB_CONTAINER")
docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$DB_CONTAINER" > "$PG_BACKUP/volume-name.txt"
docker compose stop backend
```

Stop any backend running outside Compose too. Confirm the recorded volume name matches the original database volume. With writers stopped, take the final dump and save the archive catalogue:

```bash
docker compose exec -T postgres sh -ec 'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' > "$PG_BACKUP/kube-phoenix.dump"
docker compose exec -T postgres sh -ec 'exec pg_dumpall --username="$POSTGRES_USER" --globals-only' > "$PG_BACKUP/globals.sql"
docker compose exec -T postgres pg_restore --list < "$PG_BACKUP/kube-phoenix.dump" > "$PG_BACKUP/archive-list.txt"
docker compose exec -T postgres sh -ec 'exec psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --set=ON_ERROR_STOP=1 --csv --command="SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM policies) AS policies, (SELECT count(*) FROM workload_snapshots) AS snapshots, (SELECT count(*) FROM policy_executions) AS executions"' > "$PG_BACKUP/counts-pg17.csv"
docker compose stop postgres
```

Check every command's exit status before continuing. Retain the original named volume; do not run `docker compose down -v` or prune volumes during migration.

### 2. Start PostgreSQL 18 on a fresh volume

Switch to the updated checkout. Create a persistent local override `compose-pg18.yaml`:

```yaml
services:
  postgres:
    volumes:
      - postgres18-data:/var/lib/postgresql
volumes:
  postgres18-data: {}
```

Choose a new volume name if `${COMPOSE_PROJECT}_postgres18-data` already exists. Keep the original database credentials. The matching mount target replaces the base file's database mount during Compose merging, while the old volume stays untouched. Use the same project name and both files for every future Compose command:

```bash
docker compose --project-name "$COMPOSE_PROJECT" -f docker-compose.yml -f compose-pg18.yaml up -d --wait postgres
```

Only PostgreSQL should be running at this point. Its TCP health check waits for the final server, rather than the temporary server used during initialization. Restore and collect planner statistics:

```bash
docker compose --project-name "$COMPOSE_PROJECT" -f docker-compose.yml -f compose-pg18.yaml exec -T postgres sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_restore --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-owner --exit-on-error --single-transaction' < "$PG_BACKUP/kube-phoenix.dump"
docker compose --project-name "$COMPOSE_PROJECT" -f docker-compose.yml -f compose-pg18.yaml exec -T postgres sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec vacuumdb --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --analyze-in-stages'
docker compose --project-name "$COMPOSE_PROJECT" -f docker-compose.yml -f compose-pg18.yaml exec -T postgres sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --set=ON_ERROR_STOP=1 --command="SHOW server_version"'
docker compose --project-name "$COMPOSE_PROJECT" -f docker-compose.yml -f compose-pg18.yaml exec -T postgres sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --set=ON_ERROR_STOP=1 --csv --command="SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM policies) AS policies, (SELECT count(*) FROM workload_snapshots) AS snapshots, (SELECT count(*) FROM policy_executions) AS executions"' > "$PG_BACKUP/counts-pg18.csv"
diff -u "$PG_BACKUP/counts-pg17.csv" "$PG_BACKUP/counts-pg18.csv"
```

The saved account, policy, snapshot, and execution counts must match. Also compare important policy and recovery records with a baseline saved before migration; adjust the count query if an older application version used different tables. After the restore and checks succeed, start the backend using the same override:

```bash
docker compose --project-name "$COMPOSE_PROJECT" -f docker-compose.yml -f compose-pg18.yaml up -d --build backend
```

Verify health, login, policy state, and retained snapshots before ending maintenance. Keep using `compose-pg18.yaml`; omitting it selects the base file's original volume and the old-data guard will stop PostgreSQL.

### Compose rollback

Before accepting new application writes, stop both services using the PostgreSQL 18 files. Return to the previous application checkout and use the saved PostgreSQL 17 configuration with the same Compose project:

```bash
docker compose --project-name "$COMPOSE_PROJECT" -f docker-compose.yml -f compose-pg18.yaml stop backend postgres
# Return to the previous application checkout/configuration before continuing.
docker compose --project-name "$COMPOSE_PROJECT" -f "$PG_BACKUP/compose-pg17.yaml" up -d --wait postgres
docker compose --project-name "$COMPOSE_PROJECT" -f "$PG_BACKUP/compose-pg17.yaml" up -d --build backend
```

Confirm that the saved configuration still mounts the recorded PostgreSQL 17 volume. Keep the PostgreSQL 18 volume for investigation. Never mount the PostgreSQL 18 data directory into PostgreSQL 17 or attempt to restore a PostgreSQL 18 dump into 17. Once new writes have been accepted, the retained 17 database is stale; reverting requires a separate data reconciliation plan.

## Helm

The example uses release and namespace `kube-phoenix` with the default resource names. Adapt `APP`, `DB`, and `OLD_PVC` for name overrides or a different release. Switching from a generated claim to `existingClaim` changes the StatefulSet's immutable storage configuration, so the database StatefulSet must be stopped and recreated. The old PVC is retained throughout.

### 1. Save the old release and stop writers

Run this part while the old PostgreSQL 17 release is still healthy. Record the previous chart version from `helm history` and download that exact chart for rollback. Preserve all deployment-specific values and Secret credentials.

```bash
set -e
umask 077
PG_BACKUP="$HOME/kube-phoenix-pg17-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$PG_BACKUP"
RELEASE=kube-phoenix
NS=kube-phoenix
APP=kube-phoenix
DB=kube-phoenix-postgresql
DB_POD="$DB-0"
OLD_PVC=data-kube-phoenix-postgresql-0
helm history "$RELEASE" -n "$NS"
helm get values "$RELEASE" -n "$NS" -o yaml > "$PG_BACKUP/values-pg17.yaml"
helm get manifest "$RELEASE" -n "$NS" > "$PG_BACKUP/manifest-pg17.yaml"
kubectl get pvc "$OLD_PVC" -n "$NS" -o yaml > "$PG_BACKUP/pvc-pg17.yaml"
helm pull oci://ghcr.io/macxsimilian/helm/kube-phoenix --version '<previous-chart-version>' --destination "$PG_BACKUP"
```

Inspect the database pod's volume claim before proceeding; it must match `OLD_PVC`. Suspend reconciliation and autoscaling, then scale the application down and wait for its existing pods to finish:

```bash
APP_SELECTOR=$(kubectl get deployment "$APP" -n "$NS" -o go-template='{{range $key, $value := .spec.selector.matchLabels}}{{$key}}={{$value}},{{end}}')
APP_SELECTOR="${APP_SELECTOR%,}"
kubectl scale deployment "$APP" -n "$NS" --replicas=0
kubectl rollout status deployment/"$APP" -n "$NS" --timeout=5m
APP_PODS=$(kubectl get pods -n "$NS" -l "$APP_SELECTOR" -o name)
if [ -n "$APP_PODS" ]; then
  kubectl wait --for=delete --timeout=5m -n "$NS" $APP_PODS
fi
APP_PODS=$(kubectl get pods -n "$NS" -l "$APP_SELECTOR" -o name)
test -z "$APP_PODS"
```

Stop any other database writers too. Keep `replicaCount: 0` in every Helm upgrade until the restore is verified. Take the final dump while PostgreSQL 17 is still running:

```bash
kubectl exec -n "$NS" "$DB_POD" -c postgresql -- sh -ec 'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' > "$PG_BACKUP/kube-phoenix.dump"
kubectl exec -n "$NS" "$DB_POD" -c postgresql -- sh -ec 'exec pg_dumpall --username="$POSTGRES_USER" --globals-only' > "$PG_BACKUP/globals.sql"
kubectl exec -i -n "$NS" "$DB_POD" -c postgresql -- pg_restore --list < "$PG_BACKUP/kube-phoenix.dump" > "$PG_BACKUP/archive-list.txt"
kubectl exec -n "$NS" "$DB_POD" -c postgresql -- sh -ec 'exec psql --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --set=ON_ERROR_STOP=1 --csv --command="SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM policies) AS policies, (SELECT count(*) FROM workload_snapshots) AS snapshots, (SELECT count(*) FROM policy_executions) AS executions"' > "$PG_BACKUP/counts-pg17.csv"
```

Check exit statuses and backup files. Before scaling the database, inspect `.spec.persistentVolumeClaimRetentionPolicy` on its StatefulSet. The previous chart uses Kubernetes' default retention, which retains claims when scaled or deleted. If an operator changed either policy to `Delete`, change it to `Retain` before proceeding. Do not delete the old PVC, its namespace, or the Helm release.

```bash
kubectl get statefulset "$DB" -n "$NS" -o yaml
kubectl scale statefulset "$DB" -n "$NS" --replicas=0
kubectl wait --for=delete pod/"$DB_POD" -n "$NS" --timeout=5m
kubectl delete statefulset "$DB" -n "$NS"
kubectl get pvc "$OLD_PVC" -n "$NS"
```

### 2. Create a fresh claim and restore PostgreSQL 18

Create a new operator-managed claim in the same namespace. Match the old claim's StorageClass and use adequate capacity; omit `storageClassName` only when the cluster's default is suitable. Do not copy its `volumeName` or bind the original PostgreSQL 17 PV.

```yaml
# pvc-pg18.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: kube-phoenix-postgresql-18
  namespace: kube-phoenix
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 1Gi
```

```bash
kubectl apply -f pvc-pg18.yaml
```

Use a claim name that does not already hold data. The chart mounts this claim without taking ownership of its lifecycle. Persist a migration overlay alongside the normal values file:

```yaml
# values-pg18.yaml
replicaCount: 0
postgresql:
  image:
    tag: "18.6-alpine"
  persistence:
    enabled: true
    existingClaim: kube-phoenix-postgresql-18
```

The following command uses the updated chart from a repository checkout. For a published release, substitute its OCI chart and an explicit version that includes PostgreSQL 18 support. Keep the old credentials and other deployment settings by loading the saved values first:

```bash
helm upgrade "$RELEASE" ./helm/kube-phoenix -n "$NS" \
  -f "$PG_BACKUP/values-pg17.yaml" -f values-pg18.yaml --wait --timeout 10m
kubectl wait --for=condition=Ready pod/"$DB_POD" -n "$NS" --timeout=5m
kubectl exec -i -n "$NS" "$DB_POD" -c postgresql -- sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec pg_restore --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-owner --exit-on-error --single-transaction' < "$PG_BACKUP/kube-phoenix.dump"
kubectl exec -n "$NS" "$DB_POD" -c postgresql -- sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec vacuumdb --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --analyze-in-stages'
kubectl exec -n "$NS" "$DB_POD" -c postgresql -- sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --set=ON_ERROR_STOP=1 --command="SHOW server_version"'
kubectl exec -n "$NS" "$DB_POD" -c postgresql -- sh -ec 'export PGPASSWORD="$POSTGRES_PASSWORD"; exec psql --host=127.0.0.1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --set=ON_ERROR_STOP=1 --csv --command="SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM policies) AS policies, (SELECT count(*) FROM workload_snapshots) AS snapshots, (SELECT count(*) FROM policy_executions) AS executions"' > "$PG_BACKUP/counts-pg18.csv"
diff -u "$PG_BACKUP/counts-pg17.csv" "$PG_BACKUP/counts-pg18.csv"
```

Confirm that the server reports 18, the restore succeeded, and the saved counts match. Compare important policy and recovery records with a baseline saved before migration; adjust the count query if an older application version used different tables. Then change `replicaCount` in `values-pg18.yaml` to `1` and repeat the same Helm upgrade. Keep the fresh claim selection and credentials in the values used for all future upgrades. Verify health, login, policies, snapshots, and execution history before resuming reconciliation or ending maintenance.

### Helm rollback

Before accepting new application writes, set the application to zero replicas and wait for its pods to finish, as in step 1. Stop PostgreSQL 18, wait for its pod to be deleted, and delete only its StatefulSet:

```bash
kubectl scale statefulset "$DB" -n "$NS" --replicas=0
kubectl wait --for=delete pod/"$DB_POD" -n "$NS" --timeout=5m
kubectl delete statefulset "$DB" -n "$NS"
```

Upgrade using the saved previous chart archive and values, keeping the application stopped. The old chart recreates its original claim template and reuses the retained PostgreSQL 17 claim. Its values schema required at least one application replica, so this maintenance command explicitly skips schema validation to allow zero. Use a Helm version with `--skip-schema-validation`, such as Helm 4.3 used by this repository; retain the previously validated values for every other setting.

```bash
helm upgrade "$RELEASE" "$PG_BACKUP/kube-phoenix-<previous-chart-version>.tgz" -n "$NS" \
  -f "$PG_BACKUP/values-pg17.yaml" --set replicaCount=0 --skip-schema-validation --wait --timeout 10m
kubectl wait --for=condition=Ready pod/"$DB_POD" -n "$NS" --timeout=5m
```

Check that PostgreSQL 17 is using the recorded old PVC and its original data. Then repeat the old-chart upgrade with `--set replicaCount=1` to resume the previous application. Do not use the new chart with only its PostgreSQL tag changed to 17, and do not rely on `helm rollback` alone to reverse the immutable StatefulSet claim change. Retain the new operator-managed PVC for investigation. After new writes on PostgreSQL 18, reverting to the retained 17 PVC requires a separate data reconciliation plan.
