#!/usr/bin/env bash
# Tải model embedding chạy tại chỗ cho RAG của trợ lý AI.
#
# Model: intfloat/multilingual-e5-small, bản ONNX lượng tử hoá int8 do Xenova xuất
# (118 MB + tokenizer 17 MB). Đa ngôn ngữ, 384 chiều, chạy trong JVM bằng ONNX Runtime —
# không gọi mạng lúc chạy, không tốn phí, hợp triển khai on-premise.
#
# Tệp nằm ở backend/models/ (gitignore). Chạy một lần sau khi clone:
#   bash backend/fetch-embedding-model.sh
#
# Đổi model thì đổi hai URL dưới VÀ đổi app.ai.rag.embedding.dimension trong application.yaml —
# bảng vector đặt tên theo model nên kho cũ không bị nạp đè.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HERE/models/multilingual-e5-small"
BASE="https://huggingface.co/Xenova/multilingual-e5-small/resolve/main"

mkdir -p "$DEST"

fetch() {
  local url="$1" out="$2" expect="$3"
  if [ -f "$out" ] && [ "$(wc -c < "$out")" -eq "$expect" ]; then
    echo "  đã có: $(basename "$out")"
    return
  fi
  echo "  tải:   $(basename "$out") ($((expect / 1024 / 1024)) MB)"
  curl -L --fail --progress-bar -o "$out.part" "$url"
  local got; got="$(wc -c < "$out.part")"
  if [ "$got" -ne "$expect" ]; then
    echo "  LỖI: $(basename "$out") tải về $got byte, mong đợi $expect" >&2
    rm -f "$out.part"; exit 1
  fi
  mv "$out.part" "$out"
}

echo "Model embedding → $DEST"
fetch "$BASE/onnx/model_quantized.onnx" "$DEST/model.onnx" 118308185
fetch "$BASE/tokenizer.json"            "$DEST/tokenizer.json" 17082730
echo "Xong."
