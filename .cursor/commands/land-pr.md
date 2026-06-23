# Land PR

合并当前分支 PR（squash）并删除远程 head 分支。需已安装并登录 `gh`。

```bash
pnpm pr:land --current
```

仅预览：

```bash
pnpm pr:land --current --dry-run
```

指定 PR 号：

```bash
pnpm pr:land --pr=123
```

合并前全量自检（非日常 push 默认）：

```bash
pnpm verify:pre-push:full
```
