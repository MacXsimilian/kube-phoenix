// SPDX-License-Identifier: Apache-2.0

package observability

import (
	"fmt"
	"math"
	"sort"
	"strings"

	dto "github.com/prometheus/client_model/go"
)

// counterRate computes per-second rate for all label combinations of a counter.
func (c *Collector) counterRate(name string, current map[string]float64, elapsed float64) float64 {
	var total float64
	prefix := name + "{"
	for key, value := range current {
		if key == name || strings.HasPrefix(key, prefix) {
			delta := value - c.previousValues[key]
			// A counter reset starts a new series; count its current value.
			if delta < 0 {
				delta = value
			}
			total += delta
		}
	}
	return total / elapsed
}

// counterRateFiltered computes per-second rate for counter values where a specific label matches a prefix.
func (c *Collector) counterRateFiltered(name string, current map[string]float64, elapsed float64, labelKey, labelValuePrefix string) float64 {
	var total float64
	filter := fmt.Sprintf(`%s="%s`, labelKey, labelValuePrefix)
	for key, value := range current {
		if !strings.HasPrefix(key, name) {
			continue
		}
		if !strings.Contains(key, filter) {
			continue
		}
		delta := value - c.previousValues[key]
		if delta < 0 {
			delta = value
		}
		total += delta
	}
	return total / elapsed
}

// flattenMetricFamily extracts all metric values into a flat map keyed by name{labels}.
func flattenMetricFamily(family *dto.MetricFamily, values map[string]float64) {
	name := family.GetName()
	for _, metric := range family.GetMetric() {
		key := metricKey(name, metric.GetLabel())
		switch family.GetType() {
		case dto.MetricType_COUNTER:
			values[key] = metric.GetCounter().GetValue()
		case dto.MetricType_GAUGE:
			values[key] = metric.GetGauge().GetValue()
		case dto.MetricType_HISTOGRAM:
			values[key+"_sum"] = metric.GetHistogram().GetSampleSum()
			values[key+"_count"] = float64(metric.GetHistogram().GetSampleCount())
		}
	}
}

func metricKey(name string, labels []*dto.LabelPair) string {
	if len(labels) == 0 {
		return name
	}
	parts := make([]string, len(labels))
	for i, label := range labels {
		parts[i] = fmt.Sprintf(`%s="%s"`, label.GetName(), label.GetValue())
	}
	return fmt.Sprintf("%s{%s}", name, strings.Join(parts, ","))
}

// histogramQuantile computes an approximate quantile from a histogram metric family.
func histogramQuantile(family *dto.MetricFamily, quantile float64) float64 {
	if family == nil {
		return 0
	}
	// Aggregate all label combinations into one histogram.
	var totalCount uint64
	buckets := make(map[float64]uint64)
	for _, metric := range family.GetMetric() {
		histogram := metric.GetHistogram()
		totalCount += histogram.GetSampleCount()
		for _, bucket := range histogram.GetBucket() {
			buckets[bucket.GetUpperBound()] += bucket.GetCumulativeCount()
		}
	}
	if totalCount == 0 {
		return 0
	}
	target := float64(totalCount) * quantile
	previousBound := 0.0
	previousCount := uint64(0)
	sorted := sortBuckets(buckets)
	for _, bucket := range sorted {
		if float64(bucket.count) >= target {
			fraction := (target - float64(previousCount)) / float64(bucket.count-previousCount)
			return previousBound + (bucket.bound-previousBound)*fraction
		}
		previousBound = bucket.bound
		previousCount = bucket.count
	}
	return previousBound
}

type sortedBucket struct {
	bound float64
	count uint64
}

func sortBuckets(buckets map[float64]uint64) []sortedBucket {
	result := make([]sortedBucket, 0, len(buckets))
	for bound, count := range buckets {
		if !math.IsInf(bound, 1) {
			result = append(result, sortedBucket{bound: bound, count: count})
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].bound < result[j].bound })
	return result
}

func gaugeValue(family *dto.MetricFamily) float64 {
	if family == nil {
		return 0
	}
	var total float64
	for _, metric := range family.GetMetric() {
		total += metric.GetGauge().GetValue()
	}
	return total
}

func counterValue(family *dto.MetricFamily) float64 {
	if family == nil {
		return 0
	}
	var total float64
	for _, metric := range family.GetMetric() {
		total += metric.GetCounter().GetValue()
	}
	return total
}
