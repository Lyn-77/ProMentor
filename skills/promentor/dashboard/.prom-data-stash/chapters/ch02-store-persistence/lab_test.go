/*
 * lab_test.go — Ch 2 行为测试（学生不可改）
 *
 * 黑盒测试：CRUD 语义、持久化重载、并发写入、纯校验函数。
 */
package store_test

import (
	"errors"
	"sync"
	"testing"

	store "WakeUp/.promentor/chapters/ch02-store-persistence"
)

func device(name, mac string) store.Device {
	return store.Device{Name: name, MAC: mac, Port: 9, Address: "255.255.255.255"}
}

func newStore(t *testing.T) *store.Store {
	t.Helper()
	s, err := store.New(t.TempDir())
	if err != nil {
		t.Fatalf("New 失败: %v", err)
	}
	return s
}

func TestAddAndCount(t *testing.T) {
	s := newStore(t)
	s.Add(device("NAS", "AA:BB:CC:DD:EE:01"))
	s.Add(device("PC", "AA:BB:CC:DD:EE:02"))
	if n := s.Count(); n != 2 {
		t.Fatalf("Count = %d，期望 2", n)
	}
}

func TestAddDuplicateName(t *testing.T) {
	s := newStore(t)
	s.Add(device("NAS", "AA:BB:CC:DD:EE:01"))
	if err := s.Add(device("NAS", "AA:BB:CC:DD:EE:02")); err != store.ErrNameDuplicate {
		t.Fatalf("重复名称应返回 ErrNameDuplicate，得到 %v", err)
	}
	if err := s.Add(device("nas", "AA:BB:CC:DD:EE:02")); err != store.ErrNameDuplicate {
		t.Fatalf("大小写不敏感：'nas' 应冲突，得到 %v", err)
	}
}

func TestUpdate(t *testing.T) {
	s := newStore(t)
	s.Add(device("NAS", "AA:BB:CC:DD:EE:01"))
	if err := s.Update(0, device("NAS2", "AA:BB:CC:DD:EE:99")); err != nil {
		t.Fatalf("Update 失败: %v", err)
	}
	d, err := s.FindByIndex(0)
	if err != nil || d.Name != "NAS2" {
		t.Fatalf("更新后名称 = %q, err=%v", d.Name, err)
	}
}

func TestUpdateNameDuplicateExcludingSelf(t *testing.T) {
	s := newStore(t)
	s.Add(device("NAS", "AA:BB:CC:DD:EE:01"))
	s.Add(device("PC", "AA:BB:CC:DD:EE:02"))
	// 保持自身名字：应该成功
	if err := s.Update(0, device("NAS", "AA:BB:CC:DD:EE:11")); err != nil {
		t.Fatalf("保留自身名字应成功，得到 %v", err)
	}
	// 改成别人的名字：应该失败
	if err := s.Update(0, device("PC", "AA:BB:CC:DD:EE:11")); err != store.ErrNameDuplicate {
		t.Fatalf("改成他人名字应 ErrNameDuplicate，得到 %v", err)
	}
}

func TestUpdateOutOfRange(t *testing.T) {
	s := newStore(t)
	if err := s.Update(5, device("X", "AA:BB:CC:DD:EE:01")); err != store.ErrNotFound {
		t.Fatalf("越界 Update 应 ErrNotFound，得到 %v", err)
	}
}

func TestDelete(t *testing.T) {
	s := newStore(t)
	s.Add(device("NAS", "AA:BB:CC:DD:EE:01"))
	s.Add(device("PC", "AA:BB:CC:DD:EE:02"))
	if err := s.Delete(0); err != nil {
		t.Fatalf("Delete 失败: %v", err)
	}
	if n := s.Count(); n != 1 {
		t.Fatalf("删除后 Count = %d，期望 1", n)
	}
	if d, err := s.FindByIndex(0); err != nil || d.Name != "PC" {
		t.Fatalf("删除 0 后索引 0 应为 PC，得到 %q err=%v", d.Name, err)
	}
}

func TestDeleteOutOfRange(t *testing.T) {
	s := newStore(t)
	if err := s.Delete(0); err != store.ErrNotFound {
		t.Fatalf("空 store 删除应 ErrNotFound，得到 %v", err)
	}
}

func TestFindByName(t *testing.T) {
	s := newStore(t)
	s.Add(device("NAS", "AA:BB:CC:DD:EE:01"))
	d, idx, err := s.FindByName("nas") // 大小写不敏感
	if err != nil || d.Name != "NAS" || idx != 0 {
		t.Fatalf("FindByName(\"nas\") = (%q,%d,%v)，期望 (NAS,0,nil)", d.Name, idx, err)
	}
	_, _, err = s.FindByName("不存在")
	if !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("未找到应 ErrNotFound，得到 %v", err)
	}
}

func TestListReturnsCopy(t *testing.T) {
	s := newStore(t)
	s.Add(device("NAS", "AA:BB:CC:DD:EE:01"))
	l := s.List()
	l[0].Name = "hacked" // 修改返回的 slice
	d, _ := s.FindByIndex(0)
	if d.Name == "hacked" {
		t.Fatal("List 返回的是内部引用：外部修改污染了 store 状态")
	}
}

func TestPersistAndReload(t *testing.T) {
	dir := t.TempDir()
	s, _ := store.New(dir)
	s.Add(device("NAS", "AA:BB:CC:DD:EE:01"))
	s.Add(device("PC", "AA:BB:CC:DD:EE:02"))
	if err := s.Save(); err != nil {
		t.Fatalf("Save 失败: %v", err)
	}

	s2, err := store.New(dir)
	if err != nil {
		t.Fatalf("重新加载失败: %v", err)
	}
	if n := s2.Count(); n != 2 {
		t.Fatalf("重载后 Count = %d，期望 2", n)
	}
	d, _, err := s2.FindByName("pc")
	if err != nil || d.Name != "PC" {
		t.Fatalf("重载后 FindByName(\"pc\") = (%q, %v)", d.Name, err)
	}
}

func TestConcurrentAdds(t *testing.T) {
	s := newStore(t)
	const goroutines = 10
	const each = 10
	var wg sync.WaitGroup
	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			for i := 0; i < each; i++ {
				s.Add(device(
					"dev-g"+string(rune('0'+g))+"-"+string(rune('0'+i)),
					"AA:BB:CC:DD:EE:FF",
				))
			}
		}(g)
	}
	wg.Wait()
	if n := s.Count(); n != goroutines*each {
		t.Fatalf("并发写入后 Count = %d，期望 %d（存在数据竞争/丢失更新）", n, goroutines*each)
	}
}

func TestValidateMACNormalizes(t *testing.T) {
	cases := []struct{ in, want string }{
		{"AA:BB:CC:DD:EE:FF", "AA:BB:CC:DD:EE:FF"},
		{"aa-bb-cc-dd-ee-ff", "AA:BB:CC:DD:EE:FF"},
		{"aabb.ccdd.eeff", "AA:BB:CC:DD:EE:FF"},
		{"aabbccddeeff", "AA:BB:CC:DD:EE:FF"},
		{"AAbbCCddEeFf", "AA:BB:CC:DD:EE:FF"},
	}
	for _, c := range cases {
		got, err := store.ValidateMAC(c.in)
		if err != nil {
			t.Fatalf("ValidateMAC(%q) 返回错误 %v", c.in, err)
		}
		if got != c.want {
			t.Fatalf("ValidateMAC(%q) = %q，期望 %q", c.in, got, c.want)
		}
	}
}

func TestValidateMACPartial(t *testing.T) {
	for _, in := range []string{"", "aa", "aabbccddee", "gg"} {
		if _, err := store.ValidateMAC(in); !errors.Is(err, store.ErrMACPartial) {
			t.Fatalf("ValidateMAC(%q) 应 ErrMACPartial，得到 %v", in, err)
		}
	}
}

func TestValidateMACInvalid(t *testing.T) {
	if _, err := store.ValidateMAC("aabbccddeeff00"); !errors.Is(err, store.ErrMACInvalid) {
		t.Fatalf("14 位 hex 应 ErrMACInvalid，得到 %v", err)
	}
}

func TestValidatePort(t *testing.T) {
	for _, p := range []int{1, 9, 65535} {
		if err := store.ValidatePort(p); err != nil {
			t.Fatalf("ValidatePort(%d) 应通过，得到 %v", p, err)
		}
	}
	for _, p := range []int{0, -1, 65536} {
		if err := store.ValidatePort(p); !errors.Is(err, store.ErrPortInvalid) {
			t.Fatalf("ValidatePort(%d) 应 ErrPortInvalid，得到 %v", p, err)
		}
	}
}

func TestValidateIP(t *testing.T) {
	for _, ip := range []string{"127.0.0.1", "255.255.255.255", "0.0.0.0"} {
		if err := store.ValidateIP(ip); err != nil {
			t.Fatalf("ValidateIP(%q) 应通过，得到 %v", ip, err)
		}
	}
	for _, ip := range []string{"999.1.1.1", "abc", "::1", ""} {
		if err := store.ValidateIP(ip); !errors.Is(err, store.ErrIPInvalid) {
			t.Fatalf("ValidateIP(%q) 应 ErrIPInvalid，得到 %v", ip, err)
		}
	}
}

func TestValidateName(t *testing.T) {
	if err := store.ValidateName("NAS"); err != nil {
		t.Fatalf("ValidateName(NAS) 应通过，得到 %v", err)
	}
	for _, n := range []string{"", "   ", "\t"} {
		if err := store.ValidateName(n); !errors.Is(err, store.ErrNameEmpty) {
			t.Fatalf("ValidateName(%q) 应 ErrNameEmpty，得到 %v", n, err)
		}
	}
}
