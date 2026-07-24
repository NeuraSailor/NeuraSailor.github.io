"""
MkDocs build hook — 动态统计站点内容，注入 config.extra.stats。
"""

import os


def on_config(config, **kwargs):
    """在配置加载后、构建开始前注入 stats。"""
    docs_dir = config["docs_dir"]
    stats = {"notes": 0, "courses": 0, "semesters": 0, "mecharm": 0}

    top = os.path.join(docs_dir, "学习笔记")
    if os.path.isdir(top):
        for entry in os.listdir(top):
            epath = os.path.join(top, entry)
            if not os.path.isdir(epath):
                continue
            # 学期目录
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
            # 机械臂 blog
            elif entry == "机械臂blog":
                for _root, _dirs, files in os.walk(epath):
                    for f in files:
                        if f.endswith(".md"):
                            stats["mecharm"] += 1

    config.extra["stats"] = stats
    return config
