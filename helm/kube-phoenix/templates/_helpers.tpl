{{/*
Expand the name of the chart.
*/}}
{{- define "kube-phoenix.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Full name — release + chart, truncated to 63 chars.
Avoids "kube-phoenix-kube-phoenix" when the release name already contains the chart name.
*/}}
{{- define "kube-phoenix.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
The namespace to deploy into.
*/}}
{{- define "kube-phoenix.namespace" -}}
{{- if .Values.namespaceOverride }}
{{- .Values.namespaceOverride }}
{{- else }}
{{- .Release.Namespace }}
{{- end }}
{{- end }}

{{/*
Service account name.
*/}}
{{- define "kube-phoenix.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kube-phoenix.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Secret name to use (existing or chart-managed).
*/}}
{{- define "kube-phoenix.secretName" -}}
{{- if .Values.secret.existingSecret }}
{{- .Values.secret.existingSecret }}
{{- else }}
{{- include "kube-phoenix.fullname" . }}
{{- end }}
{{- end }}

{{/*
PostgreSQL resource name and internal service hostname.
Reserve room for the suffix within the Service's 63-character limit.
*/}}
{{- define "kube-phoenix.postgresqlHost" -}}
{{- printf "%s-postgresql" (include "kube-phoenix.fullname" . | trunc 52 | trimSuffix "-") }}
{{- end }}

{{/*
Quote one PostgreSQL keyword/value DSN value, escaping backslashes first.
This is separate from YAML quoting of the complete connection string.
*/}}
{{- define "kube-phoenix.dsnValue" -}}
{{- printf "'%s'" (. | replace "\\" "\\\\" | replace "'" "\\'") -}}
{{- end }}

{{/*
Compute the DATABASE_URL for the app secret.
Priority:
  1. postgresql.enabled=true  → build DSN from postgresql.auth.*
  2. externalDatabase.url set → use it verbatim
  3. externalDatabase fields  → build DSN from them
*/}}
{{- define "kube-phoenix.databaseUrl" -}}
{{- if .Values.postgresql.enabled -}}
{{- printf "host=%s user=%s password=%s dbname=%s port=5432 sslmode=disable"
    (include "kube-phoenix.postgresqlHost" . | include "kube-phoenix.dsnValue")
    (include "kube-phoenix.dsnValue" .Values.postgresql.auth.username)
    (include "kube-phoenix.dsnValue" .Values.postgresql.auth.password)
    (include "kube-phoenix.dsnValue" .Values.postgresql.auth.database) -}}
{{- else if .Values.externalDatabase.url -}}
{{- .Values.externalDatabase.url -}}
{{- else -}}
{{- printf "host=%s user=%s password=%s dbname=%s port=%d sslmode=%s"
    (include "kube-phoenix.dsnValue" .Values.externalDatabase.host)
    (include "kube-phoenix.dsnValue" .Values.externalDatabase.username)
    (include "kube-phoenix.dsnValue" .Values.externalDatabase.password)
    (include "kube-phoenix.dsnValue" .Values.externalDatabase.database)
    (.Values.externalDatabase.port | int)
    (include "kube-phoenix.dsnValue" .Values.externalDatabase.sslmode) -}}
{{- end -}}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "kube-phoenix.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "kube-phoenix.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/part-of: kube-phoenix
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "kube-phoenix.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kube-phoenix.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Selector labels scoped to the server component.
Use this wherever the application pods must be targeted exclusively, so the
selector does not also match the PostgreSQL pods (which share name + instance).
*/}}
{{- define "kube-phoenix.serverSelectorLabels" -}}
{{ include "kube-phoenix.selectorLabels" . }}
app.kubernetes.io/component: server
{{- end }}

{{/*
Validate mutually exclusive values and required fields.
*/}}
{{- define "kube-phoenix.validateValues" -}}
{{- if or (lt (int .Values.replicaCount) 0) (gt (int .Values.replicaCount) 1) }}
{{- fail "kube-phoenix supports one scheduler replica, or zero for maintenance." }}
{{- end }}
{{- if ne .Values.strategy.type "Recreate" }}
{{- fail "The singleton scheduler requires strategy.type=Recreate." }}
{{- end }}
{{- if .Values.strategy.rollingUpdate }}
{{- fail "Remove strategy.rollingUpdate when using Recreate." }}
{{- end }}
{{- if and .Values.autoscaling .Values.autoscaling.enabled }}
{{- fail "Scheduler autoscaling is unsupported." }}
{{- end }}
{{- if and .Values.ingress.enabled .Values.targetGroupBinding.enabled }}
{{- fail "ingress.enabled and targetGroupBinding.enabled cannot both be true. Use one or the other." }}
{{- end }}
{{- if and (not .Values.postgresql.enabled) (not .Values.externalDatabase.url) (not .Values.externalDatabase.host) }}
{{- fail "When postgresql.enabled=false you must set either externalDatabase.url or externalDatabase.host." }}
{{- end }}
{{- end }}
