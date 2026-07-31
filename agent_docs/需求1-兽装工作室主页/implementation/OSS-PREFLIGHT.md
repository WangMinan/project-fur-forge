# T10 OSS 预检与最小权限

> **范围**：只说明 T10/EXT-02 的可重复验证、运行身份最小权限和秘密放置方式；不实现上传页面、认证、数据库、作品 CRUD 或正式水印参数。

## 1. 固定边界

| 项目 | 固定值或约束 |
| --- | --- |
| Region | `oss-cn-hangzhou` |
| Endpoint | `https://oss-cn-hangzhou.aliyuncs.com` |
| 私有 Bucket | `project-furry-forge-private`，ACL `private`，Bucket 级 Block Public Access 开启 |
| 公开 Bucket | `project-furry-forge-public`，只保存网页衍生图；当前 ACL `public-read` |
| 正式私有前缀 | 每个部署身份只授权自身的 `<env>/original/` 与 `<env>/processing/` |
| 正式公开前缀 | 每个部署身份只授权自身的 `<env>/web/` |
| T10 前缀 | 每次只使用独立的 `test/<run-id>/` |

公开 Bucket 的 `public-read` 表示其中每个对象都可能被匿名读取，不能靠对象命名隐藏内容。因此原图、联系人、原文件名和其他私有数据不得写入该 Bucket。

## 2. 最小权限

条件 PUT 的完整约束由两层共同完成：

1. RAM 只允许向精确 Bucket/前缀执行 `PutObject`；
2. 服务端生成的 V4 URL 同时签入 `Content-Type`、`Content-MD5`、`x-oss-meta-sha256` 和 `x-oss-forbid-overwrite: true`。浏览器请求必须逐项匹配，重复 Key 返回 `FileAlreadyExists`。

生产、开发和预检身份应分开。下面的 `<env>` 只能替换为单一环境（如 `dev` 或 `prod`），不得把它改成 `*`；`<run-id>` 只能替换为本次预检 ID，并在验证后撤销该临时语句。

### 2.1 应用身份

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:GetBucketInfo",
        "oss:GetBucketAcl",
        "oss:GetBucketCors",
        "oss:GetBucketPublicAccessBlock"
      ],
      "Resource": [
        "acs:oss:*:*:project-furry-forge-private",
        "acs:oss:*:*:project-furry-forge-public"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:PostProcessTask"
      ],
      "Resource": [
        "acs:oss:*:*:project-furry-forge-private/<env>/original/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:PostProcessTask",
        "oss:DeleteObject"
      ],
      "Resource": [
        "acs:oss:*:*:project-furry-forge-private/<env>/processing/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject"
      ],
      "Resource": [
        "acs:oss:*:*:project-furry-forge-public/<env>/web/*"
      ]
    }
  ]
}
```

`GetObject` 覆盖对象 HEAD、`image/info`、受控图片处理、服务端读取大原图和必要的签名 GET；`PostProcessTask` 只作用于私有源前缀。内嵌 FFmpeg 的结果只能 `PutObject` 到私有 `<env>/processing/*`，且只按已知 Key 删除；OSS `sys/saveas` 只能写公开 `<env>/web/*`。公开对象的 HEAD/验证使用 `GetObject`，下架清理使用精确 Key 的 `DeleteObject`。

### 2.2 单次 T10 临时增量

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:PostProcessTask",
        "oss:DeleteObject"
      ],
      "Resource": [
        "acs:oss:*:*:project-furry-forge-private/test/<run-id>/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject"
      ],
      "Resource": [
        "acs:oss:*:*:project-furry-forge-public/test/<run-id>/web/*"
      ]
    }
  ]
}
```

预检不需要 `oss:ListObjects`、Bucket/ACL/BPA/CORS 写权限、账号级安全写权限或其他云服务权限。正式方案不得绑定 `AdministratorAccess`、`AliyunOSSFullAccess`、`oss:*` 或长期全桶对象通配权限。

## 3. 秘密放置

- AK/SK 只写入仓库已忽略的本机 `.env`，或 `config/runtime.local.json` 等受控本机安全配置；模板只保留变量名。
- AK/SK 只能进入服务端进程，不得放入仓库、提交、镜像、`runtimeConfig.public`、前端构建产物、测试快照、预检证据或日志。
- 不在命令中打印变量值，不输出完整异常请求、签名 URL 或 Authorization Header。
- 不把 AK/SK 粘贴到聊天、Markdown、issue 或截图。需要轮换时只在阿里云控制台和本机秘密文件中完成。
- `test-results/oss-preflight/` 已被 Git 忽略；证据只记录“凭据存在”布尔值、脱敏后的状态码、对象摘要和请求 ID。

## 4. 执行

```powershell
pnpm preflight:oss
```

可选参数：

```powershell
pnpm preflight:oss -- --origin https://admin.example.com
pnpm preflight:oss -- --env-file .env.preflight
```

执行顺序：

1. 只读核对 Region、Endpoint、Bucket 名、同账号同地域、ACL、BPA 和私有 Bucket CORS；
2. 真实发送浏览器 OPTIONS；
3. 生成无个人信息的 29,360,568 字节 PNG，执行 V4 条件 PUT、重复覆盖拒绝、HEAD、摘要和 `image/info` 校验；
4. 通过 `ffmpeg-static@5.3.0` 暴露的绝对路径启动随应用安装的 FFmpeg，并从子进程环境移除 `PATH`/`Path`；把大原图生成最长边不超过 4,096 px、大小不超过 20,000,000 字节的私有 PNG 处理源，同时记录二进制版本和 SHA-256；
5. 使用该处理源和 160×64 合成 Logo 验证 `image/info`、缩放、水印、WebP 与跨 Bucket `sys/saveas`；
6. 验证私有匿名 GET 为 403、公开衍生对象匿名 GET 为 200、永久原图和私有处理源摘要不变；
7. 再次核对两个 Bucket、环境和完整 `test/<run-id>/` 前缀，只按内存中的四个精确 Key 反序删除并逐个 HEAD 确认 404。

脚本不会列举 Bucket，也不会自动修改 ACL、Bucket Policy、BPA 或 CORS。只读门禁不满足时，写入阶段停止并输出最小、可回滚的控制台操作。

阿里云文档标明[图片处理原图不能超过 20 MB](https://help.aliyun.com/zh/oss/user-guide/resize-images-4)，而[普通 PutObject 单次上传上限为 5 GB](https://help.aliyun.com/zh/oss/developer-reference/putobject)，并没有 30 MB 的 OSS 通用上传上限。项目仍接受不超过 30,000,000 字节的永久私有原图；超过图片处理上限时，必须先生成上述私有处理源，不能把大对象 PUT 或 `image/info` 成功冒充为可直接处理。

`ffmpeg-static` 与所带 FFmpeg 二进制采用 GPL 许可。T52 打包部署前必须保留适用许可证与来源说明，并确认最终分发方式满足许可义务；T10 不把 Windows 开发机二进制提交进仓库，也不依赖系统安装的 FFmpeg。

## 5. CORS 收敛

T10 能力验证只要求私有 Bucket 支持后台来源的条件 PUT。最小规则是：

- Allowed Origin：实际后台 Origin；
- Allowed Method：`PUT`；
- Allowed Headers：`content-type`、`content-md5`、`x-oss-meta-sha256`、`x-oss-forbid-overwrite`；
- Expose Headers：`ETag`、`x-oss-request-id`。

当前 `Origin: *`、`Headers: *` 和 GET/POST/PUT/DELETE/HEAD 规则足以通过能力预检，但范围大于正式最小值。公开图片由普通 `<img>` 匿名读取时不需要 CORS；只有未来确需跨源 JavaScript 读取像素时，才为公开 Bucket 增加对应 GET 规则。

## 6. 水印边界

预检中的缩放宽度、透明度、边距和右下角锚点只用于证明 OSS 能组合执行 Logo 水印、缩放、WebP 和跨 Bucket `sys/saveas`。这些值不是 `brand-standard-v1` 或 `brand-subtle-v1` 的最终品牌参数；正式参数仍由 EXT-01/T51 使用正式素材校准。
