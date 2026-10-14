#!/usr/bin/env bash
#
# TCMPlay — macOS setup pipeline
# Bản tương đương SetupProject.bat (Windows) cho macOS.
# Cách dùng: double-click trong Finder, hoặc chạy `./SetupProject.command`.
#
set -euo pipefail

# 1. Về thư mục chứa script (hoạt động cả khi double-click từ Finder)
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 2. Tên Cocos project = Cocos<tên-thư-mục-repo hiện tại>
parent="$(basename "$PWD")"
CocosProjectName="Cocos${parent}"

echo "Welcome to TCMPlay setup pipeline!"
echo "This script will:"
echo "  1. Change cocos project name to ${CocosProjectName}"
echo "  2. Update submodule"
echo "  3. Install npm dependencies"
read -r -p "Press Enter to continue (Ctrl+C to cancel)... " _

# 3. Gỡ sạch submodule cũ (deinit + xoá gitlink + entry .gitmodules + cache) — idempotent
for sub in \
  CocosPlayableAdsTemplate/assets/PLAGameFoundation \
  CocosPlayableAdsTemplate/assets/PlayableParamterTool \
  CocosPlayableAdsTemplate/tools/optimize-size; do
  git submodule deinit -f "$sub" 2>/dev/null || true
  git rm -f "$sub" 2>/dev/null || true
  git config -f .gitmodules --remove-section "submodule.$sub" 2>/dev/null || true
  rm -rf ".git/modules/$sub" "$sub"
done
git add .gitmodules 2>/dev/null || true

# 4. Đổi tên Cocos project
mv CocosPlayableAdsTemplate "${CocosProjectName}"

# 5. Chạy Node setup với tên project mới
node setup.js "${CocosProjectName}"

# 6. Cài npm dependencies (project + editor extension super-html)
echo "Installing npm dependencies..."
( cd "${CocosProjectName}" && npm install )
# super-html là editor extension có deps riêng (jszip, cheerio, vue…) — thiếu -> panel lỗi "Cannot find module 'jszip'"
if [ -d "${CocosProjectName}/extensions/super-html" ]; then
  echo "Installing super-html extension dependencies..."
  ( cd "${CocosProjectName}/extensions/super-html" && npm install )
fi

# 7. RE-Add submodule (fork nguyencongchang; --force bỏ qua entry .gitmodules còn sót)
git submodule add --force git@github.com:nguyencongchang/tcm-PLAGameFoundation.git   "${CocosProjectName}/assets/PLAGameFoundation"
git submodule add --force git@github.com:nguyencongchang/tcm-PlayableParamterTool.git "${CocosProjectName}/assets/PlayableParamterTool"
git submodule add --force git@github.com:nguyencongchang/tcm-optimize-size.git        "${CocosProjectName}/tools/optimize-size"

# 8. Chuyển tất cả submodule sang nhánh develop (tolerant nếu submodule không có develop)
git submodule foreach 'git switch develop || true'

echo ""
echo "✅ Done. Mở '${CocosProjectName}' trong Cocos Creator."
