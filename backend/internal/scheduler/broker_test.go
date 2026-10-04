// SPDX-License-Identifier: Apache-2.0

package scheduler

import (
	"sync"
	"testing"

	"github.com/macxsimilian/kube-phoenix/backend/internal/store"
)

func TestBrokerReleasesDisconnectedSubscribers(t *testing.T) {
	b := NewBroker()
	b.Publish(1, store.PolicyLogLine{Seq: 1, Message: "before reconnect"})
	for range 1000 {
		ch, replay := b.Subscribe(1)
		if ch == nil || len(replay) != 1 || replay[0].Seq != 1 {
			t.Fatal("reconnecting subscriber did not receive replay")
		}
		b.Unsubscribe(1, ch)
		b.Unsubscribe(1, ch)
		if _, open := <-ch; open {
			t.Fatal("disconnected subscriber channel remains open")
		}
		if len(b.subs) != 0 {
			t.Fatal("broker retained disconnected subscriber entries")
		}
	}
	b.Close(1)
	if len(b.replay) != 0 {
		t.Fatal("closed execution retained replay")
	}
}

func TestBrokerCloseAndUnsubscribeAreIdempotent(t *testing.T) {
	b := NewBroker()
	a, _ := b.Subscribe(1)
	c, _ := b.Subscribe(1)
	b.Unsubscribe(1, a)
	b.Publish(1, store.PolicyLogLine{Seq: 1})
	if _, open := <-a; open {
		t.Fatal("removed subscriber received a line")
	}
	if line := <-c; line.Seq != 1 {
		t.Fatal("remaining subscriber did not receive the line")
	}
	b.Close(1)
	b.Unsubscribe(1, c)
	b.Close(1)
	if _, open := <-c; open {
		t.Fatal("closed execution subscriber remains open")
	}
}

func TestBrokerConcurrentSubscriberChurn(t *testing.T) {
	b := NewBroker()
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			for i := range 100 {
				ch, _ := b.Subscribe(1)
				if ch == nil {
					t.Error("subscriber rejected below simultaneous limit")
					return
				}
				b.Publish(1, store.PolicyLogLine{Seq: i})
				if i%10 == 0 {
					b.Close(1)
				}
				b.Unsubscribe(1, ch)
				b.Unsubscribe(1, ch)
			}
		})
	}
	wg.Wait()
	b.Close(1)
	if len(b.subs) != 0 || len(b.replay) != 0 {
		t.Fatal("broker retained execution resources after concurrent cleanup")
	}
}
