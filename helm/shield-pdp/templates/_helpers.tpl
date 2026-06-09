{{- define "shield-pdp.name" -}}
shield-pdp
{{- end -}}

{{- define "shield-pdp.labels" -}}
app.kubernetes.io/name: {{ include "shield-pdp.name" . }}
app.kubernetes.io/managed-by: Helm
shield.stage: {{ .Values.global.stage | quote }}
{{- end -}}
