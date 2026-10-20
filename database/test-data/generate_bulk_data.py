"""Sinh dữ liệu test số lượng lớn cho TrungTamBaoHanhDB (SQL Server) — chỉ dùng cho DB dev.

Đọc bộ đếm mã (BoDemMa), SĐT/serial/tên đăng nhập đã có từ DB để không trùng, rồi ghi một file .sql chạy trong
MỘT transaction (lỗi thì không ghi gì). Dữ liệu đi đúng máy trạng thái phiếu (Ticket.cs): lịch sử trạng thái, phân công,
kiểm tra, báo giá, xuất kho, sửa chữa, thu tiền, bàn giao đều khớp với trạng thái hiện tại của phiếu.

    python generate_bulk_data.py [--server localhost,1433] [--db TrungTamBaoHanhDB_Dev] [--tickets 600] [--customers 400]
    sqlcmd -S localhost,1433 -E -C -d TrungTamBaoHanhDB_Dev -I -b -f 65001 -i bulk_data.sql
"""
import argparse
import os
import random
import subprocess
import unicodedata
from datetime import date, datetime, timedelta

ap = argparse.ArgumentParser()
ap.add_argument("--server", default="localhost,1433")
ap.add_argument("--db", default="TrungTamBaoHanhDB_Dev")
ap.add_argument("--customers", type=int, default=400)
ap.add_argument("--tickets", type=int, default=600)
ap.add_argument("--seed", type=int, default=20261004)
ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "bulk_data.sql"))
args = ap.parse_args()
rnd = random.Random(args.seed)


# ------------------------------------------------------------------ đọc DB
def query(sql):
    out = subprocess.run(
        ["sqlcmd", "-S", args.server, "-E", "-C", "-d", args.db, "-W", "-h", "-1", "-s", "|", "-Q", "SET NOCOUNT ON; " + sql],
        capture_output=True, text=True, check=True).stdout
    return [line.split("|") for line in out.splitlines() if line.strip()]


counters = {k: int(v) for k, v in query("SELECT Khoa, GiaTri FROM BoDemMa")}
used_phones = {r[0] for r in query("SELECT SDT FROM KhachHang UNION SELECT SDT FROM NhanVien")}
used_serials = {r[0] for r in query("SELECT SoSerial_IMEI FROM ThietBi UNION SELECT SoSerial_IMEI FROM YeuCauBaoHanh")}
used_logins = {r[0].lower() for r in query("SELECT TenDangNhap FROM TaiKhoan")}
used_emails = {r[0].lower() for r in query("SELECT Email FROM NhanVien WHERE Email IS NOT NULL")}
request_has_customer = bool(query("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'YeuCauBaoHanh' AND COLUMN_NAME = 'MaKH'"))
# DB chưa chạy 05_upgrade_existing_db.sql: CHECK của PhieuTiepNhan chưa có AWAITING_RETURN
allow_awaiting_return = bool(query("SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PTN_TrangThai' "
                                   "AND definition LIKE '%AWAITING_RETURN%'"))
max_account = int(query("SELECT MAX(MaTaiKhoan) FROM TaiKhoan")[0][0])
max_file = int(query("SELECT ISNULL(MAX(MaTep), 0) FROM TepDinhKem")[0][0])
NOW = datetime.fromisoformat(query(
    "SELECT CONVERT(VARCHAR(19), CONVERT(DATETIME2(0), SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time'), 126)")[0][0]) \
    - timedelta(minutes=5)
YEAR = NOW.year

# ------------------------------------------------------------------ dữ liệu tham chiếu (khớp 02/03_*.sql)
PASSWORD_1234 = "{bcrypt}$2a$12$PEe08usM2pa/C6eajRuCFu1ZW2P32x.ywki5/UAB/OK43j.H7fyLm"
STAFF = {  # MaNV: (họ tên, vai trò)
    "NV-001": ("Lê Minh Tâm", "DISPATCHER"), "NV-101": ("Trần Thị Hoa", "DISPATCHER"),
    "NV-004": ("Trần Bảo Trâm", "RECEPTIONIST"), "NV-102": ("Nguyễn Văn An", "RECEPTIONIST"),
    "NV-002": ("Nguyễn Văn A", "TECHNICIAN"), "NV-005": ("Lê Hoàng Phúc", "TECHNICIAN"),
    "NV-007": ("Phạm Thị Ngọc Hân", "TECHNICIAN"), "NV-009": ("Đỗ Anh Tuấn", "TECHNICIAN"),
    "NV-103": ("Lê Quốc Bình", "TECHNICIAN"), "NV-104": ("Phạm Minh Chinh", "TECHNICIAN"),
    "NV-105": ("Hoàng Anh Dũng", "TECHNICIAN"),
    "NV-003": ("Đặng Văn Kiên", "WAREHOUSE_KEEPER"), "NV-106": ("Vũ Thị Em", "WAREHOUSE_KEEPER"),
    "NV-010": ("Hồ Quỳnh Như", "CASHIER"), "NV-107": ("Đỗ Văn Phúc", "CASHIER"),
}
ROLE_LABEL = {"DISPATCHER": "Điều phối viên", "RECEPTIONIST": "Tiếp nhận & Lễ tân", "TECHNICIAN": "Kỹ thuật viên",
              "WAREHOUSE_KEEPER": "Quản lý kho vật tư", "CASHIER": "Thu ngân & Bàn giao"}
LABEL = {"RECEIVED": "Đã tiếp nhận", "INSPECTING": "Đang kiểm tra", "DIAGNOSED": "Đã chẩn đoán",
         "AWAITING_QUOTE_APPROVAL": "Chờ duyệt giá", "AWAITING_CUSTOMER_CONFIRMATION": "Chờ khách xác nhận",
         "AWAITING_PARTS": "Chờ linh kiện", "AWAITING_RETURN": "Chờ trả máy", "REPAIRING": "Đang sửa chữa",
         "COMPLETED": "Hoàn thành", "DELIVERED": "Đã bàn giao", "RETURNED_UNREPAIRED": "Đã trả máy (không sửa)"}
BRAND_POLICY = {"SAMSUNG": ("CS-0005", 24), "APPLE": ("CS-0006", 12), "LG": ("CS-0007", 24), "ASUS": ("CS-0008", 12),
                "ELECTROLUX": ("CS-0009", 24), "DAIKIN": ("CS-0010", 24), "TPLINK": ("CS-0011", 24),
                "CANON": ("CS-0012", 12), "SONY": ("CS-0013", 12), "DELL": ("CS-0014", 36)}
DISTRIBUTOR = {"APPLE": "Apple Việt Nam (qua FPT Trading)", "SAMSUNG": "Samsung Việt Nam", "LG": "LG Electronics Việt Nam",
               "ASUS": "ASUS Việt Nam", "ELECTROLUX": "Electrolux Việt Nam", "DAIKIN": "Daikin Việt Nam",
               "TPLINK": "TP-Link Việt Nam", "CANON": "Canon Marketing Việt Nam", "SONY": "Sony Việt Nam",
               "DELL": "Dell Việt Nam", "MICROSOFT": "Microsoft Việt Nam (qua Digiworld)"}
BRAND_NAME = {"APPLE": "Apple", "SAMSUNG": "Samsung", "LG": "LG", "ASUS": "ASUS", "ELECTROLUX": "Electrolux",
              "DAIKIN": "Daikin", "TPLINK": "TP-Link", "CANON": "Canon", "SONY": "Sony", "DELL": "Dell", "MICROSOFT": "Microsoft"}
TYPE_GROUP = {"SMARTPHONE": "PHONE", "LAPTOP": "LAPTOP_TABLET", "TABLET": "LAPTOP_TABLET", "SMARTWATCH": "AUDIO_WEARABLE",
              "TWS_EARBUDS": "AUDIO_WEARABLE", "AIR_CONDITIONER": "HOME_APPLIANCE", "FRIDGE_INVERTER": "HOME_APPLIANCE",
              "WASHER_FRONT": "HOME_APPLIANCE", "GAME_CONSOLE": "SMALL_ELECTRONICS", "PRINTER": "SMALL_ELECTRONICS",
              "ROUTER": "SMALL_ELECTRONICS", "MONITOR": "TV_MONITOR", "TV": "TV_MONITOR"}
CHECKLIST = {"AIR_CONDITIONER": ["Block lạnh", "Gas lạnh", "Bo mạch điều khiển", "Quạt dàn lạnh"],
             "FRIDGE_INVERTER": ["Block máy nén", "Bo mạch inverter", "Cảm biến nhiệt độ", "Motor quạt"],
             "GAME_CONSOLE": ["Bo nguồn", "Ổ đĩa quang học", "Hệ thống tản nhiệt", "Cổng kết nối tay cầm"],
             "LAPTOP": ["Pin", "Bo mạch chủ", "Màn hình", "Hệ thống tản nhiệt"],
             "MONITOR": ["Tấm nền (panel)", "Bo nguồn", "Cổng tín hiệu", "Bo điều khiển"],
             "PRINTER": ["Đầu phun / trống mực", "Bo mạch điều khiển", "Motor kéo giấy", "Cảm biến giấy"],
             "ROUTER": ["Bo mạch chính", "Nguồn adapter", "Ăng-ten", "Firmware"],
             "SMARTPHONE": ["Pin", "Màn hình cảm ứng", "Camera", "Loa & micro"],
             "SMARTWATCH": ["Pin", "Màn hình cảm ứng", "Cảm biến", "Kết nối Bluetooth"],
             "TABLET": ["Pin", "Màn hình cảm ứng", "Bo mạch chính", "Cổng sạc"],
             "TV": ["Bo nguồn", "Bo mạch chính", "Tấm nền (panel)", "Đèn nền (backlight)"],
             "TWS_EARBUDS": ["Pin", "Driver âm thanh", "Kết nối Bluetooth", "Hộp sạc"],
             "WASHER_FRONT": ["Motor xả", "Bo mạch điều khiển", "Khóa cửa", "Hệ thống cấp nước"]}
SERVICE = {"PHONE": "DV-SMARTPHONE", "LAPTOP_TABLET": "DV-LAPTOP", "AUDIO_WEARABLE": "DV-AUDIO",
           "HOME_APPLIANCE": "DV-GIADUNG", "SMALL_ELECTRONICS": "DV-NHO", "TV_MONITOR": "DV-TV"}
LABOR = {"PHONE": 150000, "LAPTOP_TABLET": 250000, "AUDIO_WEARABLE": 120000, "HOME_APPLIANCE": 350000,
         "SMALL_ELECTRONICS": 150000, "TV_MONITOR": 300000}

# Sản phẩm sẵn có (SP-0001..0005) + sản phẩm mới: (loại, hãng, tên, dòng)
EXISTING_PRODUCTS = [("SP-0001", "SMARTPHONE", "APPLE", "iPhone 14", 12), ("SP-0002", "LAPTOP", "APPLE", "MacBook Air M2", 12),
                     ("SP-0003", "SMARTPHONE", "SAMSUNG", "Galaxy S23", 12), ("SP-0004", "LAPTOP", "DELL", "Laptop Inspiron 15", 24),
                     ("SP-0005", "TWS_EARBUDS", "APPLE", "Tai nghe Bluetooth AirPods Pro", 12)]
PRODUCT_POLICY = {"SP-0001": "CS-0001", "SP-0002": "CS-0002", "SP-0003": "CS-0003", "SP-0004": "CS-0004"}
NEW_PRODUCTS = [
    ("SMARTPHONE", "APPLE", "iPhone 13", "iPhone"), ("SMARTPHONE", "APPLE", "iPhone 15", "iPhone"),
    ("SMARTPHONE", "APPLE", "iPhone 15 Pro Max", "iPhone"), ("SMARTPHONE", "APPLE", "iPhone 16 Pro", "iPhone"),
    ("SMARTPHONE", "SAMSUNG", "Galaxy S24 Ultra", "Galaxy S"), ("SMARTPHONE", "SAMSUNG", "Galaxy A55", "Galaxy A"),
    ("SMARTPHONE", "SAMSUNG", "Galaxy A35", "Galaxy A"), ("SMARTPHONE", "SAMSUNG", "Galaxy Z Flip6", "Galaxy Z"),
    ("LAPTOP", "APPLE", "MacBook Pro 14 M3", "MacBook"), ("TABLET", "APPLE", "iPad Air M2", "iPad"),
    ("TABLET", "APPLE", "iPad Gen 10", "iPad"), ("LAPTOP", "ASUS", "Vivobook 15 X1504", "Vivobook"),
    ("LAPTOP", "ASUS", "ROG Strix G16", "ROG"), ("LAPTOP", "ASUS", "Zenbook 14 OLED", "Zenbook"),
    ("TABLET", "ASUS", "ROG Flow Z13", "ROG"), ("LAPTOP", "DELL", "XPS 13 9340", "XPS"),
    ("LAPTOP", "DELL", "Latitude 5440", "Latitude"), ("SMARTWATCH", "APPLE", "Apple Watch Series 9", "Apple Watch"),
    ("SMARTWATCH", "SAMSUNG", "Galaxy Watch6", "Galaxy Watch"), ("TWS_EARBUDS", "SAMSUNG", "Galaxy Buds2 Pro", "Galaxy Buds"),
    ("TWS_EARBUDS", "SONY", "WF-1000XM5", "1000X"), ("TWS_EARBUDS", "APPLE", "AirPods 4", "AirPods"),
    ("AIR_CONDITIONER", "DAIKIN", "Máy lạnh Daikin Inverter 1 HP FTKB25", "FTKB"),
    ("AIR_CONDITIONER", "DAIKIN", "Máy lạnh Daikin Inverter 1.5 HP FTKY35", "FTKY"),
    ("AIR_CONDITIONER", "LG", "Máy lạnh LG Dual Inverter 1.5 HP", "Dual Inverter"),
    ("WASHER_FRONT", "ELECTROLUX", "Máy giặt Electrolux Inverter 10 kg EWF1024", "UltimateCare"),
    ("FRIDGE_INVERTER", "ELECTROLUX", "Tủ lạnh Electrolux Inverter 340 lít", "NutriFresh"),
    ("WASHER_FRONT", "LG", "Máy giặt LG AI DD Inverter 9 kg", "AI DD"),
    ("FRIDGE_INVERTER", "LG", "Tủ lạnh LG Inverter 394 lít", "DoorCooling+"),
    ("FRIDGE_INVERTER", "SAMSUNG", "Tủ lạnh Samsung Inverter 488 lít", "Bespoke"),
    ("WASHER_FRONT", "SAMSUNG", "Máy giặt Samsung AI EcoBubble 10 kg", "EcoBubble"),
    ("PRINTER", "CANON", "Máy in Canon PIXMA G3010", "PIXMA"), ("PRINTER", "CANON", "Máy in Canon LBP2900", "LBP"),
    ("GAME_CONSOLE", "MICROSOFT", "Xbox Series X", "Xbox"), ("GAME_CONSOLE", "SONY", "PlayStation 5 Slim", "PlayStation"),
    ("ROUTER", "TPLINK", "Router Wi-Fi 6 Archer AX23", "Archer"), ("ROUTER", "TPLINK", "Deco X50 (2-pack)", "Deco"),
    ("MONITOR", "DELL", "Màn hình UltraSharp U2723QE", "UltraSharp"), ("MONITOR", "DELL", "Màn hình Dell P2422H", "P Series"),
    ("TV", "LG", "Smart TV LG OLED 55C3", "OLED evo"), ("TV", "LG", "Smart TV LG NanoCell 50 inch", "NanoCell"),
    ("MONITOR", "LG", "Màn hình LG UltraGear 27GP850", "UltraGear"),
]
# Linh kiện mới theo loại thiết bị: (tên, giá vốn, tháng bảo hành)
NEW_PARTS = {
    "SMARTPHONE": [("Màn hình OLED iPhone 15", 3900000, 6), ("Pin iPhone 13 chính hãng", 650000, 6),
                   ("Camera sau Galaxy S24", 1450000, 6), ("Cụm loa ngoài smartphone", 180000, 3),
                   ("Cổng sạc Type-C smartphone", 120000, 3)],
    "LAPTOP": [("Màn hình laptop 15.6 inch FHD", 1600000, 6), ("Quạt tản nhiệt laptop", 280000, 3),
               ("SSD NVMe 512GB", 950000, 12), ("Bàn phím ASUS Vivobook 15", 520000, 3), ("Bản lề màn hình laptop", 300000, 3)],
    "TABLET": [("Màn hình iPad Air", 4200000, 6), ("Pin iPad", 900000, 6)],
    "SMARTWATCH": [("Pin Apple Watch", 550000, 6), ("Mặt kính smartwatch", 700000, 3)],
    "TWS_EARBUDS": [("Pin tai nghe TWS", 250000, 3), ("Hộp sạc tai nghe TWS", 600000, 6)],
    "AIR_CONDITIONER": [("Bo mạch dàn lạnh inverter", 1350000, 6), ("Tụ quạt máy lạnh", 90000, 3),
                        ("Cảm biến nhiệt máy lạnh", 110000, 3)],
    "FRIDGE_INVERTER": [("Cảm biến nhiệt độ tủ lạnh", 150000, 3), ("Bo mạch inverter tủ lạnh", 1700000, 6),
                        ("Gioăng cửa tủ lạnh", 250000, 3)],
    "WASHER_FRONT": [("Khóa cửa máy giặt", 320000, 6), ("Van cấp nước máy giặt", 210000, 3), ("Dây curoa máy giặt", 160000, 3)],
    "GAME_CONSOLE": [("Ổ đĩa quang PlayStation 5", 1900000, 6), ("Quạt tản nhiệt console", 450000, 3)],
    "PRINTER": [("Đầu phun Canon PIXMA", 900000, 3), ("Motor kéo giấy máy in", 380000, 3)],
    "ROUTER": [("Adapter nguồn router 12V", 90000, 3), ("Ăng-ten router Wi-Fi 6", 60000, 3)],
    "MONITOR": [("Bo nguồn màn hình", 520000, 6), ("Bo T-con monitor", 680000, 6)],
    "TV": [("Thanh LED backlight TV 55 inch", 750000, 6), ("Bo nguồn TV LG", 1100000, 6), ("Mainboard Smart TV", 1900000, 6)],
}
PART_ABBR = {"SMARTPHONE": "PHN", "LAPTOP": "LAP", "TABLET": "TAB", "SMARTWATCH": "WCH", "TWS_EARBUDS": "TWS",
             "AIR_CONDITIONER": "AC", "FRIDGE_INVERTER": "FRG", "WASHER_FRONT": "WSH", "GAME_CONSOLE": "GC", "PRINTER": "PRN",
             "ROUTER": "RTR", "MONITOR": "MON", "TV": "TV"}
# Lỗi theo loại: (khách báo, kết quả kiểm tra, hướng xử lý, chỉ số linh kiện trong NEW_PARTS hoặc None)
FAULTS = {
    "SMARTPHONE": [("Màn hình bị sọc xanh, cảm ứng loạn", "Tấm nền OLED lỗi, cảm ứng không nhận vùng dưới.", "Thay màn hình", 0),
                   ("Pin tụt nhanh, máy tự tắt khi còn 20%", "Pin chai, dung lượng còn 71% thiết kế.", "Thay pin chính hãng", 1),
                   ("Camera sau bị mờ, không lấy nét", "Module camera sau lỗi cơ cấu lấy nét.", "Thay camera sau", 2),
                   ("Loa ngoài rè, nghe gọi nhỏ", "Màng loa ngoài rách.", "Thay cụm loa ngoài", 3),
                   ("Cắm sạc không nhận, phải lắc dây", "Chân cổng sạc lỏng, bám bụi oxy hóa.", "Thay cổng sạc", 4),
                   ("Máy tự khởi động lại liên tục", "Lỗi phần mềm hệ thống, phần cứng nguồn ổn định.", "Cài lại firmware", None)],
    "LAPTOP": [("Màn hình nháy, lúc lên lúc không", "Tấm nền LCD lỗi, cáp màn hình bình thường.", "Thay màn hình", 0),
               ("Máy nóng, quạt kêu to rồi tắt nguồn", "Quạt tản nhiệt khô dầu, keo tản nhiệt khô.", "Thay quạt, tra keo tản nhiệt", 1),
               ("Máy chạy rất chậm, báo lỗi ổ đĩa", "SSD có bad sector, SMART cảnh báo.", "Thay SSD, cài lại hệ điều hành", 2),
               ("Một số phím không ăn", "Bàn phím liệt cụm phím do oxy hóa.", "Thay bàn phím", 3),
               ("Bản lề gãy, mở màn hình bị kẹt", "Bản lề trái nứt, vỏ chân bản lề bung.", "Thay bản lề", 4),
               ("Không lên Windows, báo lỗi khởi động", "Lỗi bootloader, ổ cứng bình thường.", "Sửa boot, cài lại hệ điều hành", None)],
    "TABLET": [("Màn hình vỡ góc, cảm ứng chập chờn", "Kính và cảm ứng nứt góc phải.", "Thay màn hình", 0),
               ("Pin phồng, vỏ bị hở", "Pin phồng, đẩy màn hình hở mép.", "Thay pin", 1),
               ("Máy treo logo", "Lỗi phần mềm, không hư phần cứng.", "Cài lại hệ điều hành", None)],
    "SMARTWATCH": [("Đồng hồ hết pin rất nhanh", "Pin chai, sụt áp khi bật GPS.", "Thay pin", 0),
                   ("Mặt kính nứt", "Kính mặt trước nứt, cảm ứng còn hoạt động.", "Thay mặt kính", 1),
                   ("Không đo được nhịp tim", "Cảm biến quang bám bẩn, firmware cũ.", "Vệ sinh cảm biến, cập nhật firmware", None)],
    "TWS_EARBUDS": [("Một bên tai không sạc vào", "Pin tai phải không nhận sạc.", "Thay pin tai nghe", 0),
                    ("Hộp sạc không lên đèn", "Mạch sạc hộp lỗi.", "Thay hộp sạc", 1),
                    ("Kết nối Bluetooth hay rớt", "Firmware lỗi, ăng-ten bình thường.", "Reset và cập nhật firmware", None)],
    "AIR_CONDITIONER": [("Máy lạnh không lạnh, báo lỗi E7", "Bo mạch dàn lạnh lỗi IC điều khiển quạt.", "Thay bo mạch dàn lạnh", 0),
                        ("Quạt dàn lạnh quay yếu", "Tụ quạt giảm điện dung.", "Thay tụ quạt", 1),
                        ("Máy chạy một lúc thì ngắt", "Cảm biến nhiệt dàn lạnh sai số.", "Thay cảm biến nhiệt", 2),
                        ("Chảy nước dàn lạnh", "Ống thoát nước nghẹt.", "Vệ sinh, thông ống thoát nước", None)],
    "FRIDGE_INVERTER": [("Ngăn mát không lạnh", "Cảm biến nhiệt ngăn mát hỏng.", "Thay cảm biến nhiệt", 0),
                        ("Tủ không chạy, đèn vẫn sáng", "Bo inverter lỗi, máy nén không được cấp nguồn.", "Thay bo mạch inverter", 1),
                        ("Cửa tủ đóng không kín, đọng nước", "Gioăng cửa rách, biến dạng.", "Thay gioăng cửa", 2)],
    "WASHER_FRONT": [("Máy báo lỗi cửa, không giặt được", "Khóa cửa hỏng công tắc.", "Thay khóa cửa", 0),
                     ("Không cấp nước vào", "Van cấp nước kẹt.", "Thay van cấp nước", 1),
                     ("Lồng không quay, có mùi khét", "Dây curoa mòn, trượt.", "Thay dây curoa", 2),
                     ("Máy rung mạnh khi vắt", "Chân đế lệch, cân bằng sai.", "Cân chỉnh lại máy", None)],
    "GAME_CONSOLE": [("Không đọc được đĩa", "Ổ đĩa quang hỏng cụm laser.", "Thay ổ đĩa quang", 0),
                     ("Máy nóng, tự tắt khi chơi", "Quạt tản nhiệt yếu, bụi bám nhiều.", "Thay quạt, vệ sinh", 1),
                     ("Tay cầm không kết nối", "Lỗi firmware kết nối.", "Cập nhật firmware", None)],
    "PRINTER": [("In bị sọc, mất màu", "Đầu phun tắc, một số kim hỏng.", "Thay đầu phun", 0),
                ("Kẹt giấy liên tục", "Motor kéo giấy yếu, bánh xe mòn.", "Thay motor kéo giấy", 1),
                ("Máy báo lỗi giấy dù có giấy", "Cảm biến giấy bám bụi.", "Vệ sinh cảm biến", None)],
    "ROUTER": [("Router không lên nguồn", "Adapter nguồn hỏng.", "Thay adapter nguồn", 0),
               ("Sóng Wi-Fi yếu", "Ăng-ten gãy chân.", "Thay ăng-ten", 1),
               ("Hay rớt mạng", "Firmware lỗi.", "Nâng cấp firmware", None)],
    "MONITOR": [("Màn hình không lên nguồn", "Bo nguồn cháy tụ.", "Thay bo nguồn", 0),
                ("Màn hình sọc dọc", "Bo T-con lỗi.", "Thay bo T-con", 1),
                ("Không nhận tín hiệu HDMI", "Cổng HDMI lỏng chân hàn.", "Hàn lại cổng HDMI", None)],
    "TV": [("TV tối màn, có tiếng", "Thanh LED backlight cháy 2 bóng.", "Thay thanh LED", 0),
           ("TV không lên nguồn", "Bo nguồn hỏng.", "Thay bo nguồn", 1),
           ("TV treo logo, khởi động lại liên tục", "Mainboard lỗi bộ nhớ eMMC.", "Thay mainboard", 2),
           ("Không vào được ứng dụng", "Lỗi phần mềm Smart TV.", "Cập nhật phần mềm", None)],
}
# ------------------------------------------------------------------ tiện ích
LAST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý",
        "Đinh", "Trương", "Mai", "Tạ", "Lâm", "Châu", "Quách", "Kiều"]
MID_M = ["Văn", "Minh", "Quốc", "Hoàng", "Đức", "Thanh", "Gia", "Hữu", "Công", "Tuấn", "Anh", "Nhật"]
MID_F = ["Thị", "Ngọc", "Thu", "Thanh", "Mỹ", "Khánh", "Bảo", "Phương", "Hồng", "Diệu", "Kim"]
FIRST_M = ["An", "Bình", "Cường", "Dũng", "Duy", "Đạt", "Hải", "Hiếu", "Hoàng", "Huy", "Khang", "Khoa", "Kiên", "Long", "Lộc",
           "Minh", "Nam", "Nghĩa", "Phát", "Phong", "Phúc", "Quân", "Sơn", "Tài", "Thắng", "Thành", "Thịnh", "Toàn", "Trí",
           "Trung", "Tuấn", "Việt", "Vinh", "Vũ"]
FIRST_F = ["Anh", "Châu", "Chi", "Diễm", "Dung", "Giang", "Hà", "Hân", "Hạnh", "Hằng", "Hiền", "Hoa", "Hương", "Lan", "Linh",
           "Loan", "Mai", "My", "Ngân", "Ngọc", "Nhi", "Nhung", "Oanh", "Phương", "Quỳnh", "Tâm", "Thảo", "Trang", "Trâm",
           "Tuyết", "Uyên", "Vân", "Vy", "Yến"]
STREETS = ["Lê Lợi", "Nguyễn Huệ", "Hai Bà Trưng", "Trần Hưng Đạo", "Lý Thường Kiệt", "Nguyễn Trãi", "Cách Mạng Tháng 8",
           "Điện Biên Phủ", "Võ Văn Tần", "Pasteur", "Nam Kỳ Khởi Nghĩa", "Phan Xích Long", "Lê Văn Sỹ", "Hoàng Văn Thụ",
           "Cộng Hòa", "Quang Trung", "Phan Văn Trị", "Nguyễn Oanh", "Kha Vạn Cân", "Võ Văn Ngân", "Nguyễn Thị Thập",
           "Huỳnh Tấn Phát", "Lũy Bán Bích", "Âu Cơ", "Tân Kỳ Tân Quý", "Kinh Dương Vương", "Phạm Văn Đồng"]
AREAS = ["Q.1", "Q.3", "Q.4", "Q.5", "Q.6", "Q.7", "Q.8", "Q.10", "Q.11", "Q.12", "Q.Bình Thạnh", "Q.Phú Nhuận", "Q.Tân Bình",
         "Q.Tân Phú", "Q.Gò Vấp", "Q.Bình Tân", "TP. Thủ Đức", "H.Nhà Bè", "H.Bình Chánh", "H.Hóc Môn"]
PHONE_PREFIX = ["090", "091", "093", "094", "096", "097", "098", "032", "033", "034", "035", "036", "037", "038", "039",
                "070", "076", "077", "078", "079", "081", "082", "083", "084", "085", "086", "088", "089"]


def ascii_fold(s):
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def person():
    female = rnd.random() < 0.48
    return " ".join([rnd.choice(LAST), rnd.choice(MID_F if female else MID_M), rnd.choice(FIRST_F if female else FIRST_M)])


def phone():
    while True:
        p = rnd.choice(PHONE_PREFIX) + "".join(rnd.choice("0123456789") for _ in range(7))
        if p not in used_phones:
            used_phones.add(p)
            return p


def serial(type_, brand):
    while True:
        if type_ == "SMARTPHONE":
            s = rnd.choice(["35", "86", "49"]) + "".join(rnd.choice("0123456789") for _ in range(13))
        else:
            s = ascii_fold(BRAND_NAME[brand]).upper().replace("-", "")[:3] + "".join(
                rnd.choice("ABCDEFGHJKLMNPQRSTUVWXYZ0123456789") for _ in range(rnd.randint(9, 12)))
        if s not in used_serials:
            used_serials.add(s)
            return s


def address():
    return f"{rnd.randint(1, 450)} {rnd.choice(STREETS)}, {rnd.choice(AREAS)}, TP.HCM"


def work_time(t):
    """Đưa thời điểm vào giờ làm 08:00–19:00."""
    if t.hour >= 19:
        t = (t + timedelta(days=1)).replace(hour=8, minute=rnd.randint(0, 59), second=0)
    elif t.hour < 8:
        t = t.replace(hour=8, minute=rnd.randint(0, 59), second=0)
    return t.replace(second=0)


def after(t, lo, hi):
    return work_time(t + timedelta(minutes=rnd.randint(lo, hi)))


def money(x):
    return int(round(x / 10000.0)) * 10000


class Seq:
    """Cấp mã theo BoDemMa, tiếp nối giá trị hiện có."""

    def __init__(self):
        self.values = {}

    def next(self, key, width):
        v = self.values.get(key, counters.get(key, 0)) + 1
        self.values[key] = v
        return f"{key}-{v:0{width}d}"


seq = Seq()


def add_months(d, months):
    m = d.month - 1 + months
    y = d.year + m // 12
    m = m % 12 + 1
    day = min(d.day, [31, 29 if y % 4 == 0 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return date(y, m, day)


# ------------------------------------------------------------------ danh mục: sản phẩm, chính sách, linh kiện
products = []  # (MaSP, loại, hãng, tên, tháng)
rows_product, rows_policy = [], []
for code, type_, brand, name, months in EXISTING_PRODUCTS:
    products.append((code, type_, brand, name, months))
policy_rows_brand = dict(BRAND_POLICY)
ms_policy = seq.next("CS", 4)
rows_policy.append((ms_policy, "BRAND", None, "MICROSOFT", "Chính sách bảo hành Microsoft", 12,
                    "Bảo hành chính hãng qua nhà phân phối ủy quyền", "Không gồm rơi vỡ, vào nước, hao mòn tay cầm",
                    DISTRIBUTOR["MICROSOFT"], 1))
policy_rows_brand["MICROSOFT"] = (ms_policy, 12)
for type_, brand, name, line in NEW_PRODUCTS:
    code = seq.next("SP", 4)
    months = policy_rows_brand[brand][1]
    products.append((code, type_, brand, name, months))
    rows_product.append((code, name, brand, type_, line, months, 1))


def policy_of(product_code, brand):
    return PRODUCT_POLICY.get(product_code) or policy_rows_brand[brand][0]


parts_by_type, part_info, rows_part = {}, {}, []
bin_no = 0
suppliers = ["NCC-001", "NCC-002", "NCC-003", "NCC-004", "NCC-005", "NCC-006"]
for type_, items in NEW_PARTS.items():
    for i, (name, cost, months) in enumerate(items):
        code = f"LK-{PART_ABBR[type_]}-{i + 1:02d}"
        bin_no += 1
        shelf = f"KHO-{'DEFG'[(bin_no - 1) // 20]}-{(bin_no - 1) % 20 // 5 + 1:02d}-{(bin_no - 1) % 5 + 1:02d}"
        price = money(cost * rnd.uniform(1.35, 1.5))
        part_info[code] = {"name": name, "group": TYPE_GROUP[type_], "cost": cost, "price": price, "months": months,
                           "bin": shelf, "reserved": 0}
        parts_by_type.setdefault(type_, []).append(code)

# ------------------------------------------------------------------ nhân viên mới
new_staff = [("TECHNICIAN", 9), ("RECEPTIONIST", 2), ("CASHIER", 2), ("WAREHOUSE_KEEPER", 1), ("DISPATCHER", 1)]
SKILLS = ["Smartphone", "Laptop", "Thiết bị đeo", "Audio", "Điện lạnh", "Máy giặt", "TV", "Màn hình", "Máy in", "Mạng"]
rows_account, rows_account_role, rows_staff = [], [], []
account_id = max_account
for role, n in new_staff:
    for _ in range(n):
        name = person()
        code = seq.next("NV", 3)
        given = ascii_fold(name.split()[-1]).lower()
        prefix = {"TECHNICIAN": "ktv", "RECEPTIONIST": "tiepnhan", "CASHIER": "thungan", "WAREHOUSE_KEEPER": "thukho",
                  "DISPATCHER": "dieuphoi"}[role]
        login, k = f"{prefix}.{given}", 2
        while login in used_logins:
            login, k = f"{prefix}.{given}{k}", k + 1
        used_logins.add(login)
        email = f"{login}@baohanh.vn"
        account_id += 1
        rows_account.append((account_id, login, PASSWORD_1234, "EMPLOYEE", "ACTIVE", 0, None, 0, 1, None, None,
                             datetime(YEAR, 3, 1, 8, 0)))
        rows_account_role.append((account_id, role))
        skills = rnd.sample(SKILLS, rnd.randint(1, 3)) if role == "TECHNICIAN" else []
        speciality = {"TECHNICIAN": ", ".join(skills), "RECEPTIONIST": "Tiếp nhận khách hàng", "CASHIER": "Thu ngân",
                      "WAREHOUSE_KEEPER": "Thủ kho", "DISPATCHER": "Điều phối vận hành"}[role]
        kynang = "[" + ", ".join(f'"{s}"' for s in skills) + "]"
        rows_staff.append((code, name, phone(), email, speciality, kynang, "ACTIVE", rnd.choice([8, 10, 12]), 1, "HCM", account_id))
        STAFF[code] = (name, role)

by_role = {}
for code, (_, role) in STAFF.items():
    by_role.setdefault(role, []).append(code)

# ------------------------------------------------------------------ khách hàng & thiết bị
customers, devices = [], []
for i in range(args.customers):
    name = person()
    c = {"code": seq.next("KH", 6), "name": name, "phone": phone(), "address": address(), "account": None,
         "status": "ARCHIVED" if i % 60 == 59 else "ACTIVE", "created": None}
    c["email"] = (ascii_fold(name).lower().replace(" ", ".") + str(rnd.randint(1, 99)) + "@gmail.com") if rnd.random() < 0.6 else None
    customers.append(c)
    if c["status"] == "ACTIVE":
        for _ in range(rnd.choices([1, 2, 3], [60, 30, 10])[0]):
            code, type_, brand, pname, months = rnd.choice(products)
            activated = date(YEAR - 2, 1, 1) + timedelta(days=rnd.randint(0, 990))
            devices.append({"code": None, "product": code, "type": type_, "brand": brand, "pname": pname, "months": months,
                            "kind": "IMEI" if type_ == "SMARTPHONE" else "SERIAL", "serial": serial(type_, brand),
                            "customer": c, "activated": activated, "expires": add_months(activated, months), "created": None,
                            "tickets": []})
# Khách có tài khoản cổng khách hàng (tên đăng nhập = SĐT, mật khẩu 1234)
for c in rnd.sample([c for c in customers if c["status"] == "ACTIVE"], k=min(90, args.customers // 4)):
    if c["phone"].lower() in used_logins:
        continue
    used_logins.add(c["phone"])
    account_id += 1
    c["account"] = account_id

# ------------------------------------------------------------------ phiếu tiếp nhận + vòng đời
START = datetime(YEAR, 4, 1, 8, 0)
span = (NOW - START).total_seconds()


def random_intake():
    if rnd.random() < 0.35:
        t = NOW - timedelta(seconds=rnd.uniform(0, 21 * 86400))
    else:
        t = START + timedelta(seconds=rnd.uniform(0, span))
    t = t.replace(hour=rnd.randint(8, 17), minute=rnd.randint(0, 59), second=0)
    return t if t < NOW else NOW - timedelta(minutes=rnd.randint(30, 120))


candidates = [d for d in devices]
rnd.shuffle(candidates)
plan = []  # (thiết bị, thời điểm nhận)
for d in candidates[:args.tickets]:
    plan.append((d, random_intake()))
# 8% thiết bị có thêm một phiếu cũ đã đóng (sửa lần trước)
for d in rnd.sample(candidates[:args.tickets], k=args.tickets // 12):
    first = d and [p for p in plan if p[0] is d][0][1]
    old = first - timedelta(days=rnd.randint(40, 120))
    if old > START - timedelta(days=60):
        plan.append((d, old.replace(hour=rnd.randint(8, 16))))
plan.sort(key=lambda p: p[1])
# Ngày kích hoạt bảo hành phải trước lần nhận máy đầu tiên
first_intake = {}
for d, t in plan:
    first_intake.setdefault(id(d), t)
for d in devices:
    ft = first_intake.get(id(d))
    if ft and d["activated"] > ft.date() - timedelta(days=7):
        d["activated"] = ft.date() - timedelta(days=rnd.randint(15, 700))
        d["expires"] = add_months(d["activated"], d["months"])

tickets = []
history, assignments, reassign, inspections, quotes, quote_lines = [], [], [], [], [], []
repairs, results, issues, issue_lines, payments, handovers, files, notes, audit = [], [], [], [], [], [], [], [], []
requests = []


def actor(role):
    code = rnd.choice(by_role[role])
    return code, STAFF[code][0], role


def log(t, who, action, label, kind, obj, before, after_):
    audit.append((t, who[0], who[1], ROLE_LABEL.get(who[2], who[2]), action, label, kind, obj, before, after_))


for d, t0 in plan:
    is_last = all(p[1] <= t0 for p in plan if p[0] is d)
    c = d["customer"]
    tk = {"code": None, "device": d, "customer": c, "t0": t0}
    d["tickets"].append(tk)
    in_warranty = d["expires"] >= t0.date()
    fault = rnd.choice(FAULTS[d["type"]])
    channel = rnd.choices(["COUNTER", "PHONE", "MOBILE_APP", "ONLINE_REQUEST"], [62, 8, 12, 18])[0]
    sla = rnd.choices(["STANDARD_48H", "PRIORITY_24H", "EXPRESS_12H"], [60, 25, 15])[0]
    sla_h = {"STANDARD_48H": 48, "PRIORITY_24H": 24, "EXPRESS_12H": 12}[sla]
    free = in_warranty and rnd.random() < 0.85
    water = in_warranty and not free and rnd.random() < 0.6
    part_codes = parts_by_type[d["type"]]
    part = part_codes[fault[3]] if fault[3] is not None else None
    tech = rnd.choice(by_role["TECHNICIAN"])
    old_ticket = not is_last  # phiếu cũ của thiết bị có phiếu sau: luôn đóng
    stuck = None if old_ticket else rnd.choices([None, "COMPLETED", "AWAITING_RETURN_STOP"],
                                                [92, 5, 3 if allow_awaiting_return else 0])[0]

    # Lộ trình trạng thái dự kiến: (trạng thái, phút tối thiểu, phút tối đa, vai trò/actor đặc biệt)
    path = [("INSPECTING", 10, 240, "DISPATCHER"), ("DIAGNOSED", 30, 600, "TECH")]
    decline = False
    rejected_first = False
    if free:
        if part and rnd.random() < 0.55:
            path += [("AWAITING_PARTS", 10, 180, "TECH"), ("REPAIRING", 240, 4320, "WAREHOUSE_KEEPER")]
        else:
            path += [("REPAIRING", 10, 240, "TECH")]
    else:
        rejected_first = rnd.random() < 0.06
        path += [("AWAITING_QUOTE_APPROVAL", 10, 120, "TECH")]
        if rejected_first:
            path += [("DIAGNOSED", 30, 300, "DISPATCHER"), ("AWAITING_QUOTE_APPROVAL", 30, 240, "TECH")]
        path += [("AWAITING_CUSTOMER_CONFIRMATION", 20, 480, "DISPATCHER")]
        decline = rnd.random() < 0.18 or stuck == "AWAITING_RETURN_STOP"
        if decline:
            path += [("AWAITING_RETURN", 60, 2880, "CUSTOMER"), ("RETURNED_UNREPAIRED", 240, 2880, "RECEPTIONIST")]
        elif part:
            path += [("AWAITING_PARTS", 60, 2880, "CUSTOMER"), ("REPAIRING", 240, 4320, "WAREHOUSE_KEEPER")]
        else:
            path += [("REPAIRING", 60, 2880, "CUSTOMER")]
    if not decline:
        path += [("COMPLETED", 60, 1440, "TECH"), ("DELIVERED", 120, 4320, "HANDOVER")]

    receiver = actor("RECEPTIONIST")
    events = [("RECEIVED", t0, receiver, "Khách hàng bàn giao thiết bị, lập phiếu tiếp nhận.")]
    portal = c["account"] is not None and rnd.random() < 0.7
    t = t0
    slow = 5 if NOW - t0 < timedelta(days=14) else 1  # phiếu gần đây còn tồn đọng ở các bước giữa
    for status, lo, hi, who_role in path:
        if stuck == "COMPLETED" and events[-1][0] == "COMPLETED":
            break
        if stuck == "AWAITING_RETURN_STOP" and events[-1][0] == "AWAITING_RETURN":
            break
        t = after(t, lo * slow, hi * slow)
        if t > NOW:
            if old_ticket:
                t = NOW - timedelta(minutes=1)
            else:
                break
        if who_role == "TECH":
            who = (tech, STAFF[tech][0], "TECHNICIAN")
        elif who_role == "CUSTOMER":
            who = (f"KH:{c['code']}", c["name"], "CUSTOMER") if portal else actor("RECEPTIONIST")
        elif who_role == "HANDOVER":
            who = actor(rnd.choice(["RECEPTIONIST", "CASHIER"]))
        else:
            who = actor(who_role)
        prev = events[-1][0]
        desc = f'Trạng thái đổi từ "{LABEL[prev]}" sang "{LABEL[status]}"'
        if status == "COMPLETED":
            desc += " (QC đạt)"
        elif who_role == "CUSTOMER":
            via = "khách xác nhận trên Cổng khách hàng" if portal else "xác nhận thay khách tại quầy"
            desc += f" ({'khách từ chối báo giá' if status == 'AWAITING_RETURN' else via})"
        events.append((status, t, who, desc))
    if not allow_awaiting_return and events[-1][0] == "AWAITING_RETURN":
        events.pop()  # dừng ở Chờ khách xác nhận thay vì Chờ trả máy
    reached = {e[0]: e for e in events}
    times = {}
    for e in events:
        times.setdefault(e[0], []).append(e[1])
    last = events[-1]
    tk.update(status=last[0], updated=last, version=len(events) - 1, events=events, sla=sla, sla_due=t0 + timedelta(hours=sla_h),
              channel=channel, in_warranty=in_warranty, free=free, fault=fault, tech=tech)
    for e in events:
        history.append((tk, e[0], e[1], e[3], e[2]))
    log(t0, receiver, "TICKET_CREATED", "Tạo phiếu tiếp nhận", "TICKET", tk, "—", "Chưa phân công")

    # Phân công + phiếu sửa chữa (lúc chuyển sang INSPECTING)
    if "INSPECTING" in reached:
        ta, disp = reached["INSPECTING"][1], reached["INSPECTING"][2]
        first_tech = tech
        pc = {"code": None, "t": ta, "ticket": tk, "manager": disp[0], "tech": tech,
              "priority": "URGENT" if sla == "EXPRESS_12H" else rnd.choices(["NORMAL", "LOW"], [85, 15])[0],
              "note": rnd.choice([None, "Đúng chuyên môn", "Ưu tiên xử lý trong ngày", "KTV còn trống lịch"])}
        if rnd.random() < 0.06 and "DIAGNOSED" in reached:
            others = [x for x in by_role["TECHNICIAN"] if x != tech]
            first_tech = rnd.choice(others)
            reassign.append((tk, first_tech, tech, disp[0], ta + (reached["DIAGNOSED"][1] - ta) / 2, "Điều chỉnh tải công việc"))
        pc["first_tech"] = first_tech
        assignments.append(pc)
        psc_status = "PENDING"
        started = None
        if "REPAIRING" in reached:
            psc_status, started = "IN_PROGRESS", reached["REPAIRING"][1]
        if "COMPLETED" in reached:
            psc_status = "DONE"
        if "AWAITING_RETURN" in reached:
            psc_status = "CANCELLED"
        psc = {"code": None, "t": ta, "ticket": tk, "pc": pc, "tech": tech, "started": started, "status": psc_status}
        repairs.append(psc)
        log(ta, disp, "TICKET_ASSIGNED", "Phân công kỹ thuật viên", "TICKET", tk, "Chưa phân công", STAFF[tech][0])
        if rnd.random() < 0.25:
            nt = after(ta, 30, 600)
            if nt < NOW:
                notes.append((tk, rnd.choice(["CUSTOMER", "INTERNAL"]), rnd.choice([
                    "Đã liên hệ khách xác nhận lại tình trạng lỗi.", "Khách nhờ giữ nguyên dữ liệu trong máy.",
                    "Đã sao lưu dữ liệu trước khi xử lý.", "Khách hẹn nhận máy sau 17h.",
                    "Đang chờ phản hồi của hãng về linh kiện.", "Đã kiểm tra sơ bộ, chưa phát hiện lỗi ngoại quan."]),
                    tech, "TECHNICIAN", nt))

    # Phiếu kiểm tra
    if "DIAGNOSED" in reached:
        tdg = times["DIAGNOSED"][0]
        items = CHECKLIST[d["type"]]
        checklist = "[" + ", ".join(
            '{"KetQua": "%s", "HangMuc": "%s"}' % ("FAIL" if j == (fault[3] or 0) % len(items) and fault[3] is not None else "PASS", it)
            for j, it in enumerate(items)) + "]"
        if free:
            reason = None
        elif water:
            reason = "Phát hiện dấu hiệu vào nước bên trong máy, không thuộc diện bảo hành."
        elif in_warranty:
            reason = "Hư hỏng do va đập/rơi vỡ, không thuộc diện bảo hành."
        else:
            reason = f"Thiết bị đã hết hạn bảo hành từ {d['expires'].isoformat()}."
        pkt = {"code": None, "t": tdg, "ticket": tk, "tech": tech, "findings": fault[1], "checklist": checklist,
               "water": 1 if water else 0, "class": "FREE_WARRANTY" if free else "OUT_OF_WARRANTY", "reason": reason,
               "fix": fault[2]}
        inspections.append(pkt)
        log(tdg, (tech, STAFF[tech][0], "TECHNICIAN"), "INSPECTION_RECORDED", "Lưu kết quả kiểm tra", "TICKET", tk,
            "Đang chẩn đoán", "Đã chẩn đoán — " + ("Trong bảo hành" if free else "Ngoài bảo hành"))

    # Báo giá (ngoài bảo hành)
    quote = None
    if "AWAITING_QUOTE_APPROVAL" in reached:
        group = TYPE_GROUP[d["type"]]
        aqa_times = times["AWAITING_QUOTE_APPROVAL"]
        for qi, tq in enumerate(aqa_times):
            lines = []
            if part:
                p = part_info[part]
                lines.append((part, f"{p['name']} — thay thế", 1, p["price"], money(LABOR[group] * rnd.uniform(0.6, 1.4))))
            else:
                lines.append((None, f"Công sửa chữa: {fault[2].lower()}", 1, 0, money(LABOR[group] * rnd.uniform(0.8, 2.0))))
            if rnd.random() < 0.15:
                extra = rnd.choice([x for x in part_codes if x != part])
                lines.append((extra, f"{part_info[extra]['name']} — thay kèm", 1, part_info[extra]["price"], 0))
            parts_total = sum(q * p for _, _, q, p, _ in lines)
            labor_total = sum(l for *_, l in lines)
            total = round((parts_total + labor_total) * 1.08, 2)
            q = {"code": None, "t": tq, "ticket": tk, "pkt": inspections[-1], "tech": tech,
                 "valid": (tq + timedelta(days=3)).date(), "service": SERVICE[group], "parts": parts_total,
                 "labor": labor_total, "total": total, "lines": lines, "internal": "PENDING", "manager": None,
                 "approved_at": None, "approve_note": None, "customer": "PENDING", "customer_at": None,
                 "decline_reason": None, "channel": None, "recorded_by": None}
            if qi == 0 and len(times["DIAGNOSED"]) > 1:
                rej = [e for e in events if e[0] == "DIAGNOSED"][1]
                q.update(internal="REJECTED", manager=rej[2][0], approved_at=rej[1],
                         approve_note="Đơn giá công chưa đúng bảng giá, đề nghị lập lại báo giá.")
            elif "AWAITING_CUSTOMER_CONFIRMATION" in reached:
                acc = reached["AWAITING_CUSTOMER_CONFIRMATION"]
                q.update(internal="APPROVED", manager=acc[2][0], approved_at=acc[1],
                         approve_note=rnd.choice([None, "Đã kiểm tra hợp lý, phê duyệt."]))
                decision = next((e for e in events if e[0] in ("AWAITING_PARTS", "REPAIRING", "AWAITING_RETURN")
                                 and e[1] >= acc[1]), None)
                if decision:
                    by = decision[2]
                    q.update(customer="DECLINED" if decision[0] == "AWAITING_RETURN" else "ACCEPTED", customer_at=decision[1],
                             channel="PORTAL" if by[2] == "CUSTOMER" else "COUNTER", recorded_by=by[0])
                    if decision[0] == "AWAITING_RETURN":
                        q["decline_reason"] = rnd.choice(["Chi phí sửa cao, khách muốn mua máy mới.",
                                                          "Khách không đồng ý mức giá, xin nhận lại máy.",
                                                          "Khách sẽ mang máy về hãng xử lý."])
            quotes.append(q)
            log(tq, (tech, STAFF[tech][0], "TECHNICIAN"), "QUOTATION_CREATED", "Gửi phiếu báo giá", "QUOTATION", q, "—",
                f"Chờ phê duyệt — {int(total):,} đ".replace(",", "."))
            quote = q

    # Xuất kho linh kiện
    if "AWAITING_PARTS" in reached:
        tr = reached["AWAITING_PARTS"][1]
        lines = [(l[0], l[2]) for l in quote["lines"] if l[0]] if quote else [(part, 1)]
        px = {"code": None, "t": tr, "ticket": tk, "source": "QUOTATION" if quote else "FREE_WARRANTY", "quote": quote,
              "tech": tech, "requester": tech, "status": "PENDING", "keeper": None, "done": None, "lines": lines}
        if "REPAIRING" in reached:
            px.update(status="ISSUED", keeper=reached["REPAIRING"][2][0], done=reached["REPAIRING"][1])
        else:
            for code, qty in lines:
                part_info[code]["reserved"] += qty
        issues.append(px)

    # Kết quả sửa chữa
    if "COMPLETED" in reached:
        tc = reached["COMPLETED"][1]
        qc = "[" + ", ".join('{"Buoc": "%s", "KetQua": "PASS"}' % s for s in
                             ["VISUAL", "MAIN_FUNCTION", "SECONDARY", "POWER_CHARGING", "DATA", "FINAL"]) + "]"
        if rnd.random() < 0.05 and "REPAIRING" in reached:
            tf = reached["REPAIRING"][1] + (tc - reached["REPAIRING"][1]) / 2
            fail = qc.replace('"FINAL", "KetQua": "PASS"', '"FINAL", "KetQua": "FAIL"')
            results.append({"code": None, "t": tf, "psc": psc, "tech": tech, "work": fault[2] + " (lần 1).", "qc": fail,
                            "kcs": "FAIL", "detail": "Test cuối chưa đạt, xử lý lại."})
        results.append({"code": None, "t": tc, "psc": psc, "tech": tech, "work": fault[2] + ", kiểm tra lại toàn bộ chức năng.",
                        "qc": qc, "kcs": "PASS", "detail": rnd.choice(["Test 2 giờ ổn định, không tái diễn lỗi.",
                                                                      "Kiểm tra chức năng chính đạt, khách có thể nhận máy.",
                                                                      "Chạy thử 20 chu kỳ không lỗi."])})
        log(tc, (tech, STAFF[tech][0], "TECHNICIAN"), "REPAIR_COMPLETED", "Xác nhận hoàn tất sửa chữa", "TICKET", tk,
            "Đang sửa chữa", "Sẵn sàng bàn giao")

    # Thu tiền + bàn giao
    paid_at = None
    if "DELIVERED" in reached:
        paid_at = reached["DELIVERED"][1] - timedelta(minutes=rnd.randint(3, 20))
        if paid_at < reached["COMPLETED"][1]:
            paid_at = reached["COMPLETED"][1]
    elif last[0] == "COMPLETED" and rnd.random() < 0.4:
        pt = after(last[1], 30, 600)
        paid_at = pt if pt < NOW else None
    if paid_at:
        cashier = actor("CASHIER")
        charged = quote is not None and quote["customer"] == "ACCEPTED"
        payments.append({"code": None, "t": paid_at, "ticket": tk, "quote": quote if charged else None,
                         "kind": "CHARGED" if charged else "FREE_WARRANTY", "payer": c["name"],
                         "amount": quote["total"] if charged else 0,
                         "method": rnd.choice(["CASH", "BANK_TRANSFER", "E_WALLET", "CARD"]) if charged else "NONE",
                         "cashier": cashier[0],
                         "note": "Đã đối chiếu đủ theo báo giá" if charged else "Bảo hành chính hãng — không thu phí"})
        log(paid_at, cashier, "PAYMENT_CHARGED" if charged else "PAYMENT_FREE_WARRANTY",
            "Thu tiền sửa chữa" if charged else "Xác nhận miễn phí bảo hành", "TICKET", tk, "Chưa thanh toán",
            "Đã thanh toán" if charged else "Miễn phí bảo hành")
    if last[0] in ("DELIVERED", "RETURNED_UNREPAIRED"):
        th, who = last[1], last[2]
        delivered = last[0] == "DELIVERED"
        f = None
        if delivered:
            f = {"t": th - timedelta(minutes=1), "ticket": tk, "by": who[0]}
            files.append(f)
        handovers.append({"code": None, "t": th, "ticket": tk, "kind": last[0], "by": who[0], "receiver": c["name"],
                          "condition": rnd.choice(["Máy hoạt động ổn định, đã test cùng khách.", "Máy hoạt động bình thường, ngoại quan như lúc nhận.",
                                                   "Đã sửa xong, khách kiểm tra và đồng ý nhận."]) if delivered
                          else "Trả nguyên trạng như lúc nhận, không can thiệp sửa chữa.",
                          "old_parts": 1 if delivered and quote and rnd.random() < 0.5 else 0,
                          "new_warranty": "Bảo hành linh kiện thay thế 6 tháng" if delivered and quote and part else None,
                          "rating": rnd.choice([None, 3, 4, 4, 5, 5, 5]) if delivered else None, "file": f, "delivered": delivered})
        log(th, who, "HANDOVER_COMPLETED", "Hoàn tất bàn giao", "TICKET", tk, "Sẵn sàng bàn giao", "Đã hoàn thành")

    # Yêu cầu trực tuyến đã chuyển thành phiếu
    if channel == "ONLINE_REQUEST":
        ty = t0 - timedelta(hours=rnd.randint(3, 60))
        requests.append({"code": None, "t": ty, "customer": c, "device": d, "fault": fault[0], "status": "CONVERTED",
                         "ticket": tk, "handler": receiver[0], "handled": t0, "cancel": None})

# Yêu cầu trực tuyến chờ tiếp nhận / đã hủy (thiết bị mới chưa đăng ký)
for kind, n in (("PENDING_INTAKE", 45), ("CANCELLED", 30)):
    for _ in range(n):
        code, type_, brand, pname, months = rnd.choice(products)
        c = rnd.choice(customers) if rnd.random() < 0.5 else None
        if c and c["status"] != "ACTIVE":
            c = None
        guest = {"name": person(), "phone": phone(), "email": None, "address": address()} if c is None else None
        ty = NOW - timedelta(hours=rnd.randint(2, 24 * 9)) if kind == "PENDING_INTAKE" else \
            START + timedelta(seconds=rnd.uniform(0, span - 86400 * 3))
        fake_dev = {"type": type_, "brand": brand, "pname": pname, "kind": "IMEI" if type_ == "SMARTPHONE" else "SERIAL",
                    "serial": serial(type_, brand)}
        requests.append({"code": None, "t": ty.replace(second=0), "customer": c, "guest": guest, "device": fake_dev,
                         "fault": rnd.choice(FAULTS[type_])[0], "status": kind, "ticket": None,
                         "handler": rnd.choice(by_role["RECEPTIONIST"]) if kind == "CANCELLED" else None,
                         "handled": after(ty, 30, 1440) if kind == "CANCELLED" else None,
                         "cancel": rnd.choice(["Khách tự xử lý được lỗi.", "Khách không đến trạm theo lịch hẹn.",
                                               "Trùng yêu cầu đã gửi trước đó.", "Khách đổi ý, không bảo hành nữa."])
                         if kind == "CANCELLED" else None})

# Ngày tạo khách/thiết bị: trước lần đầu xuất hiện
for d in devices:
    firsts = [tk["t0"] for tk in d["tickets"]] + [r["t"] for r in requests if r["device"] is d]
    d["created"] = (min(firsts) - timedelta(minutes=rnd.randint(2, 30))) if firsts else \
        (START - timedelta(days=30) + timedelta(seconds=rnd.uniform(0, span))).replace(second=0)
for c in customers:
    firsts = [d["created"] for d in devices if d["customer"] is c] + [r["t"] for r in requests if r["customer"] is c]
    c["created"] = (min(firsts) - timedelta(minutes=rnd.randint(1, 20))) if firsts else \
        (START + timedelta(seconds=rnd.uniform(0, span))).replace(second=0)
    c["created"] = c["created"].replace(second=0)

# ------------------------------------------------------------------ cấp mã theo thời gian
for d in sorted(devices, key=lambda x: x["created"]):
    d["code"] = seq.next("TB", 6)
all_tickets = sorted([tk for d in devices for tk in d["tickets"]], key=lambda x: x["t0"])
for tk in all_tickets:
    tk["code"] = seq.next(f"TN-{tk['t0']:%Y}-{tk['t0']:%m%d}", 5)
for r in sorted(requests, key=lambda x: x["t"]):
    r["code"] = seq.next(f"YC-{r['t']:%Y}-{r['t']:%m%d}", 5)
for q in sorted(quotes, key=lambda x: x["t"]):
    q["code"] = seq.next(f"BG-{q['t']:%Y}-{q['t']:%m%d}", 5)
for lst, prefix in ((assignments, "PC"), (inspections, "PKT"), (repairs, "PSC"), (results, "KQ"), (payments, "PT"),
                    (handovers, "PBG"), (issues, "PX")):
    for x in sorted(lst, key=lambda x: x["t"]):
        x["code"] = seq.next(f"{prefix}-{x['t']:%Y}", 5)
file_id = max_file
for f in sorted(files, key=lambda x: x["t"]):
    file_id += 1
    f["id"] = file_id

# Nhập kho, điều chuyển
receipts = []
for _ in range(28):
    tr = (START + timedelta(seconds=rnd.uniform(0, span - 3600))).replace(hour=rnd.randint(8, 16), second=0)
    status = rnd.choices(["APPROVED", "PENDING", "REJECTED"], [80, 10, 10])[0]
    if NOW - tr < timedelta(days=2):
        status = "PENDING"
    maker = rnd.choice(by_role["WAREHOUSE_KEEPER"])
    lines = []
    for code in rnd.sample(list(part_info), rnd.randint(2, 5)):
        lines.append((code, rnd.choice([5, 10, 10, 20, 30]), part_info[code]["cost"]))
    receipts.append({"code": None, "t": tr, "supplier": rnd.choice(suppliers), "lot": f"LOT-{tr:%m%d}{rnd.randint(1, 9)}",
                     "status": status, "maker": maker,
                     "approver": rnd.choice(by_role["WAREHOUSE_KEEPER"]) if status != "PENDING" else None,
                     "approved": after(tr, 10, 240) if status != "PENDING" else None,
                     "reason": "Sai số lượng so với hóa đơn nhà cung cấp." if status == "REJECTED" else None,
                     "lines": lines, "total": sum(q * p for _, q, p in lines),
                     "note": rnd.choice(["Nhập bổ sung tồn kho định kỳ", "Nhập theo đơn đặt hàng tháng",
                                         "Bổ sung linh kiện chạm định mức tối thiểu"])})
for r in sorted(receipts, key=lambda x: x["t"]):
    r["code"] = seq.next(f"PN-{r['t']:%Y}", 5)
    if r["approved"] and r["approved"] > NOW:
        r["approved"] = NOW - timedelta(minutes=1)

stock = {}
for code, p in part_info.items():
    low = rnd.random() < 0.2
    on_hand = rnd.randint(0, 4) if low else rnd.randint(8, 60)
    on_hand = max(on_hand, p["reserved"])
    stock[code] = {p["bin"]: on_hand}
    p["on_hand"] = on_hand
    p["min"] = rnd.choice([3, 5, 5, 8, 10])
transfers = []
for code in rnd.sample([c for c, p in part_info.items() if p["on_hand"] - p["reserved"] >= 6], k=6):
    p = part_info[code]
    status = rnd.choice(["COMPLETED", "COMPLETED", "PENDING", "REJECTED"])
    qty = rnd.randint(2, (p["on_hand"] - p["reserved"]) // 2)
    dest = p["bin"][:-2] + f"{int(p['bin'][-2:]) + 10:02d}"
    tt = (NOW - timedelta(days=rnd.randint(1, 60))).replace(hour=rnd.randint(8, 16), second=0)
    if status == "COMPLETED":
        stock[code][p["bin"]] -= qty
        stock[code][dest] = qty
    transfers.append({"code": None, "t": tt, "part": code, "qty": qty, "from": p["bin"], "to": dest, "status": status,
                      "maker": rnd.choice(by_role["WAREHOUSE_KEEPER"]),
                      "approver": rnd.choice(by_role["WAREHOUSE_KEEPER"]) if status != "PENDING" else None,
                      "approved": after(tt, 10, 300) if status != "PENDING" else None,
                      "reason": "Kệ đích đang kiểm kê, chưa nhận hàng." if status == "REJECTED" else None})
for x in sorted(transfers, key=lambda x: x["t"]):
    x["code"] = seq.next(f"DC-{x['t']:%Y}", 5)
    if x["approved"] and x["approved"] > NOW:
        x["approved"] = NOW - timedelta(minutes=1)


# ------------------------------------------------------------------ ghi SQL
class Raw(str):
    pass


def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, Raw):
        return v
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return repr(v) if isinstance(v, int) else f"{v:.2f}"
    if isinstance(v, datetime):
        return f"'{v:%Y-%m-%dT%H:%M:%S}'"
    if isinstance(v, date):
        return f"'{v:%Y-%m-%d}'"
    return "N'" + str(v).replace("'", "''") + "'"


out = []


def insert(table, cols, rows, identity=False):
    if not rows:
        return
    if identity:
        out.append(f"SET IDENTITY_INSERT {table} ON;")
    for i in range(0, len(rows), 500):
        out.append(f"INSERT INTO {table} ({', '.join(cols)}) VALUES")
        out.append(",\n".join("  (" + ", ".join(lit(v) for v in r) + ")" for r in rows[i:i + 500]) + ";")
    if identity:
        out.append(f"SET IDENTITY_INSERT {table} OFF;")
    summary[table] = summary.get(table, 0) + len(rows)


summary = {}
out.append("SET NOCOUNT ON;\nSET XACT_ABORT ON;\nSET ANSI_NULLS ON;\nSET QUOTED_IDENTIFIER ON;\nBEGIN TRANSACTION;")
out.append(f"IF (SELECT MAX(MaTaiKhoan) FROM TaiKhoan) <> {max_account} OR (SELECT ISNULL(MAX(MaTep), 0) FROM TepDinhKem) <> {max_file}\n"
           "    THROW 50000, N'Dữ liệu đã thay đổi từ lúc sinh script — chạy lại generate_bulk_data.py.', 1;")

cust_accounts = [c for c in customers if c["account"]]
insert("TaiKhoan", ["MaTaiKhoan", "TenDangNhap", "MatKhauHash", "LoaiChuThe", "TrangThai", "SoLanSaiLienTiep", "KhoaTamDen",
                    "BatBuocDoiMatKhau", "PhienBanBaoMat", "LanDangNhapCuoi", "NgayDoiMatKhau", "NgayTao"],
       rows_account + [(c["account"], c["phone"], PASSWORD_1234, "CUSTOMER", "ACTIVE", 0, None, 0, 1, None, None, c["created"])
                       for c in cust_accounts], identity=True)
insert("TaiKhoan_VaiTro", ["MaTaiKhoan", "MaVaiTro"], rows_account_role + [(c["account"], "CUSTOMER") for c in cust_accounts])
insert("NhanVien", ["MaNV", "HoTen", "SDT", "Email", "ChuyenMon", "KyNang", "TrangThaiLamViec", "SoPhieuToiDa", "CoMatTaiTram",
                    "MaTram", "MaTaiKhoan"], rows_staff)
insert("KhachHang", ["MaKH", "HoTen", "SDT", "Email", "DiaChi", "MaTaiKhoan", "TrangThai", "GopVaoMaKH", "NgayTao"],
       [(c["code"], c["name"], c["phone"], c["email"], c["address"], c["account"], c["status"], None, c["created"]) for c in customers])
insert("SanPham", ["MaSP", "TenSP", "MaHang", "MaLoai", "DongSanPham", "ThoiHanBaoHanhMacDinhThang", "HoatDong"], rows_product)
insert("ChinhSachBaoHanh", ["MaChinhSach", "PhamVi", "MaSP", "MaHang", "TenChinhSach", "SoThangBaoHanh", "DieuKienBaoHanh",
                            "TruongHopTuChoi", "NhaPhanPhoi", "HoatDong"], rows_policy)
insert("LinhKien", ["MaLK", "TenLK", "DonViTinh", "MaNhom", "TenHang", "DonGiaVon", "DonGiaDichVu", "SoLuongTon", "SoLuongDaGiu",
                    "DinhMucTonToiThieu", "KeChinh", "ThoiHanBaoHanhThang", "MaNCC", "HoatDong", "PhienBan"],
       [(code, p["name"], "Cái", p["group"], None, p["cost"], p["price"], p["on_hand"], p["reserved"], p["min"], p["bin"],
         p["months"], rnd.choice(suppliers), 1, 0) for code, p in part_info.items()])
insert("TonKhoTheoKe", ["MaLK", "MaKe", "SoLuong"], [(code, b, q) for code, bins in stock.items() for b, q in bins.items()])
insert("ThietBi", ["MaThietBi", "MaSP", "LoaiDinhDanh", "SoSerial_IMEI", "MaKH", "NgayKichHoatBaoHanh", "NgayHetHanBaoHanh",
                   "NhaPhanPhoi", "NgayTao"],
       [(d["code"], d["product"], d["kind"], d["serial"], d["customer"]["code"], d["activated"], d["expires"],
         DISTRIBUTOR[d["brand"]], d["created"]) for d in devices])


def req_row(r):
    dv = r["device"]
    who = r["customer"] or {}
    g = r.get("guest") or {}
    return (r["code"], who.get("code") if who and who.get("account") else None, who.get("name") or g.get("name"),
            who.get("phone") or g.get("phone"), who.get("email") or g.get("email"), who.get("address") or g.get("address"),
            TYPE_GROUP[dv["type"]], dv["type"], f"{BRAND_NAME[dv['brand']]} {dv['pname']}", dv["kind"], dv["serial"],
            r["fault"], "HCM", r["t"].replace(hour=9, minute=0) + timedelta(days=1),
            r["t"].replace(hour=11, minute=0) + timedelta(days=1),
            "CANCELLED" if r["status"] == "CANCELLED" else "PENDING_INTAKE", None, r["handler"], r["handled"], r["cancel"], r["t"])


request_cols = ["MaYeuCau", "MaKH", "HoTenKhach", "SDTKhach", "EmailKhach", "DiaChiKhach", "MaNhom", "MaLoai", "HangModel",
                         "LoaiDinhDanh", "SoSerial_IMEI", "MoTaLoi", "MaTramMongMuon", "ThoiGianMongMuonTu", "ThoiGianMongMuonDen",
                         "TrangThai", "MaPhieuTN", "MaNVXuLy", "NgayXuLy", "LyDoHuy", "NgayTao"]
request_rows = [req_row(r) for r in sorted(requests, key=lambda x: x["code"])]
if not request_has_customer:  # DB cũ chưa chạy 05_upgrade_existing_db.sql
    request_cols.pop(1)
    request_rows = [r[:1] + r[2:] for r in request_rows]
insert("YeuCauBaoHanh", request_cols, request_rows)
req_of = {id(r["ticket"]): r for r in requests if r["ticket"]}


def ticket_row(tk):
    d, c = tk["device"], tk["customer"]
    cosmetic_scratch = rnd.choices(["NONE", "LIGHT", "HEAVY"], [55, 38, 7])[0]
    upd = tk["updated"]
    status = tk["status"]
    est = 0 if tk["in_warranty"] else money(LABOR[TYPE_GROUP[d["type"]]] * rnd.uniform(1, 6))
    return (tk["code"], "HCM", tk["t0"], tk["channel"], "WARRANTY" if tk["in_warranty"] else "PAID_REPAIR",
            req_of[id(tk)]["code"] if id(tk) in req_of else None, c["code"], d["code"], tk["events"][0][2][0],
            "IN_WARRANTY" if tk["in_warranty"] else "OUT_OF_WARRANTY", d["activated"], d["expires"], policy_of(d["product"], d["brand"]),
            rnd.choice(["Tem nguyên vẹn", "Tem còn, hơi mờ"]) if tk["in_warranty"] else rnd.choice(["Không còn tem", "Tem rách"]),
            cosmetic_scratch, 1 if rnd.random() < 0.08 else 0, 1 if rnd.random() < 0.04 else 0,
            "SUSPECTED" if not tk["free"] and rnd.random() < 0.3 else "NONE", rnd.choices(["COMPLETE", "MISSING"], [85, 15])[0],
            rnd.choice(["Không có", "Sạc, cáp", "Hộp, sạc", "Remote", "Túi đựng", "Hộp sạc"]),
            {"NONE": "Không trầy xước", "LIGHT": "Trầy nhẹ cạnh viền", "HEAVY": "Trầy nhiều, cấn góc"}[cosmetic_scratch],
            1, tk["fault"][0], (tk["t0"] + timedelta(days=rnd.randint(2, 5))).replace(hour=17, minute=0), est, tk["sla"],
            tk["sla_due"], status, upd[1], upd[2][0], upd[2][2],
            "(khách xác nhận trên Cổng khách hàng)" if upd[2][2] == "CUSTOMER" else None, tk["version"],
            0 if status in ("DELIVERED", "RETURNED_UNREPAIRED") else 1)


insert("PhieuTiepNhan", ["MaPhieuTN", "MaTram", "NgayTiepNhan", "KenhTiepNhan", "LoaiYeuCau", "MaYeuCau", "MaKH", "MaThietBi",
                         "MaNVTiepNhan", "BH_TrangThaiLucNhan", "BH_NgayKichHoat", "BH_NgayHetHan", "BH_MaChinhSach", "TinhTrangTem",
                         "NQ_VetTray", "NQ_CanMop", "NQ_NutVo", "NQ_DauHieuAmNuoc", "NQ_PhuKien", "PhuKienKemTheo",
                         "TinhTrangNgoaiQuan", "KhachXacNhanNgoaiQuan", "MoTaLoiKhachBao", "NgayHenTra", "ChiPhiDuKien", "MucSLA",
                         "HanSLA", "TrangThaiXuLy", "NgayCapNhatTrangThai", "NguoiCapNhatTrangThai", "VaiTroCapNhatTrangThai",
                         "GhiChuTrangThai", "PhienBan", "ConMo"], [ticket_row(tk) for tk in all_tickets])
out.append("UPDATE y SET TrangThai = N'CONVERTED', MaPhieuTN = v.MaPhieuTN FROM YeuCauBaoHanh y JOIN (VALUES\n" + ",\n".join(
    f"  ({lit(r['code'])}, {lit(r['ticket']['code'])})" for r in requests if r["ticket"]) + "\n) v (MaYeuCau, MaPhieuTN) ON v.MaYeuCau = y.MaYeuCau;")
insert("LichSuTrangThai_ThietBi", ["MaPhieuTN", "TrangThai", "ThoiGianCapNhat", "MoTaChiTiet", "NguoiCapNhat", "TenNguoiCapNhat",
                                   "VaiTroNguoiCapNhat"],
       [(tk["code"], s, t, desc, who[0], who[1], who[2]) for tk, s, t, desc, who in sorted(history, key=lambda h: h[2])])
insert("PhanCong", ["MaPhanCong", "MaPhieuTN", "MaNVQuanLy", "MaKTV", "NgayPhanCong", "MucDoUuTien", "GhiChu"],
       [(p["code"], p["ticket"]["code"], p["manager"], p["tech"], p["t"], p["priority"], p["note"]) for p in assignments])
insert("LichSuPhanCong", ["MaPhieuTN", "MaKTVCu", "MaKTVMoi", "MaNVThucHien", "ThoiGian", "GhiChu"],
       [(tk["code"], a, b, by, t.replace(microsecond=0), note) for tk, a, b, by, t, note in reassign])
insert("PhieuKiemTra", ["MaPhieuKT", "MaPhieuTN", "MaKTV", "NgayKiemTra", "KetQuaKiemTraChiTiet", "ChecklistKetQua",
                        "TinhTrangVaoNuoc", "PhanLoaiBaoHanh", "LyDoNgoaiBaoHanh", "HuongKhacPhucDeXuat", "GhiChuPhanLoaiLai",
                        "SoLanSuaPhanLoai", "NgayCapNhat"],
       [(p["code"], p["ticket"]["code"], p["tech"], p["t"], p["findings"], p["checklist"], p["water"], p["class"], p["reason"],
         p["fix"], None, 0, None) for p in inspections])
insert("PhieuBaoGia", ["MaBaoGia", "MaPhieuTN", "MaPhieuKT", "MaKTVLap", "NgayLapBaoGia", "HanHieuLuc", "MaDichVu",
                       "TongTienLinhKien", "TongTienCong", "ThueVAT", "TongTienThanhToan", "TrangThaiDuyetNoiBo", "MaNVQuanLyDuyet",
                       "NgayDuyetNoiBo", "GhiChuDuyet", "KhachXacNhan", "NgayKhachXacNhan", "LyDoKhachTuChoi", "KenhXacNhan",
                       "NguoiGhiNhanXacNhan"],
       [(q["code"], q["ticket"]["code"], q["pkt"]["code"], q["tech"], q["t"], q["valid"], q["service"], float(q["parts"]),
         float(q["labor"]), 8.0, float(q["total"]), q["internal"], q["manager"], q["approved_at"], q["approve_note"], q["customer"],
         q["customer_at"], q["decline_reason"], q["channel"], q["recorded_by"]) for q in quotes])
insert("ChiTietBaoGia", ["MaBaoGia", "SoThuTu", "MaLK", "NoiDungMuc", "SoLuong", "DonGia", "TienCongSuaChua", "ThanhTien"],
       [(q["code"], i + 1, lk, text, qty, float(price), float(labor), float(qty * price + labor))
        for q in quotes for i, (lk, text, qty, price, labor) in enumerate(q["lines"])])
insert("PhieuSuaChua", ["MaPhieuSC", "MaPhieuTN", "MaPhanCong", "MaKTV", "NgayTao", "NgayBatDau", "TrangThaiSuaChua"],
       [(p["code"], p["ticket"]["code"], p["pc"]["code"], p["tech"], p["t"], p["started"], p["status"]) for p in repairs])
insert("KetQuaSuaChua", ["MaKetQua", "MaPhieuSC", "MaKTV", "NoiDungSuaChua", "KetQuaQCTungBuoc", "KetQuaKCS", "ChiTietTestKCS",
                         "NgayGhiNhan"],
       [(r["code"], r["psc"]["code"], r["tech"], r["work"], r["qc"], r["kcs"], r["detail"], r["t"].replace(microsecond=0))
        for r in results])
insert("PhieuXuatKho", ["MaPhieuXuat", "MaPhieuTN", "NguonXuat", "MaBaoGia", "LyDoXuat", "MaKTVNhan", "MaNguoiYeuCau", "NgayYeuCau",
                        "TrangThai", "MaThuKhoXuLy", "NgayXuLy", "LyDoTuChoi", "TongTienXuat"],
       [(x["code"], x["ticket"]["code"], x["source"], x["quote"]["code"] if x["quote"] else None,
         "Xuất thay thế sửa chữa" if x["quote"] else "Xuất linh kiện bảo hành", x["tech"], x["requester"], x["t"], x["status"],
         x["keeper"], x["done"], None, float(sum(part_info[c]["cost"] * q for c, q in x["lines"]))) for x in issues])
insert("ChiTietXuatKho", ["MaPhieuXuat", "MaLK", "SoLuongXuat", "DonGiaXuat", "MaKe", "NgayHetHanBaoHanhLK"],
       [(x["code"], c, q, float(part_info[c]["cost"]), part_info[c]["bin"],
         add_months(x["done"].date(), part_info[c]["months"]) if x["done"] else None) for x in issues for c, q in x["lines"]])
insert("TepDinhKem", ["MaTep", "LoaiChuSoHuu", "MaChuSoHuu", "TenTep", "LoaiNoiDung", "KichThuoc", "DuongDanLuuTru", "NguoiTaiLen",
                      "NgayTaiLen"],
       [(f["id"], "HANDOVER_SIGNATURE", f["ticket"]["code"], "chu-ky-khach.png", "image/png", 2048, "seed/signatures/blank.png",
         f["by"], f["t"]) for f in files], identity=True)
insert("HoaDon_PhieuThu", ["MaPhieuThu", "MaPhieuTN", "MaBaoGia", "LoaiThu", "NgayThu", "NguoiNopTien", "SoTienThu",
                           "HinhThucThanhToan", "MaThuNgan", "GhiChu"],
       [(p["code"], p["ticket"]["code"], p["quote"]["code"] if p["quote"] else None, p["kind"], p["t"], p["payer"],
         float(p["amount"]), p["method"], p["cashier"], p["note"]) for p in payments])
insert("PhieuBanGiao", ["MaBanGiao", "MaPhieuTN", "LoaiBanGiao", "NgayBanGiao", "MaNVBanGiao", "NguoiNhanMay", "HienTrangKhiTra",
                        "TraLaiLinhKienCu", "ThoiHanBaoHanhMoi", "DanhGiaHaiLong", "KT_NgoaiQuanDungBienBan", "KT_KhoiDongBinhThuong",
                        "KT_ChucNangChinhOK", "KT_PhuKienDayDu", "KT_KhongLoiPhatSinh", "MaTepChuKy", "KhachXacNhanNhanMay"],
       [(h["code"], h["ticket"]["code"], h["kind"], h["t"], h["by"], h["receiver"], h["condition"], h["old_parts"],
         h["new_warranty"], h["rating"], *([1] * 5 if h["delivered"] else [None] * 5),
         h["file"]["id"] if h["file"] else None, 1) for h in handovers])
insert("GhiChuPhieu", ["MaPhieuTN", "Loai", "NoiDung", "NguoiViet", "VaiTroNguoiViet", "ThoiGian"],
       [(tk["code"], kind, text, by, role, t) for tk, kind, text, by, role, t in notes])
insert("PhieuNhapKho", ["MaPhieuNhap", "MaNCC", "SoLo", "NgayNhap", "MaNguoiLap", "NgayLap", "TrangThai", "MaNguoiDuyet",
                        "NgayDuyet", "LyDoTuChoi", "TongTienNhap", "GhiChu"],
       [(r["code"], r["supplier"], r["lot"], r["t"].date(), r["maker"], r["t"], r["status"], r["approver"], r["approved"],
         r["reason"], float(r["total"]), r["note"]) for r in receipts])
insert("ChiTietNhapKho", ["MaPhieuNhap", "MaLK", "SoLuongNhap", "DonGiaNhap", "SerialLo", "MaKe"],
       [(r["code"], c, q, float(p), f"BATCH-{c[-6:]}-{r['t']:%m%d}", part_info[c]["bin"]) for r in receipts for c, q, p in r["lines"]])
insert("PhieuDieuChuyen", ["MaPhieuDC", "MaLK", "SoLuong", "TuKe", "DenKe", "LyDo", "TrangThai", "MaNguoiLap", "NgayLap",
                           "MaNguoiDuyet", "NgayDuyet", "LyDoTuChoi"],
       [(x["code"], x["part"], x["qty"], x["from"], x["to"], "Sắp xếp lại kệ cho lô nhập mới", x["status"], x["maker"], x["t"],
         x["approver"], x["approved"], x["reason"]) for x in transfers])

for c in customers:
    log(c["created"], actor("RECEPTIONIST"), "CUSTOMER_CREATED", "Tạo hồ sơ khách hàng", "CUSTOMER", {"code": c["code"]}, "—",
        f"{c['code']} — {c['name']} — {c['phone']}")
for d in devices:
    log(d["created"], actor("RECEPTIONIST"), "DEVICE_REGISTERED", "Đăng ký thiết bị", "DEVICE", {"code": d["code"]}, "—",
        f"{d['code']} — {d['serial']} — {d['customer']['code']}")
insert("NhatKyThaoTac", ["ThoiGian", "MaNguoiThaoTac", "TenNguoiThaoTac", "VaiTro", "HanhDong", "NhanHanhDong", "LoaiDoiTuong",
                         "MaDoiTuong", "GiaTriTruoc", "GiaTriSau"],
       [(t, who, name, role, action, label, kind, obj["code"], before,
         (obj["code"] + " — " + after_) if kind == "TICKET" else after_)
        for t, who, name, role, action, label, kind, obj, before, after_ in sorted(audit, key=lambda a: a[0])])

out.append("MERGE BoDemMa AS t USING (VALUES\n" + ",\n".join(f"  ({lit(k)}, {v})" for k, v in sorted(seq.values.items())) +
           "\n) AS n (Khoa, GiaTri) ON t.Khoa = n.Khoa\nWHEN MATCHED THEN UPDATE SET GiaTri = n.GiaTri\n"
           "WHEN NOT MATCHED THEN INSERT (Khoa, GiaTri) VALUES (n.Khoa, n.GiaTri);")
out.append("COMMIT TRANSACTION;\nPRINT N'Đã nạp dữ liệu test.';")

with open(args.out, "w", encoding="utf-8") as fh:
    fh.write("\n".join(out) + "\n")

status_count = {}
for tk in all_tickets:
    status_count[tk["status"]] = status_count.get(tk["status"], 0) + 1
print(f"Ghi {args.out}")
for k, v in summary.items():
    print(f"  {k}: {v}")
print("Trạng thái phiếu:", dict(sorted(status_count.items(), key=lambda x: -x[1])))
