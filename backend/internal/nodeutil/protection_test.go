// SPDX-License-Identifier: Apache-2.0

package nodeutil

import (
	"strings"
	"testing"

	corev1 "k8s.io/api/core/v1"
)

func TestLabelValidationAndParsingAgree(t *testing.T) {
	for _, tt := range []struct {
		config string
		valid  bool
		count  int
	}{
		{"", true, 0},
		{" , , ", true, 0},
		{"example.com/Role=GPU,node-role.kubernetes.io/control-plane=,", true, 2},
		{"=true", false, 0},
		{"example.com/=true", false, 0},
		{"not a key=true", false, 0},
		{"k=v=extra", false, 0},
		{"k=" + strings.Repeat("v", 64), false, 0},
	} {
		t.Run(tt.config, func(t *testing.T) {
			if err := ValidateLabels(tt.config); (err == nil) != tt.valid {
				t.Errorf("validation error = %v, want valid %v", err, tt.valid)
			}
			if got := len(ParseLabels(tt.config)); got != tt.count {
				t.Errorf("parsed %d matchers, want %d", got, tt.count)
			}
		})
	}
}

func TestTaintValidationAndParsingAgree(t *testing.T) {
	for _, tt := range []struct {
		config string
		valid  bool
		count  int
	}{
		{"", true, 0},
		{" , , ", true, 0},
		{"dedicated=infra:NoSchedule,dedicated=other:PreferNoSchedule,node.kubernetes.io/unschedulable=:NoExecute,", true, 3},
		{"=v:NoSchedule", false, 0},
		{"k=v:", false, 0},
		{"k=v:Unknown", false, 0},
		{"k=v:NoSchedule:NoExecute", false, 0},
		{"invalid/key/name=v:NoSchedule", false, 0},
		{"k=has space:NoExecute", false, 0},
	} {
		t.Run(tt.config, func(t *testing.T) {
			if err := ValidateTaints(tt.config); (err == nil) != tt.valid {
				t.Errorf("validation error = %v, want valid %v", err, tt.valid)
			}
			if got := len(ParseTaints(tt.config)); got != tt.count {
				t.Errorf("parsed %d matchers, want %d", got, tt.count)
			}
		})
	}
}

func TestMatchLabel(t *testing.T) {
	tests := []struct {
		name      string
		labels    map[string]string
		csvConfig string
		want      string
	}{
		{
			name:      "exact match",
			labels:    map[string]string{"node-role": "master"},
			csvConfig: "node-role=master",
			want:      "node-role=master",
		},
		{
			name:      "no match",
			labels:    map[string]string{"node-role": "worker"},
			csvConfig: "node-role=master",
			want:      "",
		},
		{
			name:      "empty config",
			labels:    map[string]string{"node-role": "master"},
			csvConfig: "",
			want:      "",
		},
		{
			name:      "match on second CSV entry",
			labels:    map[string]string{"env": "prod"},
			csvConfig: "node-role=master, env=prod",
			want:      "env=prod",
		},
		{
			name:      "malformed entry missing equals",
			labels:    map[string]string{"node-role": "master"},
			csvConfig: "badentry, node-role=master",
			want:      "node-role=master",
		},
		{
			name:      "all malformed entries",
			labels:    map[string]string{"node-role": "master"},
			csvConfig: "badentry, another-bad",
			want:      "",
		},
		{
			name:      "empty labels map",
			labels:    map[string]string{},
			csvConfig: "node-role=master",
			want:      "",
		},
		{
			name:      "trailing comma in config",
			labels:    map[string]string{"env": "prod"},
			csvConfig: "env=prod,",
			want:      "env=prod",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MatchLabel(tt.labels, tt.csvConfig)
			if got != tt.want {
				t.Errorf("MatchLabel() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestMatchTaint(t *testing.T) {
	tests := []struct {
		name      string
		taints    []corev1.Taint
		csvConfig string
		want      string
	}{
		{
			name: "exact taint match",
			taints: []corev1.Taint{
				{Key: "dedicated", Value: "gpu", Effect: corev1.TaintEffectNoSchedule},
			},
			csvConfig: "dedicated=gpu:NoSchedule",
			want:      "dedicated=gpu:NoSchedule",
		},
		{
			name: "no taint match",
			taints: []corev1.Taint{
				{Key: "dedicated", Value: "gpu", Effect: corev1.TaintEffectNoSchedule},
			},
			csvConfig: "dedicated=cpu:NoSchedule",
			want:      "",
		},
		{
			name:      "empty taint config",
			taints:    []corev1.Taint{{Key: "k", Value: "v", Effect: corev1.TaintEffectNoSchedule}},
			csvConfig: "",
			want:      "",
		},
		{
			name: "match on second CSV entry",
			taints: []corev1.Taint{
				{Key: "zone", Value: "us-east", Effect: corev1.TaintEffectNoExecute},
			},
			csvConfig: "dedicated=gpu:NoSchedule, zone=us-east:NoExecute",
			want:      "zone=us-east:NoExecute",
		},
		{
			name: "taint with empty value",
			taints: []corev1.Taint{
				{Key: "node.kubernetes.io/unschedulable", Value: "", Effect: corev1.TaintEffectNoSchedule},
			},
			csvConfig: "node.kubernetes.io/unschedulable=:NoSchedule",
			want:      "node.kubernetes.io/unschedulable=:NoSchedule",
		},
		{
			name:      "no taints on node",
			taints:    []corev1.Taint{},
			csvConfig: "dedicated=gpu:NoSchedule",
			want:      "",
		},
		{
			name: "trailing comma in config",
			taints: []corev1.Taint{
				{Key: "dedicated", Value: "gpu", Effect: corev1.TaintEffectNoSchedule},
			},
			csvConfig: "dedicated=gpu:NoSchedule,",
			want:      "dedicated=gpu:NoSchedule",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MatchTaint(tt.taints, tt.csvConfig)
			if got != tt.want {
				t.Errorf("MatchTaint() = %q, want %q", got, tt.want)
			}
		})
	}
}
