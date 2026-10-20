"""Build and statically verify the self-contained cloud notebook."""
import ast
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / "experiments/warranty-lora"


def cell(kind, text):
    result = {"cell_type": kind, "metadata": {}, "source": text.strip().splitlines(keepends=True)}
    if kind == "code":
        result.update(execution_count=None, outputs=[])
    return result


payload = {name: (source / name).read_text(encoding="utf-8") for name in ("train.py", "examples.jsonl", "build_dataset.py", "test_dataset.py")}
rows = [json.loads(line) for line in payload['examples.jsonl'].splitlines() if line.strip()]
counts = {name: sum(row['split'] == name for row in rows) for name in ('train', 'eval', 'test')}
scenarios = len({row['scenario_id'] for row in rows})
cells = [
    cell("markdown", f"""
# Thử train chatbot Soopi — Colab / Kaggle

Fine-tune **LoRA Qwen2.5-0.5B-Instruct** với **{counts['train']} mẫu train, {counts['eval']} eval, {counts['test']} test giả lập** ({scenarios} kịch bản, tối đa 8 kiểu viết: có dấu, không dấu, chat, khẩu ngữ, viết tắt, viết liền, Telex, chêm tiếng Anh).
Không cần API key. Không upload database hoặc dữ liệu khách hàng thật.
Đây là thử nghiệm quy trình, chưa phải model đủ chất lượng để triển khai.

**Colab:** Runtime → Change runtime type → GPU. **Kaggle:** Settings → Accelerator → GPU, bật Internet.
GPU miễn phí tùy tài khoản/hạn mức; notebook dừng nếu không có CUDA.
Chạy lần lượt các cell, tải ZIP ở cuối trước khi runtime hết hạn.
Không cần mount Google Drive hoặc đăng nhập Hugging Face.

Quyền xem phiếu và tách lịch sử theo phiên đăng nhập phải được kiểm soát bởi backend, không dựa vào model.
"""),
    cell("code", """
import subprocess
import sys
import torch

assert torch.cuda.is_available(), "Hãy bật GPU trong Colab/Kaggle rồi chạy lại."
print("GPU:", torch.cuda.get_device_name(0), "| PyTorch:", torch.__version__)
subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet",
                       "transformers==5.19.0", "peft==0.21.2", "accelerate==1.15.0"])
# This float32 LoRA trial does not use torchao; Colab may ship an incompatible optional version.
subprocess.check_call([sys.executable, "-m", "pip", "uninstall", "-y", "torchao"])
"""),
    cell("markdown", """
## Chuẩn bị dữ liệu và code

Cell này chỉ ghi các file mẫu có sẵn trong notebook. Không kết nối ứng dụng/SQL Server.
Nếu muốn đổi dữ liệu, sửa nội dung `examples.jsonl` trong cell dưới; giữ riêng tập eval.
"""),
    cell("code", "from pathlib import Path\nimport json\nimport os\n\n"
         "workspace = Path('/kaggle/working') if Path('/kaggle/working').is_dir() else Path('/content')\n"
         "project = workspace / 'soopi-lora-trial'\n"
         "experiment = project / 'experiments/warranty-lora'\n"
         "experiment.mkdir(parents=True, exist_ok=True)\n"
         "os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'\n"
         "os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'\n"
         "os.environ['HF_HOME'] = str(project / 'hf-cache')\n"
         f"payload = {payload!r}\n"
         "for name, content in payload.items():\n"
         "    (experiment / name).write_text(content, encoding='utf-8')\n"
         "subprocess.check_call([sys.executable, str(experiment / 'train.py'), '--self-check'])\n"
         "subprocess.check_call([sys.executable, '-m', 'unittest', 'discover', '-s', str(experiment), '-p', 'test_dataset.py'])\n"),
    cell("markdown", """
## Train và đánh giá trước/sau

Mặc định 2 lượt qua toàn bộ tập train (2 epoch), chỉ train adapter LoRA. Thời gian chạy còn phụ thuộc GPU và phần sinh câu trả lời eval/test. Base model tải từ Hugging Face và được cố định revision cho lần chạy.
Cell chạy bằng tiến trình riêng để giải phóng GPU khi xong. Chạy lại sẽ train từ base, không resume lần trước.
"""),
    cell("code", """
EPOCHS = 2
assert 1 <= EPOCHS <= 3
log_path = project / 'training.log'
command = [sys.executable, '-u', str(experiment / 'train.py'), '--epochs', str(EPOCHS)]
with log_path.open('a', encoding='utf-8') as log:
    log.write('\\n=== Training run ===\\n')
    with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          text=True, encoding='utf-8', errors='replace', bufsize=1) as process:
        try:
            for line in process.stdout:
                print(line, end='', flush=True)
                log.write(line)
                log.flush()
            returncode = process.wait()
        except BaseException:
            if process.poll() is None:
                process.kill()
            process.wait()
            raise
if returncode:
    raise RuntimeError(f'train.py dừng với mã {returncode}. Xem lỗi phía trên; log được giữ tại {log_path}')
output = project / 'artifacts/warranty-lora'
results = json.loads((output / 'results.json').read_text(encoding='utf-8'))
print('Loss trước:', results['before']['mean_answer_loss'])
print('Loss sau:  ', results['after']['mean_answer_loss'])
test = results['test']
print('Test giữ riêng: loss', test['mean_answer_loss'], '| từ khóa', test['keyword_checks_passed'], '/', test['keyword_checks_total'])
for before, after in list(zip(results['before']['predictions'], results['after']['predictions']))[:12]:
    print('\\nCâu hỏi:', after['question'])
    print('Trước:', before['answer'])
    print('Sau:  ', after['answer'])
print('\\nChỉ in 12 câu eval đầu; xem đủ trong results.json. Loss và từ khóa không thay thế đánh giá chất lượng, bảo mật và hội thoại thực tế.')
"""),
    cell("markdown", """
## Tải kết quả

ZIP chứa adapter, tokenizer và báo cáo trước/sau, không chứa base model.
Giữ `results.json` để biết base model/revision cần tải khi dùng lại adapter.
Colab tự mở tải xuống; trên Kaggle lấy ZIP từ Output tại `/kaggle/working`.
"""),
    cell("code", """
import shutil
from IPython.display import FileLink, display

assert (output / 'adapter/adapter_model.safetensors').is_file()
archive = shutil.make_archive(str(workspace / 'warranty-lora-results'), 'zip', root_dir=output)
print('Kết quả:', archive)
try:
    from google.colab import files
except ImportError:
    display(FileLink(archive))
else:
    files.download(archive)
"""),
]
notebook = {"nbformat": 4, "nbformat_minor": 5, "metadata": {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python", "version": "3.12"}, "accelerator": "GPU",
    "colab": {"name": "warranty-lora.ipynb", "provenance": []}}, "cells": cells}
for index, item in enumerate(cells):
    item['id'] = f'soopi-{index}'
    if item['cell_type'] == 'code':
        ast.parse(''.join(item['source']))
path = source / 'warranty-lora.ipynb'
path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
loaded = json.loads(path.read_text(encoding='utf-8'))
tree = ast.parse(''.join(loaded['cells'][3]['source']))
embedded = next(ast.literal_eval(node.value) for node in tree.body
                if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'payload' for t in node.targets))
assert embedded == payload
assert all(not item.get('outputs') for item in loaded['cells'])
print(f'PASS: {len(cells)} cells; Python syntax; embedded code/data match sources; no saved outputs. {path}')
