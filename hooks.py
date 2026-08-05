"""
MkDocs build hook — 动态统计站点内容，注入 config.extra.stats。
统计全部通过遍历文件系统动态计算（软函数），不硬编码任何数字。
"""

import os


def _count_md(root):
    """递归统计 root 下所有 .md 文件数。"""
    total = 0
    for _root, _dirs, files in os.walk(root):
        total += sum(1 for f in files if f.endswith(".md"))
    return total


def on_config(config, **kwargs):
    """在配置加载后、构建开始前注入 stats。"""
    docs_dir = config["docs_dir"]
    stats = {"notes": 0, "courses": 0, "semesters": 0, "blogs": 0}

    # ---- 学习笔记：学期 / 课程 / 笔记数（遍历，原逻辑不变）----
    notes_top = os.path.join(docs_dir, "学习笔记")
    if os.path.isdir(notes_top):
        for entry in os.listdir(notes_top):
            epath = os.path.join(notes_top, entry)
            if not os.path.isdir(epath):
                continue
            if entry in ("大一上", "大一下", "大二上"):
                stats["semesters"] += 1
                for sub in os.listdir(epath):
                    spath = os.path.join(epath, sub)
                    if not os.path.isdir(spath):
                        continue
                    stats["courses"] += 1
                    for f in os.listdir(spath):
                        if f.endswith(".md"):
                            stats["notes"] += 1

    # ---- 科研竞赛blog：软函数汇总所有子模块 .md 数（机械臂/强化学习/未来新增）----
    blog_root = os.path.join(docs_dir, "科研竞赛blog")
    if os.path.isdir(blog_root):
        for entry in os.listdir(blog_root):
            epath = os.path.join(blog_root, entry)
            if os.path.isdir(epath):
                stats["blogs"] += _count_md(epath)

    config.extra["stats"] = stats
    return config
