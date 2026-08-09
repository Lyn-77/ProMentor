/*
 * lab_test.go — Ch 7 行为测试（学生不可改）
 *
 * 黑盒测试：端到端组装 —— 唤醒/删除/批量唤醒完整旅程 + 空 store 防崩。
 */
package app_test

import (
	"errors"
	"reflect"
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	app "WakeUp/.promentor/chapters/ch07-final-assembly"
)

var errBoom = errors.New("boom")

func key(s string) tea.KeyMsg {
	switch s {
	case "down":
		return tea.KeyMsg{Type: tea.KeyDown}
	case "up":
		return tea.KeyMsg{Type: tea.KeyUp}
	case "enter":
		return tea.KeyMsg{Type: tea.KeyEnter}
	case "esc":
		return tea.KeyMsg{Type: tea.KeyEsc}
	case " ":
		return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{' '}}
	default:
		return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(s)}
	}
}

func upd(t *testing.T, m app.App, msg tea.Msg) (app.App, tea.Cmd) {
	t.Helper()
	next, cmd := m.Update(msg)
	nm, ok := next.(app.App)
	if !ok {
		t.Fatalf("Update 返回 %T，期望 app.App", next)
	}
	return nm, cmd
}

// 造一个带两设备的 App
func twoDeviceApp(t *testing.T, wake app.WakeFunc) app.App {
	t.Helper()
	s := app.NewStore()
	s.Add(app.Device{Name: "NAS", MAC: "AA:BB:CC:DD:EE:01", Address: "255.255.255.255", Port: 9})
	s.Add(app.Device{Name: "PC", MAC: "AA:BB:CC:DD:EE:02", Address: "255.255.255.255", Port: 9})
	return app.NewApp(s, wake)
}

func TestNewAppList(t *testing.T) {
	m := twoDeviceApp(t, func(mac, addr string, port int) error { return nil })
	if !reflect.DeepEqual(m.Items(), []string{"NAS", "PC"}) {
		t.Fatalf("Items = %v，期望 [NAS PC]", m.Items())
	}
	if m.Cursor() != 0 {
		t.Fatalf("初始 cursor = %d，期望 0", m.Cursor())
	}
	if m.Mode() != app.ModeNormal {
		t.Fatalf("初始模式 = %v，期望 ModeNormal", m.Mode())
	}
	if v := m.View(); v == "" {
		t.Fatal("View 不应为空")
	}
}

func TestNav(t *testing.T) {
	m := twoDeviceApp(t, func(mac, addr string, port int) error { return nil })
	m, _ = upd(t, m, key("j"))
	m, _ = upd(t, m, key("j")) // 越界钳制
	if m.Cursor() != 1 {
		t.Fatalf("j×2 后 cursor = %d，期望钳制在 1", m.Cursor())
	}
	m, _ = upd(t, m, key("k"))
	m, _ = upd(t, m, key("k")) // 越界钳制
	if m.Cursor() != 0 {
		t.Fatalf("k×2 后 cursor = %d，期望钳制在 0", m.Cursor())
	}
}

func TestSingleWakeFullJourney(t *testing.T) {
	m := twoDeviceApp(t, func(mac, addr string, port int) error { return nil })
	m, _ = upd(t, m, key("enter")) // 唤醒确认
	if m.Mode() != app.ModeWakeConfirm {
		t.Fatalf("enter 后模式 = %v，期望 ModeWakeConfirm", m.Mode())
	}
	m, cmd := upd(t, m, key("y")) // 触发异步
	if cmd == nil {
		t.Fatal("y 应返回异步 Cmd")
	}
	msg := cmd() // 执行异步
	wm, ok := msg.(app.WakeMsg)
	if !ok {
		t.Fatalf("Cmd 产生消息 %T，期望 app.WakeMsg", msg)
	}
	if wm.Err != nil {
		t.Fatalf("唤醒失败: %v", wm.Err)
	}
	m, _ = upd(t, m, wm) // 结果回环
	if m.WakeCount() != 1 {
		t.Fatalf("WakeCount = %d，期望 1", m.WakeCount())
	}
	if m.Mode() != app.ModeNormal {
		t.Fatalf("结果处理后模式 = %v，期望 ModeNormal", m.Mode())
	}
}

func TestSingleWakeFailureCountsZero(t *testing.T) {
	m := twoDeviceApp(t, func(mac, addr string, port int) error { return errBoom })
	m, _ = upd(t, m, key("enter"))
	_, cmd := upd(t, m, key("y"))
	msg := cmd()
	wm := msg.(app.WakeMsg)
	if wm.Err == nil {
		t.Fatal("fake wake 应返回错误")
	}
	m, _ = upd(t, m, wm)
	if m.WakeCount() != 0 {
		t.Fatalf("失败唤醒后 WakeCount = %d，期望 0", m.WakeCount())
	}
}

func TestDeleteFlow(t *testing.T) {
	m := twoDeviceApp(t, func(mac, addr string, port int) error { return nil })
	m, _ = upd(t, m, key("d"))
	m, _ = upd(t, m, key("d")) // dd → 删除确认
	if m.Mode() != app.ModeConfirm {
		t.Fatalf("dd 后模式 = %v，期望 ModeConfirm", m.Mode())
	}
	m, _ = upd(t, m, key("y")) // 确认删除
	if m.DeletedCount() != 1 {
		t.Fatalf("DeletedCount = %d，期望 1", m.DeletedCount())
	}
	if !reflect.DeepEqual(m.Items(), []string{"PC"}) {
		t.Fatalf("删除后 Items = %v，期望 [PC]", m.Items())
	}
}

func TestDeleteCancelKeepsItem(t *testing.T) {
	m := twoDeviceApp(t, func(mac, addr string, port int) error { return nil })
	m, _ = upd(t, m, key("d"))
	m, _ = upd(t, m, key("d"))
	m, _ = upd(t, m, key("n"))
	if m.DeletedCount() != 0 {
		t.Fatalf("取消后 DeletedCount = %d，期望 0", m.DeletedCount())
	}
	if !reflect.DeepEqual(m.Items(), []string{"NAS", "PC"}) {
		t.Fatal("取消后设备不应变化")
	}
}

func TestBatchWakeFullJourney(t *testing.T) {
	m := twoDeviceApp(t, func(mac, addr string, port int) error { return nil })
	m, _ = upd(t, m, key(" "))  // 进多选，选中 0
	m, _ = upd(t, m, key("j"))  // 移向 1
	m, _ = upd(t, m, key(" "))  // 选中 1
	if m.Mode() != app.ModeMultiSelect {
		t.Fatalf("多选模式 = %v，期望 ModeMultiSelect", m.Mode())
	}
	m, _ = upd(t, m, key("enter")) // 批量确认
	if m.Mode() != app.ModeBatchWakeConfirm {
		t.Fatalf("enter 后模式 = %v，期望 ModeBatchWakeConfirm", m.Mode())
	}
	_, cmd := upd(t, m, key("y"))
	if cmd == nil {
		t.Fatal("批量 y 应返回异步 Cmd")
	}
	msg := cmd()
	bm, ok := msg.(app.BatchWakeMsg)
	if !ok {
		t.Fatalf("Cmd 产生消息 %T，期望 app.BatchWakeMsg", msg)
	}
	if len(bm.Results) != 2 {
		t.Fatalf("批量结果数 = %d，期望 2", len(bm.Results))
	}
	m, _ = upd(t, m, bm)
	if m.WakeCount() != 2 {
		t.Fatalf("批量后 WakeCount = %d，期望 2", m.WakeCount())
	}
}

func TestBatchWakePartialFailure(t *testing.T) {
	s := app.NewStore()
	s.Add(app.Device{Name: "A", MAC: "AA:BB:CC:DD:EE:01", Address: "255.255.255.255", Port: 9})
	s.Add(app.Device{Name: "B", MAC: "AA:BB:CC:DD:EE:02", Address: "255.255.255.255", Port: 9})
	failOnB := func(mac, addr string, port int) error {
		if mac == "AA:BB:CC:DD:EE:02" {
			return errBoom
		}
		return nil
	}
	m := app.NewApp(s, failOnB)
	m, _ = upd(t, m, key(" ")) // 选 A
	m, _ = upd(t, m, key("j"))
	m, _ = upd(t, m, key(" ")) // 选 B
	m, _ = upd(t, m, key("enter"))
	_, cmd := upd(t, m, key("y"))
	msg := cmd()
	bm := msg.(app.BatchWakeMsg)
	m, _ = upd(t, m, bm)
	if m.WakeCount() != 1 {
		t.Fatalf("部分失败后 WakeCount = %d，期望 1（只计成功的）", m.WakeCount())
	}
}

func TestMultiSelectDeselectAll(t *testing.T) {
	m := twoDeviceApp(t, func(mac, addr string, port int) error { return nil })
	m, _ = upd(t, m, key(" ")) // 选中 0
	m, _ = upd(t, m, key(" ")) // 取消 0 → 空选中
	m, _ = upd(t, m, key("enter"))
	if m.Mode() != app.ModeMultiSelect {
		t.Fatalf("空选中 enter 后模式 = %v，期望停留 ModeMultiSelect", m.Mode())
	}
}

func TestEmptyStoreSafe(t *testing.T) {
	s := app.NewStore()
	m := app.NewApp(s, func(mac, addr string, port int) error { return nil })
	// 空 store 各种操作都不崩
	m, _ = upd(t, m, key("enter"))
	m, _ = upd(t, m, key(" "))
	m, _ = upd(t, m, key("d"))
	m, _ = upd(t, m, key("d"))
	m, _ = upd(t, m, key("y"))
	if m.DeletedCount() != 0 {
		t.Fatalf("空 store 删除 DeletedCount = %d，期望 0", m.DeletedCount())
	}
	if m.Mode() != app.ModeNormal {
		t.Fatalf("空 store 操作后模式 = %v，期望 ModeNormal", m.Mode())
	}
}

func TestQuit(t *testing.T) {
	m := twoDeviceApp(t, func(mac, addr string, port int) error { return nil })
	_, cmd := m.Update(key("q"))
	if cmd == nil {
		t.Fatal("q 应返回 tea.Quit")
	}
	var got tea.Msg
	if cmd != nil {
		got = cmd()
	}
	if _, ok := got.(tea.QuitMsg); !ok {
		t.Fatalf("q 的 Cmd 应产生 QuitMsg，实际 %T", got)
	}
}
