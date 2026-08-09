/*
 * lab_test.go — Ch 5 行为测试（学生不可改）
 *
 * 黑盒测试：并发扇出、结果对齐、部分失败、Cmd 消息包装。
 */
package batch_test

import (
	"errors"
	"reflect"
	"sync/atomic"
	"testing"
	"time"

	batch "WakeUp/.promentor/chapters/ch05-async-batch-wake"
)

var errBoom = errors.New("boom")

func TestBatchWakeAllSuccess(t *testing.T) {
	names := []string{"NAS", "PC", "Router"}
	results := batch.BatchWake(names, func(name string) error { return nil })

	if len(results) != 3 {
		t.Fatalf("结果数 = %d，期望 3", len(results))
	}
	for i, r := range results {
		if r.Name != names[i] {
			t.Fatalf("第 %d 个结果 Name = %q，期望 %q（位置应对齐）", i, r.Name, names[i])
		}
		if r.Err != nil {
			t.Fatalf("%q 应成功，得到错误 %v", r.Name, r.Err)
		}
	}
}

func TestBatchWakePartialFailure(t *testing.T) {
	names := []string{"A", "B", "C"}
	failOn := map[string]bool{"B": true}
	results := batch.BatchWake(names, func(name string) error {
		if failOn[name] {
			return errBoom
		}
		return nil
	})

	for i, r := range results {
		if failOn[r.Name] && r.Err == nil {
			t.Fatalf("%q 应失败，得到 nil（第 %d 槽位）", r.Name, i)
		}
		if !failOn[r.Name] && r.Err != nil {
			t.Fatalf("%q 应成功，得到 %v", r.Name, r.Err)
		}
	}
}

func TestBatchWakeIsConcurrent(t *testing.T) {
	const n = 50
	var active int64
	var peak int64
	names := make([]string, n)
	for i := range names {
		names[i] = "dev" + string(rune('a'+i%26)) + string(rune('0'+i))
	}

	wake := func(name string) error {
		cur := atomic.AddInt64(&active, 1)
		// 记录峰值
		for {
			old := atomic.LoadInt64(&peak)
			if cur <= old || atomic.CompareAndSwapInt64(&peak, old, cur) {
				break
			}
		}
		time.Sleep(time.Millisecond) // 拉长执行窗口，便于观测并发
		atomic.AddInt64(&active, -1)
		return nil
	}

	results := batch.BatchWake(names, wake)
	if len(results) != n {
		t.Fatalf("结果数 = %d，期望 %d", len(results), n)
	}
	if p := atomic.LoadInt64(&peak); p < 2 {
		t.Fatalf("峰值并发 = %d，期望 >= 2（你的实现可能是串行的）", p)
	}
}

func TestWakeCmdReturnsBatchMsg(t *testing.T) {
	names := []string{"A", "B"}
	cmd := batch.WakeCmd(names, func(name string) error { return nil })
	if cmd == nil {
		t.Fatal("WakeCmd 返回了 nil Cmd")
	}
	msg := cmd() // 执行 Cmd，得到消息
	bm, ok := msg.(batch.BatchMsg)
	if !ok {
		t.Fatalf("Cmd 产生的消息类型 %T，期望 batch.BatchMsg", msg)
	}
	if !reflect.DeepEqual(bm.Results, []batch.Result{{Name: "A"}, {Name: "B"}}) {
		t.Fatalf("BatchMsg.Results = %+v，期望 [{A nil} {B nil}]", bm.Results)
	}
}
