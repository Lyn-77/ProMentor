/*
 * lab_test.go — Ch 6 行为测试（学生不可改）
 *
 * 黑盒测试：双重校验分界、焦点关卡、默认值提交。
 */
package form_test

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"

	form "WakeUp/.promentor/chapters/ch06-form-validation"
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
	case "tab":
		return tea.KeyMsg{Type: tea.KeyTab}
	case "backspace":
		return tea.KeyMsg{Type: tea.KeyBackspace}
	default:
		return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(s)}
	}
}

func update(t *testing.T, m form.Model, msgs ...tea.Msg) form.Model {
	t.Helper()
	for _, msg := range msgs {
		next, _ := m.Update(msg)
		nm, ok := next.(form.Model)
		if !ok {
			t.Fatalf("Update 返回 %T，期望 form.Model", next)
		}
		m = nm
	}
	return m
}

func TestNewState(t *testing.T) {
	m := form.New()
	if m.Focus() != 0 {
		t.Fatalf("初始 focus = %d，期望 0", m.Focus())
	}
	if m.Value(0) != "" || m.Value(1) != "" {
		t.Fatal("初始值应为空")
	}
	if m.Submitted() {
		t.Fatal("初始不应为已提交")
	}
}

func TestTypingAppendsToFocusedField(t *testing.T) {
	m := form.New()
	m = update(t, m, key("N"), key("A"), key("S"))
	if v := m.Value(0); v != "NAS" {
		t.Fatalf("名称字段 = %q，期望 NAS", v)
	}
	// 聚焦仍在 0，输入不进端口字段
	if v := m.Value(1); v != "" {
		t.Fatalf("端口字段 = %q，期望空", v)
	}
}

func TestBackspace(t *testing.T) {
	m := form.New()
	m = update(t, m, key("A"), key("B"), key("backspace"))
	if v := m.Value(0); v != "A" {
		t.Fatalf("backspace 后名称 = %q，期望 A", v)
	}
}

func TestLooseNameEmptyNoError(t *testing.T) {
	m := form.New()
	// 空名称实时校验不报错
	if e := m.Error(0); e != "" {
		t.Fatalf("空名称实时 Error = %q，期望空串", e)
	}
	// 非空也不报错
	m = update(t, m, key("NAS"))
	if e := m.Error(0); e != "" {
		t.Fatalf("有效名称 Error = %q，期望空串", e)
	}
}

func TestStrictNameRequiredBlocksEnter(t *testing.T) {
	m := form.New()
	m = update(t, m, key("enter")) // 空名称严格校验
	if m.Submitted() {
		t.Fatal("空名称不应提交")
	}
	if m.Focus() != 0 {
		t.Fatalf("校验不过应停留，focus = %d，期望 0", m.Focus())
	}
	if e := m.Error(0); e == "" {
		t.Fatal("空名称 Enter 后 Error(0) 不应为空")
	}
}

func TestLoosePortInvalidShowsImmediately(t *testing.T) {
	m := form.New()
	m = update(t, m, key("NAS"), key("enter")) // 移到端口
	if m.Focus() != 1 {
		t.Fatalf("Enter 后 focus = %d，期望 1", m.Focus())
	}
	m = update(t, m, key("x"))
	if e := m.Error(1); e == "" {
		t.Fatal("非法端口实时校验应立即报错")
	}
}

func TestLoosePortRangeShowsImmediately(t *testing.T) {
	m := form.New()
	m = update(t, m, key("NAS"), key("enter"), key("7"), key("0"), key("0"), key("0"), key("0"))
	if e := m.Error(1); e == "" {
		t.Fatal("端口 70000 超出范围应立即报错")
	}
}

func TestErrorClearsWhenFixed(t *testing.T) {
	m := form.New()
	m = update(t, m, key("NAS"), key("enter"), key("x"))
	if e := m.Error(1); e == "" {
		t.Fatal("非法端口应报错")
	}
	m = update(t, m, key("backspace")) // 删掉 x，端口变空
	if e := m.Error(1); e != "" {
		t.Fatalf("修复后 Error(1) = %q，期望空串", e)
	}
}

func TestSubmitWithDefaultPort(t *testing.T) {
	m := form.New()
	m = update(t, m, key("NAS"), key("enter"), key("enter")) // 空端口提交
	if !m.Submitted() {
		t.Fatal("应已提交")
	}
	if p := m.SubmittedPort(); p != 9 {
		t.Fatalf("空端口提交 SubmittedPort = %d，期望默认 9", p)
	}
}

func TestSubmitWithGivenPort(t *testing.T) {
	m := form.New()
	m = update(t, m, key("NAS"), key("enter"), key("7"), key("enter"))
	if !m.Submitted() {
		t.Fatal("应已提交")
	}
	if p := m.SubmittedPort(); p != 7 {
		t.Fatalf("端口 7 提交 SubmittedPort = %d，期望 7", p)
	}
}

func TestInvalidPortBlocksSubmit(t *testing.T) {
	m := form.New()
	m = update(t, m, key("NAS"), key("enter"), key("x"), key("enter"))
	if m.Submitted() {
		t.Fatal("非法端口不应提交")
	}
	if e := m.Error(1); e == "" {
		t.Fatal("非法端口 Enter 后 Error(1) 不应为空")
	}
}

func TestViewNonEmpty(t *testing.T) {
	m := form.New()
	m = update(t, m, key("NAS"))
	if v := m.View(); v == "" {
		t.Fatal("View 不应为空")
	}
}
