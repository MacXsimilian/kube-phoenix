// SPDX-License-Identifier: Apache-2.0

package api

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

// Partial updates distinguish omitted fields from explicit empty or false
// values. Clearing a field must survive conversion to database update keys.
func TestBuildExceptionUpdates_FieldPresence(t *testing.T) {
	tests := []struct {
		name string
		body string
		want map[string]interface{}
	}{
		{"omitted", `{}`, map[string]interface{}{}},
		{"clear ticket", `{"ticketRef":""}`, map[string]interface{}{"ticket_ref": ""}},
		{"clear reason", `{"reason":""}`, map[string]interface{}{"reason": ""}},
		{"clear namespace", `{"namespaceFilter":""}`, map[string]interface{}{"namespace_filter": ""}},
		{"clear selector", `{"labelSelector":""}`, map[string]interface{}{"label_selector": ""}},
		{"replace strings", `{"ticketRef":"REL-1","reason":"release","namespaceFilter":"dev","labelSelector":"app=api"}`, map[string]interface{}{
			"ticket_ref": "REL-1", "reason": "release", "namespace_filter": "dev", "label_selector": "app=api",
		}},
		{"false preserved", `{"sleepOnEnd":false}`, map[string]interface{}{"sleep_on_end": false}},
		{"immutable parent", `{"policyId":42}`, map[string]interface{}{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body exceptionUpdateInput
			if err := json.Unmarshal([]byte(tt.body), &body); err != nil {
				t.Fatal(err)
			}
			got, err := buildExceptionUpdates(body)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("updates = %#v, want %#v", got, tt.want)
			}
		})
	}
}

// Invalid editable fields must fail validation before an update map is
// returned, preventing edits from bypassing length and targeting restrictions.
func TestBuildExceptionUpdates_RejectsInvalidFields(t *testing.T) {
	ticket := strings.Repeat("x", maxTicketRefLen+1)
	reason := strings.Repeat("x", maxReasonLen+1)
	namespace := "invalid!"
	for name, body := range map[string]exceptionUpdateInput{
		"ticket too long":   {TicketRef: &ticket},
		"reason too long":   {Reason: &reason},
		"invalid namespace": {NamespaceFilter: &namespace},
		"invalid type":      {ExceptionType: "invalid"},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := buildExceptionUpdates(body); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}
