/*
 * lab_test.go — Ch 0 行为测试（学生不可改）
 *
 * 黑盒测试：不关心 tuikit.go 内部实现，只验证行为契约。
 */
package tuikit_test

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	tuikit "WakeUp/.promentor/chapters/ch00-setup"
)

// key 构造一个按键消息
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
	case "tab":
		return tea.KeyMsg{Type: tea.KeyTab}
	case "backspace":
		return tea.KeyMsg{Type: tea.KeyBackspace}
	default:
		return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(s)}
	}
}

// update 执行一次 Update 并断言返回类型是 tuikit.Model
func update(t *testing.T, m tuikit.Model, msg tea.Msg) tuikit.Model {
	t.Helper()
	next, _ := m.Update(msg)
	nm, ok := next.(tuikit.Model)
	if !ok {
		t.Fatalf("Update 返回了 %T，期望 tuikit.Model", next)
	}
	return nm
}

func TestCountStartsZero(t *testing.T) {
	m := tuikit.New()
	if m.Count() != 0 {
		t.Fatalf("初始 count = %d，期望 0", m.Count())
	}
}

func TestIncrementOnJ(t *testing.T) {
	m := tuikit.New()
	m = update(t, m, key("j"))
	m = update(t, m, key("j"))
	if m.Count() != 2 {
		t.Fatalf("按两次 j 后 count = %d，期望 2", m.Count())
	}
}

func TestIncrementOnDown(t *testing.T) {
	m := tuikit.New()
	m = update(t, m, key("down"))
	if m.Count() != 1 {
		t.Fatalf("按 down 后 count = %d，期望 1", m.Count())
	}
}

func TestQuitOnQ(t *testing.T) {
	m := tuikit.New()
	next, cmd := m.Update(key("q"))
	if cmd == nil {
		t.Fatal("按 q 后应返回非 nil Cmd（tea.Quit）")
	}
	var got tea.Msg
	if cmd != nil {
		got = cmd()
	}
	if _, ok := got.(tea.QuitMsg); !ok {
		t.Fatalf("按 q 的 Cmd 应产生 tea.QuitMsg，实际 %T", got)
	}
	// q 不应改变计数值
	if nm, ok := next.(tuikit.Model); ok && nm.Count() != 0 {
		t.Fatalf("按 q 后 count = %d，期望 0", nm.Count())
	}
}

func TestUnhandledKeyNoChange(t *testing.T) {
	m := tuikit.New()
	// 空消息不是 KeyMsg，应无变化
	m = update(t, m, tea.WindowSizeMsg{Width: 80, Height: 24})
	if m.Count() != 0 {
		t.Fatalf("窗口消息后 count = %d，期望 0", m.Count())
	}
}

func TestViewShowsCount(t *testing.T) {
	m := tuikit.New()
	m = update(t, m, key("j"))
	v := m.View()
	if !strings.Contains(v, "1") {
		t.Fatalf("View 应包含计数值 1，实际:\n%s", v)
	}
}
