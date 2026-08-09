/*
 * lab_test.go — Ch 3 行为测试（学生不可改）
 *
 * 黑盒测试：委托方向、页面自决跳转、全局退出。
 */
package pages_test

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	pages "WakeUp/.promentor/chapters/ch03-page-routing"
)

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
	default:
		return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(s)}
	}
}

func update(t *testing.T, m pages.Top, msg tea.Msg) pages.Top {
	t.Helper()
	next, _ := m.Update(msg)
	nm, ok := next.(pages.Top)
	if !ok {
		t.Fatalf("Top.Update 返回 %T，期望 pages.Top", next)
	}
	return nm
}

func TestTopStartsWithPageA(t *testing.T) {
	m := pages.New()
	if got := m.CurrentPage(); got != "A" {
		t.Fatalf("初始页面 = %q，期望 A", got)
	}
}

func TestPageASwitchesToB(t *testing.T) {
	m := pages.New()
	m = update(t, m, key("n"))
	if got := m.CurrentPage(); got != "B" {
		t.Fatalf("A 收到 n 后应切到 B，实际 %q", got)
	}
}

func TestPageBSwitchesToA(t *testing.T) {
	m := pages.New()
	m = update(t, m, key("n")) // A → B
	m = update(t, m, key("p")) // B → A
	if got := m.CurrentPage(); got != "A" {
		t.Fatalf("B 收到 p 后应切回 A，实际 %q", got)
	}
}

func TestGlobalQuit(t *testing.T) {
	m := pages.New()
	next, cmd := m.Update(key("q"))
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
	if nm, ok := next.(pages.Top); ok && nm.CurrentPage() != "A" {
		t.Fatalf("退出不应切换页面，当前 %q", nm.CurrentPage())
	}
}

func TestDelegatesToPageA(t *testing.T) {
	m := pages.New()
	m = update(t, m, key("j"))
	m = update(t, m, key("j"))
	if got := m.PageAVisits(); got != 2 {
		t.Fatalf("A 的 visits = %d，期望 2（j 应被委托给 A）", got)
	}
	// 委托不应导致页面切换
	if got := m.CurrentPage(); got != "A" {
		t.Fatalf("j 后页面 = %q，期望仍为 A", got)
	}
}

func TestDelegatesToPageB(t *testing.T) {
	m := pages.New()
	m = update(t, m, key("n")) // 切到 B
	m = update(t, m, key("k"))
	if got := m.PageBVisits(); got != 1 {
		t.Fatalf("B 的 visits = %d，期望 1（k 应被委托给 B）", got)
	}
	if got := m.PageAVisits(); got != -1 {
		t.Fatalf("当前页面是 B，PageAVisits 应返回 -1，实际 %d", got)
	}
}

func TestUnhandledMessageNoEffect(t *testing.T) {
	m := pages.New()
	m = update(t, m, tea.WindowSizeMsg{Width: 100, Height: 30})
	if got := m.CurrentPage(); got != "A" {
		t.Fatalf("窗口消息后页面 = %q，期望 A", got)
	}
	if got := m.PageAVisits(); got != 0 {
		t.Fatalf("窗口消息后 visits = %d，期望 0", got)
	}
}

func TestViewNonEmpty(t *testing.T) {
	m := pages.New()
	if v := m.View(); v == "" {
		t.Fatal("Top.View 不应为空")
	}
}
