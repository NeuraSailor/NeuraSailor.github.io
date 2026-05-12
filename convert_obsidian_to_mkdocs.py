#!/usr/bin/env python3
"""
Obsidian → MkDocs 语法转换脚本 v4
修复链接格式和 callout 类型
"""

import re
import os
from pathlib import Path
import shutil

def fix_asset_paths(content, md_file=None, docs_dir=None):
    """修复 assets 引用路径 - 子目录文件需要相对路径回到 docs 根目录"""
    if md_file is None or docs_dir is None:
        return content

    md_path = md_file.relative_to(docs_dir)
    parent_depth = len(md_path.parts) - 1  # 父目录层数

    def replace_asset(match):
        alt = match.group(1)
        url = match.group(2)
        attrs = match.group(3) if len(match.groups()) >= 3 else ''

        # 如果已经使用绝对路径 (/assets/)，保持不变
        if url.startswith('/'):
            return match.group(0)

        # 如果是 assets/ 开头的相对路径 (不是被括号包裹的路径)
        if url.startswith('assets/'):
            # 计算需要回退的层数
            if parent_depth > 0:
                prefix = '../' * parent_depth
                url = prefix + url
            else:
                url = '/' + url  # 根目录文件用绝对路径

        return f'![{alt}]({url}){attrs}'

    # 匹配图片语法，捕获现有的属性
    # 修复: URL 可能包含空格（来自 Obsidian 图片命名 "Pasted image xxx.png"）
    pattern = r'!\[([^\]|]*)\]\(([^)]+)\)([^\n]*?(?:\{:[^\}]+\})?)?'
    content = re.sub(pattern, replace_asset, content)
    return content


def process_markdown(content, md_file=None, docs_dir=None):
    """处理单个 markdown 内容"""

    # 1. 清理 frontmatter
    lines = content.split('\n')
    if lines and lines[0].strip() == '---':
        end_idx = None
        for i in range(1, len(lines)):
            if lines[i].strip() == '---':
                end_idx = i
                break

        if end_idx:
            keep_fields = {'title', 'tags', 'created', 'updated', 'description'}
            new_lines = ['---']
            for line in lines[1:end_idx]:
                key = line.split(':')[0].strip() if ':' in line else ''
                skip_keys = ['dg-publish', 'dg-date', 'dg-permalink', 'dg-home', 'dg-file',
                            'file-class', 'cssclass', 'dg-showtitle', 'dg-fold', 'publish',
                            'date', 'lastmod', 'draft', 'weight']
                if key.lower() in skip_keys or key in skip_keys:
                    continue
                if key.lower() in keep_fields or key in keep_fields:
                    new_lines.append(line)
            new_lines.append('---')
            content = '\n'.join(new_lines + lines[end_idx + 1:])

    # 2. 保护代码块
    code_blocks = []
    pattern = r'(```[\s\S]*?```|`[^`\n]+`)'

    def replace_code(match):
        code_blocks.append(match.group(0))
        return f'__CODE_BLOCK_{len(code_blocks)-1}__'

    content = re.sub(pattern, replace_code, content)

    # 3. 转换图片尺寸语法
    def replace_image(match):
        alt = match.group(1)
        size = match.group(2)
        url = match.group(3)
        return f'![{alt}]({url}){{: width={size} }}'

    pattern = r'!\[([^\]|]*)\|(\d+)\]\(([^\)]+)\)'
    content = re.sub(pattern, replace_image, content)

    # 3.5 修复图片URL中的多余括号和空格（如 "(Pasted) image xxx.png"）
    # 处理格式: ![text]((xxx) yyy.png) -> ![text](xxx_yyy.png)

    def fix_image_in_line(line):
        """逐行处理图片URL"""
        # 匹配完整图片行: ![...](...)
        match = re.match(r'^(!\[.*?\])\((.+)\)$', line)
        if match:
            prefix = match.group(1)
            url = match.group(2)

            # 清理 URL 中的多余括号: (xxx) yyy.png -> xxx_yyy.png
            if url.startswith('('):
                close_idx = url.find(')')
                if close_idx > 0:
                    inside = url[1:close_idx]
                    rest = url[close_idx+1:].lstrip()
                    if rest:
                        url = inside + '_' + rest
                    else:
                        url = inside

            # 替换空格为下划线
            if ' ' in url:
                url = url.replace(' ', '_')

            return f'{prefix}({url})'
        return line

    # 逐行处理整个内容
    lines = content.split('\n')
    content = '\n'.join(fix_image_in_line(line) for line in lines)

    # 4. 处理 wikilinks - 转换为 MkDocs 兼容格式
    def convert_wikilink(match):
        inner = match.group(0)[2:-2]  # 去掉 [[ 和 ]]

        # 处理别名 [[链接|显示文本]]
        if '|' in inner:
            link, text = inner.split('|', 1)
        else:
            link = inner
            text = inner

        # 去掉链接中的 .md 扩展名
        if link.endswith('.md'):
            link = link[:-3]

        # 处理 # 锚点
        if '#' in link:
            base_link, anchor = link.split('#', 1)
            return f'[{text}]({base_link}#{anchor})'

        return f'[{text}]({link})'

    wikilink_pattern = r'\[\[[^\]]+\]\]'
    content = re.sub(wikilink_pattern, convert_wikilink, content)

    # 5. 转换 callout - 支持更多类型
    lines = content.split('\n')
    result = []
    i = 0

    # MkDocs admonition 类型映射
    type_mapping = {
        'tip': 'tip',
        'info': 'info',
        'warning': 'warning',
        'danger': 'danger',
        'example': 'example',
        'note': 'note',
        'important': 'important',
        'caution': 'caution',
        'summary': 'tip',
        'abstract': 'abstract',
        'question': 'question',
    }

    while i < len(lines):
        line = lines[i]
        match = re.match(r'^>\s*\[!([^\]]+)\]\+?\s*(.*)$', line.strip())

        if match:
            callout_type = match.group(1).lower()
            title = match.group(2).strip()

            # 映射类型
            callout_type = type_mapping.get(callout_type, 'note')

            # 收集 callout 内容
            content_lines = []
            i += 1
            while i < len(lines):
                next_line = lines[i]
                if next_line.strip().startswith('>'):
                    content_line = next_line.strip()[1:].strip()
                    content_lines.append(content_line)
                    i += 1
                else:
                    break

            if title:
                result.append(f'!!! {callout_type} "{title}"')
            else:
                result.append(f'!!! {callout_type}')

            # 添加内容（如果有）
            for cl in content_lines:
                result.append(cl)

            continue

        result.append(line)
        i += 1

    content = '\n'.join(result)

    # 6. 修复 assets 引用路径 (仅当有文件路径信息时)
    if md_file and docs_dir:
        content = fix_asset_paths(content, md_file, docs_dir)

    # 7. 恢复代码块
    for i, code in enumerate(code_blocks):
        content = content.replace(f'__CODE_BLOCK_{i}__', code)

    return content


def main():
    """主函数"""
    docs_dir = Path('docs')

    print("正在恢复原始文件...")
    source = Path('C:/Users/WUZHO/Desktop/quartz/content')

    # 清理 docs 目录
    for item in docs_dir.iterdir():
        if item.name != 'index.md':
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()

    # 重新复制
    for item in source.iterdir():
        dest = docs_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)

    # 删除 .obsidian 目录
    obs_dir = docs_dir / '.obsidian'
    if obs_dir.exists():
        shutil.rmtree(obs_dir)

    print("\n开始转换...")
    total = 0
    updated = 0

    for md_file in docs_dir.rglob('*.md'):
        total += 1
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()

            new_content = process_markdown(content, md_file, docs_dir)

            if new_content != content:
                with open(md_file, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                updated += 1
                print(f"✓ {md_file.relative_to(docs_dir)}")

        except Exception as e:
            print(f"✗ {md_file}: {e}")

    print(f"\n完成: 处理 {total} 个文件, 更新 {updated} 个")


if __name__ == '__main__':
    main()
