
# Peningkatan UX Printer Network

## Ringkasan
Menambahkan panduan cara menemukan IP printer dan fitur test connection sebelum menyimpan konfigurasi printer network.

## Fitur yang Akan Ditambahkan

### 1. Panduan Cara Menemukan IP Printer
Collapsible section berisi langkah-langkah praktis untuk menemukan IP printer dari berbagai sumber:
- Cara cetak halaman konfigurasi dari printer
- Cara cek dari router (DHCP client list)  
- Contoh IP range umum yang biasa digunakan

### 2. Tombol Test Connection
Tombol untuk memvalidasi koneksi ke printer sebelum menyimpan:
- Mencoba koneksi ke IP:Port yang dimasukkan
- Menampilkan status sukses/gagal dengan visual feedback
- Mengirim test print sederhana (opsional)

### 3. Visual Status Connection
Badge/indicator yang menunjukkan:
- Belum ditest (default)
- Sedang testing (loading)
- Berhasil terkoneksi (hijau)
- Gagal terkoneksi (merah dengan pesan error)

## Perubahan UI

### Form Network Printer (Sebelum)
```text
+---------------------------+
| IP Address    | Port      |
| [192.168.x.x] | [9100]    |
+---------------------------+
```

### Form Network Printer (Sesudah)
```text
+----------------------------------------+
| IP Address    | Port      | [Test]     |
| [192.168.x.x] | [9100]    | Connection |
+----------------------------------------+
| [i] Status: Terkoneksi / Gagal         |
+----------------------------------------+

[?] Cara Menemukan IP Printer (klik expand)
  +--------------------------------------+
  | 1. Cetak dari Printer:               |
  |    Tekan tombol Feed 5 detik untuk   |
  |    mencetak halaman konfigurasi      |
  |                                      |
  | 2. Cek di Router:                    |
  |    Buka 192.168.1.1 > DHCP Clients   |
  |    Cari device dengan nama "EPSON"   |
  |                                      |
  | 3. IP Umum Printer:                  |
  |    192.168.1.100 - 192.168.1.200     |
  +--------------------------------------+
```

## Detail Teknis

### Test Connection Logic
```text
1. User masukkan IP + Port
2. Klik "Test Connection"
3. Sistem coba buka WebSocket/fetch ke IP:Port
4. Timeout 5 detik
5. Tampilkan hasil (sukses/gagal)
```

### Catatan Teknis
- Browser tidak bisa langsung konek ke raw TCP socket (port 9100)
- Alternatif: Menggunakan fetch untuk test basic reachability
- Limitasi: Tidak bisa 100% memastikan printer ESC/POS aktif, tapi bisa validasi IP reachable

### File yang Akan Dimodifikasi
- `src/pages/pos/PrinterSettings.tsx` - Tambah guide + test connection

## Hasil Akhir
User akan mendapat pengalaman yang lebih baik saat setup printer network:
1. Tidak bingung cara menemukan IP printer
2. Bisa validasi koneksi sebelum save
3. Mengurangi trial-and-error saat setup
