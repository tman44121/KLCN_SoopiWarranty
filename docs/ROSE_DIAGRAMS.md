# Vẽ lại sơ đồ UML bằng Rational Rose cho báo cáo khóa luận

Tài liệu bàn giao. Ai tiếp tục thì đọc hết mục 1–3 trước, sau đó làm theo checklist ở mục 5 và đánh dấu `[x]` khi xong.

Báo cáo cần sửa: `D:\huit\khoaluan\doc\BaoCao_KLCN_QuanLyTrungTamBaoHanhDienTu.docx`.
Bản SQL Server đầy đủ hơn nằm ở `docs/Group2_QuanLyTrungTamBaoHanhDienTu_Phase6.docx`. Hai file có cùng chương 2–3.

## 1. Yêu cầu của chủ đề tài (30/10/2026)

1. Không dùng sơ đồ dạng "hộp chữ nối mũi tên" tự vẽ (ví dụ sơ đồ "Admin nhập hồ sơ, username và vai trò nhân viên…" ở 3.4.5.1).
   Mọi sơ đồ phải được **vẽ trong Rational Rose**, xuất ảnh rồi dán vào báo cáo.
2. Chương 2 (phân tích): **thêm sơ đồ tuần tự (sequence)** cho từng phần phân tích, đồng thời **đánh đề mục** cho các phần này.
3. Mục 3.4: **mỗi chức năng phải có sơ đồ hoạt động và sơ đồ tuần tự** vẽ bằng Rose, có đề mục riêng.
   Hiện các dòng như "Sơ đồ tuần tự chức năng Đăng ký yêu cầu bảo hành" chỉ là đoạn văn thường; phải đổi thành đề mục.
4. Ảnh phải nét, đọc được toàn bộ chữ, giữ **màu mặc định của Rose** (đường viền đỏ thẫm, nút vàng nhạt).
5. Phong cách cần theo: các sơ đồ Rose sẵn có của nhóm, ví dụ sơ đồ tuần tự tiếp nhận thiết bị. Gồm actor, đối tượng
   boundary/control/entity dạng biểu tượng, thông điệp trả về nét đứt, nhãn tiếng Việt **không dấu**. Rose là ứng dụng ANSI,
   chữ có dấu tiếng Việt hiển thị sai.

## 2. Những gì đã kiểm chứng (30/10/2026)

| Hạng mục | Kết quả |
|---|---|
| Rose | Rational Rose 2006.0.0.060314 tại `C:\Program Files (x86)\Rational\Rose\rose.exe`; COM ProgID `Rose.Application` |
| Gọi COM từ Python | `win32com.client.Dispatch` gọi trực tiếp lỗi "Member not found". Phải sinh wrapper từ type library rồi bọc: `rosetlb.IRoseApplication(Dispatch('Rose.Application')._oleobj_)` |
| Sinh wrapper | `python -m win32com.client.makepy -o docs/rose/rosetlb.py "C:/Program Files (x86)/Rational/Rose/rationalrose.tlb"` (file ~1 MB, không commit) |
| Mỗi lần Dispatch | Rose khởi động **một tiến trình mới**. Đóng các tiến trình thừa sau khi chạy; nên làm hết trong một lần chạy script |
| Sequence diagram | `cat.AddScenarioDiagram(ten, 1)` (1 = sequence). Tạo lớp có `Stereotype` = `Actor`/`boundary`/`control`/`entity`, rồi `AddInstance('', TenLop)`. **Bắt buộc** gọi `AddInstanceView(inst, True)`, nếu không sơ đồ rỗng |
| Thông điệp | `d.CreateMessage(nhan, gui, nhan_ve, so_thu_tu)`; gán `msg.Synchronization = 6` để thành thông điệp trả về **nét đứt**; 0 = mũi tên thường; giá trị 7, 8 lỗi |
| Activity diagram (chưa chạy thử) | API có sẵn: `uc.CreateStateMachine()` hoặc `cls.CreateStateMachine()` → `sm.AddActivityDiagram`, `sm.AddSwimLane`, `sm.AddActivity`, `sm.AddDecision`, `act.AddTransitionToVertex(nhan, dich)`, `sm.AddObjectInstance` + `AddObjectFlow`; view: `AddActivityView`, `AddDecisionView`, `AddSwimLaneView`, `AddObjectInstanceView` |
| Xuất ảnh | `d.RenderEnhanced(duong_dan.emf)` xuất EMF **vector**. Chờ file xuất hiện vì Rose ghi bất đồng bộ. Chuyển sang PNG nét bằng `docs/rose/render.ps1` (GDI+, hệ số 3–4): `powershell -NoProfile -ExecutionPolicy Bypass -File docs/rose/render.ps1 in.emf out.png 4` rồi cắt viền trắng. Màu đúng mặc định Rose |
| Chụp màn hình | **Không** dùng: máy đang được người dùng sử dụng, ảnh chụp lẫn cửa sổ khác. Chỉ xuất qua `RenderEnhanced` |

### Quy trình đang dùng (đã chạy được 30/10/2026)

Chạy trên **phiên Rose do chủ máy tự mở** (có bản quyền). Script gắn vào bằng `GetActiveObject('Rose.Application')`.

1. `diagrams_klcn.py`: nội dung 49 sơ đồ (đối tượng, thông điệp, hoạt động, nhánh, object flow).
2. `rosedraw.produce()`:
   - mở `empty.mdl`, lưu ngay thành `<ten>_work.mdl` trong thư mục đích để Rose không hỏi "Save Changes?";
   - tạo sơ đồ bằng API; lưu `_raw.mdl`;
   - `fix_petal()` sửa file Rose: đặt tên đối tượng ngay dưới biểu tượng, dời thông điệp xuống dưới tên, giãn khoảng cách
     đối tượng 1,3 lần, nới độ rộng nhãn, bật đánh số thông điệp, lane bằng nhau, bỏ lane rỗng Rose tự thêm cho object,
     đặt **zoom 150** cho mọi sơ đồ (API `ZoomFactor` không có tác dụng);
   - mở lại file đã sửa (`<ten>.mdl`, sửa tiếp được bằng tay trong Rose).
3. `capture.py`: chụp **đúng hình Rose tự vẽ** bằng `PrintWindow`. Hàm này chỉ chụp cửa sổ Rose, kể cả khi cửa sổ bị che, và không
   chụp màn hình người dùng. Rose được dời tạm ra ngoài màn hình, bỏ chọn mọi phần tử, rồi cuộn từng đoạn
   (`SB_LINEDOWN`; vị trí thanh cuộn tính bằng pixel). Các ô được ghép lại kèm thanh tiêu đề lane/đối tượng, cắt phần thừa,
   sau đó trả cửa sổ Rose về vị trí cũ.
   - Ảnh xuất qua `RenderEnhanced` (EMF) rồi dựng lại bằng GDI+ cho nét mảnh, nhạt, không giống Rose. Chủ đề tài
     **không chấp nhận** cách này.
4. `insert_report.py`: chèn ảnh vào báo cáo, tạo style Heading 5, thêm đề mục 2.2.2.x.1–3, 2.3.2.N, 3.4.x.y.1–2, xóa sơ đồ cũ
   ở 3.4. Sau đó cập nhật trường và mục lục bằng Word (COM).

Lệnh chạy, tại thư mục `docs/rose`:

```powershell
$env:ROSETLB_DIR = '<thư mục chứa rosetlb.py>'
python run_all.py D:\huit\khoaluan\doc\rose            # toàn bộ; hoặc thêm tên sơ đồ để chạy lại vài cái
$env:DOCLIB_DIR = '<thư mục chứa doclib.py>'
python insert_report.py <bao_cao_vao.docx> <bao_cao_ra.docx> D:\huit\khoaluan\doc\rose
```

Lưu ý khi làm tiếp:
- Không gọi `NewModel/OpenModel` khi mô hình đang sửa dở: Rose bật hộp thoại "Save Changes?" chặn script. `rosedraw.settle()`
  tự lưu trước khi mở.
- Mỗi lần `Dispatch('Rose.Application')` mở thêm một tiến trình Rose; luôn dùng `GetActiveObject`.
- Nhãn không dùng dấu ngoặc kép; tránh dấu ngoặc đơn lẻ (không có cặp đóng – mở).

## 3. Quy ước sơ đồ và đề mục

- Tên sơ đồ trong Rose: `SD_<ma>` (sequence) và `AD_<ma>` (activity). Mỗi chức năng là một package trong Logical View.
- Lưu toàn bộ mô hình vào `D:\huit\khoaluan\doc\rose\KLCN_SoopiWarranty.mdl`, ảnh EMF/PNG vào `D:\huit\khoaluan\doc\rose\img\`
  để dễ sửa lại sau.
- Đối tượng sequence lấy theo mã nguồn thật: `UI_<Trang>` (boundary), `<Ten>Controller` (control: `TicketsController`,
  `QuotationsController`, `StockIssuesController`…), `<Ten>Service` nếu cần, entity là bảng SQL (`PhieuTiepNhan`,
  `PhieuBaoGia`, `TonKhoTheoKe`…).
- Thông điệp gọi hàm ghi dạng `TenHam(thamSo)`; thông điệp trả về dùng `Synchronization = 6`.
- Đề mục trong Word dùng style có sẵn: Heading 3 cho `2.3.2.x`, Heading 4 cho `2.2.2.x` và `3.4.x.y`; mức con
  `x.x.x.x.1 / .2` dùng Heading 5. Nếu file chưa có Heading 5, tạo bằng cách sao định dạng Heading 4 và thêm `outlineLvl 4`.
  Chú thích hình vẫn dùng style `BC Ten hinh` có trường `SEQ Hình`.

## 4. Danh sách sơ đồ cần có

### Chương 2 – phân tích (thêm sequence, đánh đề mục)

Mỗi quy trình 2.2.2.x tách thành: `x.1. Đặc tả`, `x.2. Sơ đồ hoạt động` (đã có, vẽ bằng Rose), `x.3. Sơ đồ tuần tự` (**mới**).

| Mục | Quy trình | Sequence mới |
|---|---|---|
| 2.2.2.1 | Yêu cầu & Tiếp nhận | [x] |
| 2.2.2.2 | Thực hiện bảo hành | [x] |
| 2.2.2.3 | Báo giá & Xác nhận sửa chữa | [x] |
| 2.2.2.4 | Thực hiện sửa chữa | [x] |
| 2.2.2.5 | Bàn giao thiết bị | [x] |
| 2.2.2.6 | Tra cứu tiến độ | [x] |
| 2.2.2.7 | Nhập linh kiện | [x] |

Mục 2.3.2 có 21 đặc tả use case hệ thống. Đổi mỗi dòng "Đặc tả UC hệ thống cho chức năng …" thành đề mục `2.3.2.1` … `2.3.2.21`,
theo đúng thứ tự trong báo cáo: gửi yêu cầu bảo hành, tra cứu thông tin, tra cứu tình trạng sửa chữa, lập phiếu báo giá, phê
duyệt báo giá, xác nhận báo giá, đăng nhập/đăng xuất, tiếp nhận, bàn giao, thanh toán, quản lý danh mục, xem báo cáo thống kê,
lập phiếu nhập kho, xác nhận xuất kho & cập nhật tồn kho, quản lý tài khoản & phân quyền, phân công xử lý thiết bị, cập nhật
kết quả chẩn đoán lỗi, phân loại điều kiện bảo hành, lập phiếu yêu cầu xuất linh kiện, cập nhật trạng thái sửa chữa, ghi nhận
kết quả kiểm định KCS.

### Mục 3.4 – mỗi chức năng: `.1 Sơ đồ hoạt động` + `.2 Sơ đồ tuần tự`, vẽ mới bằng Rose

| Mục | Chức năng | Activity | Sequence |
|---|---|---|---|
| 3.4.1.1 | Đăng ký yêu cầu bảo hành | [x] | [x] |
| 3.4.1.2 | Tiếp nhận thiết bị | [x] | [x] |
| 3.4.1.3 | Bàn giao thiết bị | [x] | [x] |
| 3.4.1.4 | Thanh toán hóa đơn | [x] | [x] |
| 3.4.2.1 | Lập phiếu báo giá sửa chữa | [x] | [x] |
| 3.4.2.2 | Phê duyệt báo giá sửa chữa | [x] | [x] |
| 3.4.2.3 | Xác nhận / Từ chối báo giá | [x] | [x] |
| 3.4.3.1 | Phân công xử lý thiết bị | [x] | [x] |
| 3.4.3.2 | Cập nhật kết quả chẩn đoán lỗi | [x] | [x] |
| 3.4.3.3 | Phân loại điều kiện bảo hành | [x] | [x] |
| 3.4.3.4 | Cập nhật trạng thái sửa chữa | [x] | [x] |
| 3.4.3.5 | Ghi nhận kết quả KCS | [x] | [x] |
| 3.4.4.1 | Lập phiếu nhập kho linh kiện | [x] | [x] |
| 3.4.4.2 | Lập phiếu yêu cầu xuất linh kiện | [x] | [x] |
| 3.4.4.3 | Xác nhận xuất kho & trừ tồn | [x] | [x] |
| 3.4.5.1 | Quản lý tài khoản & phân quyền | [x] | [x] |
| 3.4.5.2 | Quản lý danh mục hệ thống | [x] | [x] |
| 3.4.5.3 | Báo cáo thống kê | [x] | [x] |

Tổng: 7 sequence ở chương 2 và 36 sơ đồ ở mục 3.4. Thêm 3 cặp activity + sequence (`EXTRA` trong `diagrams_klcn.py`)
cho các UC của SuonWord chưa có ở 3.4: `UC_TraCuuThongTin`, `UC_TraCuuTinhTrang`, `UC_DangNhap`. Tổng cộng 49 sơ đồ. Các sơ đồ dạng hộp chữ hiện có ở 3.4 (không phải Rose) phải xóa và thay thế.

## 5. Checklist tiến độ

- [x] Xác nhận Rose 2006 điều khiển được qua COM (Python + makepy)
- [x] Vẽ thử sequence qua API, xuất EMF và chuyển PNG nét đúng màu Rose (`docs/rose/proto_sequence.py`, `render.ps1`)
- [x] Mở Rose bằng bản quyền của chủ máy; script gắn vào phiên đang mở
- [x] Giải quyết bố cục sequence bằng cách sửa file `.mdl` (mục 2)
- [x] Activity diagram có swimlane, decision, object flow
- [x] Chụp ảnh đúng kiểu Rose hiển thị (PrintWindow, zoom 150, ghép ô)
- [x] Viết nội dung 49 sơ đồ (`docs/rose/diagrams_klcn.py`)
- [x] Sinh toàn bộ sơ đồ, lưu `.mdl`, chụp 49 PNG vào `D:\huit\khoaluan\doc\rose\` (đã xem từng ảnh)
- [x] Điền SuonWord của nhóm bằng `fill_suon.py` (mục 7); phần 4.3 App Mobile để trống theo yêu cầu
- [ ] Báo cáo KLCN riêng: chạy `insert_report.py` (dry-run đã qua, chưa ghi vào file thật). Chèn vào báo cáo, thêm đề mục 2.2.2.x.y, 2.3.2.x, 3.4.x.y.z; xóa sơ đồ không phải Rose
- [ ] Cập nhật mục lục, danh mục hình bằng Word; xuất PDF kiểm tra ảnh không vượt lề 15 cm

## 6. Tệp liên quan

| Tệp | Nội dung |
|---|---|
| `docs/rose/diagrams_klcn.py` | Nội dung 49 sơ đồ (43 + 3 cặp UC thêm cho SuonWord) |
| `docs/rose/rosedraw.py` | Tạo sơ đồ qua COM, sửa file `.mdl`, quy trình `produce()` |
| `docs/rose/capture.py` | Chụp sơ đồ đúng hình Rose (PrintWindow, ghép ô) |
| `docs/rose/run_all.py`, `insert_report.py` | Chạy toàn bộ; chèn vào báo cáo KLCN |
| `docs/rose/fill_suon.py` | Điền các mục "(Chưa chèn)/(Còn thiếu)" của SuonWord (mục 7) |
| `docs/rose/empty.mdl` | Mô hình rỗng làm điểm bắt đầu |
| `docs/rose/proto_sequence.py`, `render.ps1`, `run_test.py` | Bản thử ban đầu (xuất EMF), chỉ để tham khảo |
| `D:\huit\khoaluan\doc\rose\KLCN_SoopiWarranty.mdl` | Mô hình Rose chứa toàn bộ sơ đồ, mở bằng Rose để sửa tay |
| `docs/rose/tlbdump.py` | Liệt kê interface, hàm và hằng số trong `rationalrose.tlb` |

## 7. Điền SuonWord (khung báo cáo của nhóm)

`C:\Users\LECOO\Downloads\SuonWord.docx` đã được điền ngày 30/10/2026; bản gốc lưu ở `SuonWord_goc.docx` cùng thư mục.

```powershell
$env:DOCLIB_DIR = '<thư mục chứa doclib.py>'
python fill_suon.py <SuonWord_goc.docx> <ra.docx> D:\huit\khoaluan\doc\backups\BaoCao_KLCN_truoc_SuonWord_20261030.docx `
  D:\huit\khoaluan\doc\rose D:\huit\khoaluan\doc\BaoCao_Tuan01_02\BaoCao_Tuan01_02\BieuMau <erd.png> ..\..\database\01_schema.sql
```

- Nguồn nội dung phải là báo cáo KLCN **cấu trúc cũ** (có Heading 1 "MỞ ĐẦU"). File KLCN chính đã được đổi sang cấu trúc
  SuonWord lúc 20:35 ngày 30/10, nên dùng bản trong `backups`.
- Dùng đúng mẫu của SuonWord: đề mục là đoạn in đậm đánh số tay, chú thích hình/bảng không đánh số, bảng `TableGrid`.
- Mục đã điền: 2.1.2 biểu mẫu; 2.3.1–7 đặc tả UC nghiệp vụ; 2.4.1–7 sơ đồ hoạt động + tuần tự; 3.3.1–21 đặc tả, sơ đồ
  hoạt động, sơ đồ tuần tự cho từng UC hệ thống; 3.4 sơ đồ lớp phân tích; 3.7 ERD và 49 bảng chi tiết sinh từ `01_schema.sql`;
  4.2.1–4.2.2 giao diện web; 5.1 kiểm thử; 5.2 đánh giá theo đề cương; Kết luận; Tài liệu tham khảo.
- **4.3 App Mobile không phải phần của nhóm này, giữ nguyên "(Tương tự)".**
- Chưa làm: mục lục SuonWord chưa cập nhật (đề mục không dùng style Heading); chưa có sơ đồ lớp mức thiết kế; chức năng
  kiểm kê chưa có trong hệ thống nên 5.2 ghi "Chưa đạt".

## 8. Ghép SuonWord (1) vào báo cáo KLCN theo mẫu (30/10/2026)

`docs/rose/merge_suon1.py <klcn.docx> "<SuonWord (1).docx>" <ra.docx>`, sau đó mở bằng Word để cập nhật trường SEQ, mục lục,
danh mục hình/bảng (`Fields.Update`, `TablesOfContents.Update`, `TablesOfFigures.Update`).

- Bìa theo mẫu (KHÓA LUẬN TỐT NGHIỆP, Mã SV – Họ tên – Lớp), thêm "(NT)" cho nhóm trưởng, ngày theo SuonWord (tháng 10/2026).
- Mục mới "BẢNG PHÂN CÔNG CÔNG VIỆC 12 TUẦN" (Heading 1, trước Mục lục) lấy bảng của SuonWord (1).
- "MỞ ĐẦU" chia 1. GIỚI THIỆU / 2. MỤC TIÊU ĐỀ TÀI / 3. ĐỐI TƯỢNG VÀ PHẠM VI ĐỀ TÀI như mẫu.
- Các đoạn nhóm sửa ở 1.6 và 2.1.1; 11 biểu mẫu mới ở 2.1.2; đặc tả UC nghiệp vụ 2.3 theo bảng 2 cột của SuonWord
  (2.3.6, 2.3.7 chuyển từ nội dung cũ sang cùng dạng); tên quy trình ở 2.3/2.4 đổi theo SuonWord.
- Đề mục cấp 2 (1.1, 2.1…) viết in hoa theo quy định của mẫu.
- Sao lưu trước khi ghép: `D:\huit\khoaluan\doc\backups\BaoCao_KLCN_truoc_SuonWord1_20261030.docx`.

## 9. Sửa theo góp ý lần 2 (30/10/2026)

- **Bố trí sơ đồ hoạt động** (`rosedraw._route_activity`): sau `fix_petal`, mọi transition được ghi lại `vertices` thành
  đường gấp khúc vuông góc, chọn đường không cắt hoạt động/nút quyết định/đối tượng và không chồng lên dây đã vẽ.
  Rose bỏ các điểm gấp quá gần nhau, nên `ROW_H = 240` (khoảng trống giữa hai hàng đủ dài cho đoạn gấp).
  Nhãn điều kiện đặt cạnh đoạn đầu tiên. Đối tượng nằm trong lane (`OBJECT_DX`), lane hẹp hơn khi có 3–4 tác nhân
  (`lanes_w(spec, w)` trong `diagrams_klcn.py`).
- **Ảnh chụp**: `capture.crop_after_last_lane` cắt dải trống bên phải lane cuối (trông như lane không có ai);
  `_repaint_header` dựng lại thanh tên lane theo từng lane vì Rose canh giữa tên trong phần đang thấy khi cuộn ngang.
- **2.4**: 7 sơ đồ hoạt động nghiệp vụ mới `AD_2_2_2_1..7` (`CH2_ACT`), mỗi hành động nằm trong lane người thực hiện.
- **3.4**: `class_diagram.py` vẽ sơ đồ lớp mức phân tích trong Rose (gói `LopPhanTich`, 19 lớp, 22 quan hệ có bản số).
  Lớp cùng tên ở gói `DoiTuong` nên quan hệ phải trỏ bằng tên đầy đủ (`GetQualifiedName()`).
- **ERD đen trắng** (`docs/rose/erd/erd.mjs`, `shot.cjs`): Graphviz WebAssembly (`npm install @hpcc-js/wasm-graphviz`)
  vẽ 5 hình theo nhóm, mỗi thực thể chỉ có tên, khóa chính và tối đa 3 thuộc tính, không ghi cột khóa ngoại;
  tự chọn bố cục để chữ in ra ≥ 7pt. `shot.cjs` chụp SVG bằng Edge (playwright-core).
- **Báo cáo** (`polish_report.py`): viền đen, bỏ nền mọi bảng; tên use case viết hoa chữ đầu, nhãn cột in đậm;
  thay ảnh 2.4, 3.3, 3.4; mục 3.7.1–3.7.3 chuyển sang bảng; 3.7.4 thay bằng 5 ERD.

Lệnh (thư mục `docs/rose`):

```powershell
python run_all.py D:\huit\khoaluan\doc\rose
python class_diagram.py D:\huit\khoaluan\doc\rose
cd erd; node erd.mjs schema.json <thư mục ra> 3; node shot.cjs <ra>\erd_1_taikhoan.svg <ra>\erd_1_taikhoan.png 2
python polish_report.py <vào.docx> <ra.docx> D:\huit\khoaluan\doc\rose D:\huit\khoaluan\doc\rose\erd
```
