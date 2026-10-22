# Thử fine-tune chatbot Soopi trên Colab / Kaggle

Mở `warranty-lora.ipynb`: notebook tự chứa code và **1.521 mẫu giả lập từ 204 kịch bản**, tối đa 8 kiểu viết,
không cần upload repository, database, API key hay thông tin khách hàng.
Đây là **fine-tune LoRA Qwen2.5-0.5B-Instruct**, không huấn luyện LLM từ đầu.

## Google Colab

1. Vào <https://colab.research.google.com/>, chọn **File → Upload notebook** và tải `warranty-lora.ipynb` lên.
2. Chọn **Runtime → Change runtime type → GPU** (T4 nếu có).
3. Chạy các cell theo thứ tự. Cell cuối tải `warranty-lora-results.zip` về máy.

## Kaggle

1. Tạo notebook tại <https://www.kaggle.com/code>, dùng chức năng **Import Notebook** để tải cùng file `.ipynb` lên.
2. Trong Settings, bật **Internet** và chọn **Accelerator → GPU**. Nếu GPU bị khóa, kiểm tra yêu cầu xác minh tài khoản trên Kaggle.
3. Chạy các cell theo thứ tự. Tải `warranty-lora-results.zip` từ Output trong `/kaggle/working`.

Notebook dừng nếu không có CUDA, không tự chạy training bằng CPU. Dùng một GPU,
float32, batch 1, tối đa 768 token/mẫu. Mặc định 2 epoch = 1.750 bước,
cho phép 1–3 epoch. Có thể dùng `--steps 10` để thử ngắn bằng GPU trước.
Không cần bitsandbytes hay Flash Attention. PyTorch dùng bản có sẵn trên nền tảng;
Transformers, PEFT và Accelerate được cố định phiên bản trong notebook.
Lần đầu cần Internet để cài thư viện và tải base model công khai từ Hugging Face.
Không tự mua tài nguyên hay đăng model lên dịch vụ khác.

Cell cài đặt gỡ `torchao` khỏi runtime cloud vì bản LoRA float32 này không sử dụng nó.
PEFT 0.21.2 sẽ báo lỗi nếu môi trường có torchao cũ hơn 0.16.0, kể cả khi không chủ động dùng lượng tử hóa.
Nếu đã gặp lỗi với notebook cũ: chạy `%pip uninstall -y torchao`, chọn **Runtime → Restart session**,
rồi chạy lại các cell cài đặt, chuẩn bị và train. Không cần xóa runtime hoặc tải dataset riêng.

## Kết quả và giới hạn

- `adapter/adapter_model.safetensors`: trọng số LoRA; khi sử dụng vẫn cần đúng base model và revision ghi trong `results.json`.
- `before.json`, `results.json`: loss, câu trả lời trước/sau, số tham số được train và kiểm tra trọng số thực sự thay đổi.
- **875 mẫu train, 325 eval, 321 test**, tách theo kịch bản: mọi kiểu viết của một kịch bản luôn nằm cùng tập. Eval dùng so sánh trước/sau; test chỉ chấm sau khi train và không đưa vào optimizer. Các tập vẫn chia sẻ chủ đề và kiến thức nghiệp vụ, không phải bài kiểm tra miền hoàn toàn mới.
- **21 nhóm nhãn**, gồm giới thiệu, trạng thái, tiến độ, báo giá, chính sách, yêu cầu online, tra cứu, tài khoản, thanh toán, bàn giao, đánh giá, dữ liệu phiếu giả lập, bảo mật, phiên đăng nhập, câu hỏi mơ hồ, hội thoại nhiều lượt, phàn nàn và ngoài phạm vi. Một số nhãn cùng chủ đề nhưng khác dạng tình huống.
- Kiểu viết: viết tay `standard`, `chat`, `colloquial`; tự sinh từ câu chuẩn `no_accents` (không dấu), `teencode` (ko, dc, j, z, bh, bg, sđt, ntn…), `no_spaces` (viết liền), `telex` (tắt bộ gõ: "dduwowcj"), `vietlish` (chêm check, status, login, confirm…). Biến thể không đổi so với kiểu đã có thì bị bỏ. Hiện có 204 mẫu mỗi kiểu standard/no_accents/chat/colloquial/no_spaces/telex, 196 teencode và 101 vietlish.
- Có câu hỏi kiểu “shop oi may e toi dau r”, “bh là bảo hành hay bây giờ?”, tình huống chuyển khoản nhưng chưa ghi nhận, lỗi API, từ chối báo giá, dữ liệu cũ mâu thuẫn dữ liệu mới và lệnh độc hại trong ghi chú. Câu trả lời mẫu dùng tiếng Việt rõ ràng, không bắt chước teencode.
- Hội thoại có `history` và tình huống có `context` được đưa vào chat template. Chỉ câu trả lời cuối được tính loss; lịch sử và dữ liệu backend được che nhãn. Context là mô phỏng đầu vào đã được backend lọc quyền, chưa phải kết nối API thật.
- Không cắt âm thầm mẫu dài: training dừng nếu vượt 768 token để người biên soạn sửa lại.
- Kiểm tra từ khóa chỉ tham khảo; khớp từ không chứng minh đúng nghĩa, phủ định đúng hay bảo mật đạt yêu cầu. Mọi mẫu là dữ liệu tổng hợp, chưa được kiểm chứng bằng hội thoại khách hàng thật.
- Các kiểu viết của một kịch bản tương quan với nhau, không phải các ca độc lập. Loss giảm không chứng minh chatbot đủ tốt để dùng thật.
- Dữ liệu nghiệp vụ giả lập cần được duyệt lại trước khi mở rộng. Không đưa phiếu bảo hành thật hoặc dữ liệu cá nhân vào bộ train này.
- Quyền tra cứu phiếu, giới hạn công cụ và lịch sử tách theo phiên đăng nhập phải thực hiện ở backend. Model không phải cơ chế phân quyền.
- Tải ZIP ngay khi chạy xong; runtime có thể bị thu hồi và mất file. GPU miễn phí tùy hạn mức và khả năng cấp phát của nền tảng.

Dữ liệu được sinh từ `build_dataset.py` (không sửa tay `examples.jsonl`). Sinh lại và kiểm tra, không cần thư viện AI:

```powershell
python experiments/warranty-lora/build_dataset.py
python experiments/warranty-lora/train.py --self-check
python -m unittest discover -s experiments/warranty-lora -p "test_*.py"
```

Notebook có bản sao code, dữ liệu, bộ sinh và các kiểm tra. Sau khi sửa nguồn, chạy
`python experiments/warranty-lora/build_notebook.py` để đồng bộ notebook trước khi upload.
Notebook chạy lại các kiểm tra offline trước bước train. Không cần cài thư viện mới vào ứng dụng Soopi.

Nếu cell train dừng, đọc lỗi gốc phía trên dòng `RuntimeError`. Notebook chuyển cả stdout/stderr
vào output của cell và giữ log tại `/content/soopi-lora-trial/training.log` (Kaggle: `/kaggle/working/soopi-lora-trial/training.log`).
`CalledProcessError` của bản notebook cũ chỉ là thông báo tiến trình con thất bại, chưa xác định nguyên nhân.

Tài liệu: [Colab FAQ](https://research.google.com/colaboratory/faq.html),
[Kaggle Notebooks](https://www.kaggle.com/docs/notebooks),
[base model](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct),
[PEFT](https://huggingface.co/docs/peft/quicktour).
