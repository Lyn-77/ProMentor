/*
 * lab_test.go — Ch 1 行为测试（学生不可改）
 *
 * 黑盒测试：本地起 UDP 监听，校验发出的魔术包字节结构。
 */
package wol_test

import (
	"bytes"
	"net"
	"testing"
	"time"

	wol "WakeUp/.promentor/chapters/ch01-wol-magic-packet"
)

const testMAC = "AA:BB:CC:DD:EE:FF"

// startListener 起一个本地 UDP 监听，返回 端口 + 读函数
func startListener(t *testing.T) (int, func() ([]byte, error)) {
	t.Helper()
	addr := net.UDPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 0}
	conn, err := net.ListenUDP("udp", &addr)
	if err != nil {
		t.Fatalf("起 UDP 监听失败: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	read := func() ([]byte, error) {
		conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		buf := make([]byte, 2048)
		n, _, err := conn.ReadFromUDP(buf)
		return buf[:n], err
	}
	return conn.LocalAddr().(*net.UDPAddr).Port, read
}

func TestSendMagicPacketStructure(t *testing.T) {
	port, read := startListener(t)

	if err := wol.SendMagicPacket(testMAC, "127.0.0.1", port); err != nil {
		t.Fatalf("SendMagicPacket 返回错误: %v", err)
	}

	packet, err := read()
	if err != nil {
		t.Fatalf("未收到魔术包: %v", err)
	}
	if len(packet) != wol.MagicPacketLen {
		t.Fatalf("包长度 = %d，期望 %d", len(packet), wol.MagicPacketLen)
	}

	// 同步流：前 6 字节全 0xFF
	sync := packet[:6]
	for i, b := range sync {
		if b != 0xFF {
			t.Fatalf("同步流第 %d 字节 = 0x%02X，期望 0xFF", i, b)
		}
	}

	// MAC 重复 16 次
	mac, err := net.ParseMAC(testMAC)
	if err != nil {
		t.Fatal(err)
	}
	rest := packet[6:]
	for i := 0; i < 16; i++ {
		chunk := rest[i*6 : i*6+6]
		if !bytes.Equal(chunk, mac) {
			t.Fatalf("第 %d 份 MAC 拷贝 = %x，期望 %x", i, chunk, mac)
		}
	}
}

func TestSendMagicPacketNilOnSuccess(t *testing.T) {
	port, _ := startListener(t)
	if err := wol.SendMagicPacket(testMAC, "127.0.0.1", port); err != nil {
		t.Fatalf("合法输入应返回 nil，得到: %v", err)
	}
}

func TestInvalidMACReturnsError(t *testing.T) {
	port, _ := startListener(t)
	for _, bad := range []string{"GG:HH:II:JJ:KK:LL", "hello", ":", ""} {
		if err := wol.SendMagicPacket(bad, "127.0.0.1", port); err == nil {
			t.Fatalf("非法 MAC %q 应返回错误，得到 nil", bad)
		}
	}
}

func TestNonSixByteMACReturnsError(t *testing.T) {
	port, _ := startListener(t)
	// EUI-64 是 8 字节，ParseMAC 会接受，但魔术包只要 6 字节
	// 8 字节地址解析成功但长度非 6，应被拒绝
	if err := wol.SendMagicPacket("01:02:03:04:05:06:07:08", "127.0.0.1", port); err == nil {
		t.Fatal("8 字节 EUI-64 地址应被拒绝，得到 nil")
	}
}
