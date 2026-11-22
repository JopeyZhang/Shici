#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""把 d8 生成的 classes.dex 追加进 aapt2 产出的 base.apk（不重新打包，保留已有条目）。"""
import shutil
import sys
import zipfile

src, dex, dst = sys.argv[1], sys.argv[2], sys.argv[3]
shutil.copyfile(src, dst)
with zipfile.ZipFile(dst, "a", zipfile.ZIP_DEFLATED) as z:
    z.write(dex, "classes.dex")
print("[apk] added classes.dex ->", dst)
