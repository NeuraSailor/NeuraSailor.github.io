#!/usr/bin/env python3
"""转换 MkDocs Material admonition 为 Obsidian callout"""

import re
from pathlib import Path

CALLOUT_TYPES = {
    'note': 'note', 'info': 'info', 'tip': 'tip', 'success': 'success',
    'question': 'question', 'warning': 'warning', 'failure': 'failure',
    'danger': 'danger', 'bug': 'bug', 'example': 'example',
    'abstract': 'abstract', 'important': 'important', 'caution': 'caution',
    'hint': 'hint', 'summary': 'summary', 'quote': 'quote', 'cite': 'cite',
}

def load_quartz_callouts():
    """从 quartz 加载 callout 信息"""
    quartz_path = Path(r'C:\Users\WUZHO\Desktop\quartz\content')
    callouts = {}

    if not quartz_path.exists():
        return callouts

    for md_file in quartz_path.rglob('*.md'):
        try:
            content = md_file.read_text(encoding='utf-8')
            key = (str(md_file.parent.relative_to(quartz_path)), md_file.name)

            result = []
            lines = content.split('\n')
            i = 0
            while i < len(lines):
                line = lines[i]
                match = re.match(r'^>\s*\[!(\w+)\]([+-]?)(?:\s+(.+))?$', line)
                if match:
                    callout_type = match.group(1).lower()
                    fold = match.group(2)
                    title = match.group(3) or ""

                    # 统计内容行
                    content_count = 0
                    j = i + 1
                    while j < len(lines):
                        next_line = lines[j]
                        if re.match(r'^>\s*\[!', next_line):
                            break
                        if next_line.strip().startswith('>'):
                            content_count += 1
                            j += 1
                        elif not next_line.strip():
                            content_count += 1
                            j += 1
                        else:
                            break

                    result.append({
                        'type': callout_type,
                        'fold': fold,
                        'count': content_count,
                        'line': i
                    })

                i += 1

            callouts[key] = result
        except:
            pass

    return callouts

def parse_mkdocs_title(title):
    """解析 mkdocs 标题"""
    if not title:
        return "", ""
    title = title.strip()
    match = re.match(r'^([+-])\s*(.*)$', title)
    if match:
        return match.group(1), match.group(2)
    return "", title

def convert_file(filepath, quartz_callouts):
    """处理单个文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.read().split('\n')

    rel_path = filepath.relative_to(Path(__file__).parent / 'docs')
    key = (str(rel_path.parent), rel_path.name)
    quartz_info = list(quartz_callouts.get(key, []))  # 复制列表
    q_idx = 0

    new_lines = []
    i = 0

    while i < len(lines):
        line = lines[i]

        # 匹配 admonition 格式
        match = re.match(r'^(\s*)(?:>)?!!!\s+(\w+)(?:\s+"([^"]*)")?(?:\s*)$', line)

        if match:
            indent = match.group(1)
            callout_type = match.group(2).lower()
            raw_title = match.group(3) or ""
            obsidian_type = CALLOUT_TYPES.get(callout_type, callout_type)

            # 解析 mkdocs 标题
            mkdocs_fold, title = parse_mkdocs_title(raw_title)

            # 从 quartz 获取相同类型、相同位置的 callout
            fold_marker = ""
            content_count = 0

            # 查找下一个相同类型的 quartz callout
            for qi in range(q_idx, len(quartz_info)):
                q = quartz_info[qi]
                if q['type'] == callout_type:
                    fold_marker = q['fold']
                    content_count = q['count']
                    q_idx = qi + 1  # 移动索引到下一个未使用的位置
                    break

            # 如果 quartz 没有，使用 mkdocs 的
            if not fold_marker:
                fold_marker = mkdocs_fold

            # 构建第一行
            if title:
                first_line = f"{indent}> [!{obsidian_type}]{fold_marker} {title}"
            else:
                first_line = f"{indent}> [!{obsidian_type}]{fold_marker}"

            new_lines.append(first_line)

            # 收集内容行
            i += 1
            lines_added = 0
            while i < len(lines) and lines_added < content_count:
                next_line = lines[i]

                if re.match(r'^\s*(?:>)?!!!\s+', next_line):
                    break

                if next_line.strip().startswith('##'):
                    break

                stripped = next_line.strip()
                if stripped:
                    # 去掉原始的 > 前缀
                    if stripped.startswith('>'):
                        stripped = stripped.lstrip('>').strip()
                    new_lines.append(f"{indent}> {stripped}")
                    lines_added += 1
                elif stripped == '' and new_lines[-1].strip():
                    new_lines.append(f"{indent}>")
                    lines_added += 1

                i += 1

            # 跳过多余内容行
            while i < len(lines):
                next_line = lines[i]
                stripped = next_line.strip()
                if re.match(r'^\s*(?:>)?!!!\s+', next_line) or stripped.startswith('##'):
                    break
                if stripped and not stripped.startswith('>'):
                    break
                i += 1
        else:
            new_lines.append(line)
            i += 1

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_lines))

    return True

def main():
    print("加载 quartz callout 信息...")
    callouts = load_quartz_callouts()
    count = sum(len(v) for v in callouts.values())
    print(f"已加载 {count} 个 callout 信息")

    docs_dir = Path(__file__).parent / 'docs'
    converted = []

    for md_file in docs_dir.rglob('*.md'):
        try:
            convert_file(md_file, callouts)
            converted.append(str(md_file.relative_to(docs_dir.parent)))
        except Exception as e:
            print(f"处理 {md_file} 时出错: {e}")

    print(f"\n转换完成！共 {len(converted)} 个文件")

if __name__ == '__main__':
    main()
