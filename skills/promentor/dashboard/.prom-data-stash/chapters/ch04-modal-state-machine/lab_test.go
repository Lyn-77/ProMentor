/*
 * lab_test.go — Ch 4 行为测试（学生不可改）
 *
 * 黑盒测试：模态迁移、dd 双键序列、多选集合、确认删除。
 */
package modal_test

import (
	"reflect"
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	modal "WakeUp/.promentor/chapters/ch04-modal-state-machine"
)

var items = []string{"NAS", "PC", "Router", "Camera"}

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

func update(t *testing.T, m modal.Model, msgs ...tea.Msg) modal.Model {
	t.Helper()
	for _, msg := range msgs {
		next, _ := m.Update(msg)
		nm, ok := next.(modal.Model)
		if !ok {
			t.Fatalf("Update 返回 %T，期望 modal.Model", next)
		}
		m = nm
	}
	return m
}

func TestNewState(t *testing.T) {
	m := modal.New(items)
	if m.Mode() != modal.ModeNormal {
		t.Fatalf("初始模式 = %v，期望 ModeNormal", m.Mode())
	}
	if m.Cursor() != 0 {
		t.Fatalf("初始 cursor = %d，期望 0", m.Cursor())
	}
}

func TestCursorMovesAndClamps(t *testing.T) {
	m := modal.New(items)
	m = update(t, m, key("j"), key("j"), key("j")) // 到底
	if m.Cursor() != len(items)-1 {
		t.Fatalf("按 j×3 后 cursor = %d，期望 %d", m.Cursor(), len(items)-1)
	}
	m = update(t, m, key("j")) // 越界钳制
	if m.Cursor() != len(items)-1 {
		t.Fatalf("越界 j 后 cursor = %d，期望钳制在 %d", m.Cursor(), len(items)-1)
	}
	m = update(t, m, key("k"), key("k"), key("k"), key("k"), key("k")) // 越过顶部
	if m.Cursor() != 0 {
		t.Fatalf("越界 k 后 cursor = %d，期望钳制在 0", m.Cursor())
	}
}

func TestSpaceEntersMultiSelect(t *testing.T) {
	m := modal.New(items)
	m = update(t, m, key("j"), key(" "))
	if m.Mode() != modal.ModeMultiSelect {
		t.Fatalf("space 后模式 = %v，期望 ModeMultiSelect", m.Mode())
	}
	sel := m.Selected()
	if !reflect.DeepEqual(sel, []int{1}) {
		t.Fatalf("space 后 Selected = %v，期望 [1]", sel)
	}
}

func TestMultiSelectToggle(t *testing.T) {
	m := modal.New(items)
	m = update(t, m, key(" "), key("j"), key(" "), key("j"), key(" "))
	if m.Mode() != modal.ModeMultiSelect {
		t.Fatal("多选模式下不应退出多选")
	}
	// 选中了 0, 1, 2
	if sel := m.Selected(); !reflect.DeepEqual(sel, []int{0, 1, 2}) {
		t.Fatalf("Selected = %v，期望 [0 1 2]", sel)
	}
	// 再按一次 space 取消当前 (cursor=2)
	m = update(t, m, key(" "))
	if sel := m.Selected(); !reflect.DeepEqual(sel, []int{0, 1}) {
		t.Fatalf("取消后 Selected = %v，期望 [0 1]", sel)
	}
}

func TestMultiSelectExitPreservesSelection(t *testing.T) {
	m := modal.New(items)
	m = update(t, m, key(" "), key("j"), key(" "), key("esc"))
	if m.Mode() != modal.ModeNormal {
		t.Fatalf("esc 后模式 = %v，期望 ModeNormal", m.Mode())
	}
	if sel := m.Selected(); !reflect.DeepEqual(sel, []int{0, 1}) {
		t.Fatalf("退出多选后 Selected = %v，期望保留 [0 1]", sel)
	}
}

func TestDDPairTriggersConfirm(t *testing.T) {
	m := modal.New(items)
	m = update(t, m, key("d"), key("d"))
	if m.Mode() != modal.ModeConfirm {
		t.Fatalf("dd 后模式 = %v，期望 ModeConfirm", m.Mode())
	}
}

func TestDDPrefixInterrupted(t *testing.T) {
	m := modal.New(items)
	// d 后按别的键，前缀作废
	m = update(t, m, key("d"), key("j"))
	if m.Mode() != modal.ModeNormal {
		t.Fatalf("d+j 后模式 = %v，期望仍为 ModeNormal（前缀应作废）", m.Mode())
	}
	// 再按 d 不应直接进确认
	m = update(t, m, key("d"))
	if m.Mode() != modal.ModeNormal {
		t.Fatalf("中断后单个 d 模式 = %v，期望 ModeNormal", m.Mode())
	}
}

func TestConfirmDeleteRemovesItem(t *testing.T) {
	m := modal.New(items)
	m = update(t, m, key("j"), key("d"), key("d"), key("y"))
	if m.Mode() != modal.ModeNormal {
		t.Fatalf("确认后模式 = %v，期望 ModeNormal", m.Mode())
	}
	got := m.Items()
	want := []string{"NAS", "Router", "Camera"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("删除后 Items = %v，期望 %v", got, want)
	}
}

func TestConfirmCancelKeepsItem(t *testing.T) {
	m := modal.New(items)
	m = update(t, m, key("d"), key("d"), key("n"))
	if m.Mode() != modal.ModeNormal {
		t.Fatalf("取消后模式 = %v，期望 ModeNormal", m.Mode())
	}
	if !reflect.DeepEqual(m.Items(), items) {
		t.Fatalf("取消后 Items = %v，期望不变 %v", m.Items(), items)
	}
}

func TestQuit(t *testing.T) {
	m := modal.New(items)
	_, cmd := m.Update(key("q"))
	if cmd == nil {
		t.Fatal("普通模式 q 应返回 tea.Quit")
	}
	var got tea.Msg
	if cmd != nil {
		got = cmd()
	}
	if _, ok := got.(tea.QuitMsg); !ok {
		t.Fatalf("q 的 Cmd 应产生 QuitMsg，实际 %T", got)
	}
}

func TestViewNonEmpty(t *testing.T) {
	m := modal.New(items)
	if v := m.View(); v == "" {
		t.Fatal("View 不应为空")
	}
}
